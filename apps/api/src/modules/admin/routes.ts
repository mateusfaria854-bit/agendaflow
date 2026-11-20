import type {FastifyPluginAsync} from 'fastify';
import {database} from '../../db/client.js';
import {requireAdmin} from '../auth/session.js';
import {businessTimeZone} from '../availability/routes.js';
import {validDate} from '../availability/domain.js';
import {createBooking,type NewBooking} from '../appointments/service.js';

type Status='PENDENTE'|'CONFIRMADO'|'CONCLUIDO'|'CANCELADO';
type CalendarQuery={
  from:string;to:string;professionalId?:string;status?:Status;offset?:number;
};
type ClientSearchQuery={query:string};
type ManualBody=NewBooking&{clientId:string};
type StatusBody={status:'CONFIRMADO'|'CONCLUIDO'|'CANCELADO'};
type IdParams={id:string};

const UUID='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const STATUSES=['PENDENTE','CONFIRMADO','CONCLUIDO','CANCELADO'];
const calendarSchema={
  type:'object',required:['from','to'],additionalProperties:false,
  properties:{
    from:{type:'string',maxLength:10},to:{type:'string',maxLength:10},
    professionalId:{type:'string',pattern:UUID},
    status:{type:'string',enum:STATUSES},
    offset:{type:'integer',minimum:0,maximum:10000},
  },
};
const searchSchema={
  type:'object',required:['query'],additionalProperties:false,
  properties:{query:{type:'string',minLength:3,maxLength:80}},
};
const manualSchema={
  type:'object',required:['clientId','serviceId','professionalId','startsAt'],
  additionalProperties:false,
  properties:{
    clientId:{type:'string',pattern:UUID},
    serviceId:{type:'string',pattern:UUID},
    professionalId:{type:'string',pattern:UUID},
    startsAt:{type:'string',maxLength:30,pattern:'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$'},
  },
};
const idSchema={type:'object',required:['id'],additionalProperties:false,
  properties:{id:{type:'string',pattern:UUID}}};
const statusSchema={type:'object',required:['status'],additionalProperties:false,
  properties:{status:{type:'string',enum:['CONFIRMADO','CONCLUIDO','CANCELADO']}}};

function periodValid(from:string,to:string):boolean{
  if(!validDate(from)||!validDate(to)||from>to)return false;
  const span=(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86_400_000;
  return Number.isFinite(span)&&span<=30;
}

export const adminAppointmentRoutes:FastifyPluginAsync=async app=>{
  app.get<{Querystring:CalendarQuery}>('/admin/appointments',{
    schema:{querystring:calendarSchema},
  },async(request,reply)=>{
    if(!await requireAdmin(request,reply))return;
    const {from,to,professionalId,status,offset=0}=request.query;
    if(!periodValid(from,to))return reply.code(400).send({
      error:'Informe um período válido de no máximo 31 dias.',
    });
    const zone=businessTimeZone();
    const args=[from,to,zone,professionalId??null,status??null];
    const where=`
      WHERE a.starts_at >= ($1::date::timestamp AT TIME ZONE $3)
        AND a.starts_at < (($2::date + 1)::timestamp AT TIME ZONE $3)
        AND ($4::uuid IS NULL OR a.professional_id=$4)
        AND ($5::text IS NULL OR a.status=$5)
    `;
    const [list,total,counts]=await Promise.all([
      database().query(`
        SELECT a.id,a.professional_id AS "professionalId",
          a.service_id AS "serviceId",a.client_id AS "clientId",
          a.starts_at AS "startsAt",a.ends_at AS "endsAt",
          a.status,a.price_cents AS "priceCents",
          s.name AS "serviceName",p.name AS "professionalName",
          u.name AS "clientName",u.email AS "clientEmail"
        FROM appointments a
        JOIN services s ON s.id=a.service_id
        JOIN professionals p ON p.id=a.professional_id
        JOIN users u ON u.id=a.client_id
        ${where}
        ORDER BY a.starts_at ASC,a.id ASC LIMIT 100 OFFSET $6
      `,[...args,offset]),
      database().query<{total:number}>(`
        SELECT count(*)::int AS total FROM appointments a ${where}
      `,args),
      database().query<{status:Status;count:number}>(`
        SELECT a.status,count(*)::int AS count
        FROM appointments a ${where} GROUP BY a.status ORDER BY a.status
      `,args),
    ]);
    const appointments=list.rows.map(row=>({
      ...row,startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),
    }));
    return {
      timezone:zone,from,to,offset,pageSize:100,
      total:total.rows[0].total,counts:counts.rows,
      appointments,
    };
  });

  app.get<{Querystring:ClientSearchQuery}>('/admin/clients',{
    schema:{querystring:searchSchema},
  },async(request,reply)=>{
    if(!await requireAdmin(request,reply))return;
    const query=request.query.query.trim();
    if(query.length<3)return reply.code(400).send({error:'Digite pelo menos três caracteres.'});
    const found=await database().query<{id:string;name:string;email:string}>(
      `SELECT id,name,email FROM users
       WHERE role='CLIENTE' AND (name ILIKE $1 OR email ILIKE $1)
       ORDER BY name,id LIMIT 15`,['%'+query+'%'],
    );
    return {clients:found.rows};
  });

  app.post<{Body:ManualBody}>('/admin/appointments',{
    schema:{body:manualSchema},
  },async(request,reply)=>{
    const user=await requireAdmin(request,reply);
    if(!user)return;
    const {clientId,professionalId,serviceId,startsAt}=request.body;
    const result=await createBooking(clientId,{professionalId,serviceId,startsAt},user.id);
    return reply.code(result.status).send(
      result.status===201?{appointment:result.appointment}:{error:result.error},
    );
  });

  app.patch<{Params:IdParams;Body:StatusBody}>('/admin/appointments/:id/status',{
    schema:{params:idSchema,body:statusSchema},
  },async(request,reply)=>{
    const user=await requireAdmin(request,reply);
    if(!user)return;
    const {id}=request.params,target=request.body.status;
    const client=await database().connect();
    try{
      await client.query('BEGIN');
      // Usar ordem profissional -> agendamento, igual às reservas novas.
      const relation=await client.query<{professional_id:string}>(
        'SELECT professional_id FROM appointments WHERE id=$1',[id],
      );
      if(!relation.rowCount){
        await client.query('ROLLBACK');
        return reply.code(404).send({error:'Agendamento não encontrado.'});
      }
      await client.query(
        'SELECT id FROM professionals WHERE id=$1 FOR UPDATE',
        [relation.rows[0].professional_id],
      );
      const current=await client.query<{
        status:Status;starts_at:Date;ends_at:Date;
      }>('SELECT status,starts_at,ends_at FROM appointments WHERE id=$1 FOR UPDATE',[id]);
      if(!current.rowCount){
        await client.query('ROLLBACK');
        return reply.code(404).send({error:'Agendamento não encontrado.'});
      }
      const previous=current.rows[0],now=Date.now();
      const canConfirm=previous.status==='PENDENTE'&&
        target==='CONFIRMADO'&&previous.starts_at.getTime()>now;
      const canCancel=['PENDENTE','CONFIRMADO'].includes(previous.status)&&
        target==='CANCELADO'&&previous.starts_at.getTime()>now;
      const canComplete=previous.status==='CONFIRMADO'&&
        target==='CONCLUIDO'&&previous.ends_at.getTime()<=now;
      if(!(canConfirm||canCancel||canComplete)){
        await client.query('ROLLBACK');
        return reply.code(409).send({
          error:'Transição inválida: confirme apenas pendentes futuros, cancele reservas futuras ou conclua atendimentos encerrados.',
        });
      }
      const updated=await client.query(
        'UPDATE appointments SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,status',
        [id,target],
      );
      await client.query(`INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id)
        VALUES($1,$2,'appointment',$3)`,
        [user.id,'APPOINTMENT_ADMIN_'+target,id]);
      await client.query('COMMIT');
      return {appointment:updated.rows[0]};
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
  });
};
