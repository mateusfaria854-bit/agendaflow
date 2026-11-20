import type { FastifyPluginAsync } from 'fastify';
import type { PoolClient } from 'pg';
import { database } from '../../db/client.js';
import { requireAdmin } from '../auth/session.js';

type ServiceInput = { name: string; durationMinutes: number; priceCents: number };
type ServicePatch = Partial<ServiceInput> & {active?: boolean};
type ProfessionalInput = {name: string; serviceIds: string[]};
type ProfessionalPatch = {name?: string; active?: boolean; serviceIds?: string[]};
type IdParam = {id: string};

const uuid = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const name = {type:'string',minLength:2,maxLength:140};
const ids = {type:'array',items:{type:'string',pattern:uuid},uniqueItems:true,maxItems:100};
const serviceProperties = {name,durationMinutes:{type:'integer',minimum:5,maximum:480},priceCents:{type:'integer',minimum:0,maximum:100000000}};
const serviceCreate = {type:'object',required:['name','durationMinutes','priceCents'],additionalProperties:false,properties:serviceProperties};
const servicePatch = {type:'object',additionalProperties:false,minProperties:1,properties:{...serviceProperties,active:{type:'boolean'}}};
const professionalCreate = {type:'object',required:['name','serviceIds'],additionalProperties:false,properties:{name,serviceIds:ids}};
const professionalPatch = {type:'object',additionalProperties:false,minProperties:1,properties:{name,active:{type:'boolean'},serviceIds:ids}};
const idParams = {type:'object',required:['id'],properties:{id:{type:'string',pattern:uuid}}};

async function validateServiceIds(client: PoolClient, serviceIds: string[]): Promise<boolean> {
  if (!serviceIds.length) return true;
  const result = await client.query<{count: number}>(
    'SELECT count(*)::int AS count FROM services WHERE active=true AND id = ANY($1::uuid[])',
    [serviceIds],
  );
  return result.rows[0].count === serviceIds.length;
}

async function assignServices(client: PoolClient, professionalId: string, serviceIds: string[]): Promise<void> {
  if (!await validateServiceIds(client,serviceIds)) throw new Error('Um ou mais serviços estão indisponíveis.');
  await client.query('DELETE FROM professional_services WHERE professional_id=$1', [professionalId]);
  for (const serviceId of serviceIds) {
    await client.query('INSERT INTO professional_services(professional_id,service_id) VALUES($1,$2)', [professionalId,serviceId]);
  }
}

async function listProfessionals(includeInactive: boolean) {
  const result = await database().query(
    `SELECT p.id,p.name,p.active,
      ${includeInactive ? 'p.user_id IS NOT NULL AS "hasAccount",' : ''}
      COALESCE(json_agg(json_build_object('id',s.id,'name',s.name,'active',s.active) ORDER BY s.name)
        FILTER (WHERE s.id IS NOT NULL ${includeInactive ? '' : 'AND s.active=true'}), '[]'::json) AS services
      FROM professionals p
      LEFT JOIN professional_services ps ON ps.professional_id=p.id
      LEFT JOIN services s ON s.id=ps.service_id
      WHERE ($1::boolean OR p.active=true)
      GROUP BY p.id,p.name,p.active
      ORDER BY p.name ASC`,
    [includeInactive],
  );
  return result.rows;
}

export const catalogRoutes: FastifyPluginAsync = async app => {
  app.get('/services', async () => {
    const result = await database().query(
      'SELECT id,name,duration_minutes AS "durationMinutes",price_cents AS "priceCents",active FROM services WHERE active=true ORDER BY name',
    );
    return {services: result.rows};
  });

  app.get('/professionals', async () => ({professionals: await listProfessionals(false)}));

  app.get('/admin/services', async (request,reply) => {
    if (!await requireAdmin(request,reply)) return;
    const result = await database().query(
      'SELECT id,name,duration_minutes AS "durationMinutes",price_cents AS "priceCents",active FROM services ORDER BY name',
    );
    return {services:result.rows};
  });

  app.post<{Body:ServiceInput}>('/services', {schema:{body:serviceCreate}}, async (request,reply) => {
    if (!await requireAdmin(request,reply)) return;
    const input=request.body;
    if (!input.name.trim()) return reply.code(400).send({error:'Nome do serviço inválido.'});
    const result=await database().query(
      `INSERT INTO services(name,duration_minutes,price_cents)
       VALUES($1,$2,$3) RETURNING id,name,duration_minutes AS "durationMinutes",price_cents AS "priceCents",active`,
      [input.name.trim(),input.durationMinutes,input.priceCents],
    );
    return reply.code(201).send({service:result.rows[0]});
  });

  app.patch<{Params:IdParam;Body:ServicePatch}>('/services/:id', {schema:{params:idParams,body:servicePatch}}, async (request,reply) => {
    if (!await requireAdmin(request,reply)) return;
    const input=request.body;
    if (input.name !== undefined && !input.name.trim()) return reply.code(400).send({error:'Nome do serviço inválido.'});
    const result=await database().query(
      `UPDATE services SET
       name=COALESCE($2,name),
       duration_minutes=COALESCE($3,duration_minutes),
       price_cents=COALESCE($4,price_cents),
       active=COALESCE($5,active)
       WHERE id=$1 RETURNING id,name,duration_minutes AS "durationMinutes",price_cents AS "priceCents",active`,
      [request.params.id,input.name?.trim(),input.durationMinutes,input.priceCents,input.active],
    );
    if (!result.rowCount) return reply.code(404).send({error:'Serviço não encontrado.'});
    return {service:result.rows[0]};
  });

  app.get('/admin/professionals', async(request,reply) => {
    if (!await requireAdmin(request,reply)) return;
    return {professionals:await listProfessionals(true)};
  });

  app.post<{Body:ProfessionalInput}>('/professionals', {schema:{body:professionalCreate}}, async(request,reply) => {
    if (!await requireAdmin(request,reply)) return;
    const {name,serviceIds}=request.body;
    if (!name.trim()) return reply.code(400).send({error:'Nome do profissional inválido.'});
    const client=await database().connect();
    try {
      await client.query('BEGIN');
      if (!await validateServiceIds(client,serviceIds)) {
        await client.query('ROLLBACK');
        return reply.code(400).send({error:'Um ou mais serviços estão indisponíveis.'});
      }
      const result=await client.query(
        'INSERT INTO professionals(name) VALUES($1) RETURNING id,name,active',
        [name.trim()],
      );
      await assignServices(client,result.rows[0].id,serviceIds);
      await client.query('COMMIT');
      return reply.code(201).send({professional:{...result.rows[0],serviceIds}});
    } catch(error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch<{Params:IdParam;Body:ProfessionalPatch}>('/professionals/:id', {schema:{params:idParams,body:professionalPatch}}, async(request,reply) => {
    if (!await requireAdmin(request,reply)) return;
    const {name,active,serviceIds}=request.body;
    if (name!==undefined && !name.trim()) return reply.code(400).send({error:'Nome do profissional inválido.'});
    const client=await database().connect();
    try {
      await client.query('BEGIN');
      const result=await client.query(
        `UPDATE professionals SET name=COALESCE($2,name),active=COALESCE($3,active)
         WHERE id=$1 RETURNING id,name,active`,
        [request.params.id,name?.trim(),active],
      );
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return reply.code(404).send({error:'Profissional não encontrado.'});
      }
      if (serviceIds!==undefined) {
        if (!await validateServiceIds(client,serviceIds)) {
          await client.query('ROLLBACK');
          return reply.code(400).send({error:'Um ou mais serviços estão indisponíveis.'});
        }
        await assignServices(client,request.params.id,serviceIds);
      }
      await client.query('COMMIT');
      return {professional:result.rows[0]};
    } catch(error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
};
