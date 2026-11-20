import type { FastifyPluginAsync } from 'fastify';
import { database } from '../../db/client.js';
import { requireAdmin } from '../auth/session.js';
import {
  calculateAvailableSlots, getBusinessDay, validDate, validateWeeklyWindows,
  type WeeklyWindow,
} from './domain.js';

type Id = { id: string };
type SlotsQuery = { professionalId: string; serviceId: string; date: string };
type AdminQuery = { professionalId: string };
type ScheduleBody = { windows: WeeklyWindow[] };
type BlockBody = {professionalId: string; startsAt: string; endsAt: string; reason?: string};

const UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const uuidField = {type:'string', pattern:UUID};
const dateField = {type:'string', pattern:'^\\d{4}-\\d{2}-\\d{2}$'};
const clock = {type:'string', pattern:'^(?:[01]\\d|2[0-3]):[0-5]\\d$'};
const idParams={type:'object',required:['id'],additionalProperties:false,properties:{id:uuidField}};
const adminQuery={type:'object',required:['professionalId'],additionalProperties:false,properties:{professionalId:uuidField}};
const slotsQuery={type:'object',required:['professionalId','serviceId','date'],additionalProperties:false,
  properties:{professionalId:uuidField,serviceId:uuidField,date:dateField}};
const scheduleBody={type:'object',required:['windows'],additionalProperties:false,
  properties:{windows:{type:'array',maxItems:80,items:{type:'object',required:['weekday','startTime','endTime'],
    additionalProperties:false,properties:{weekday:{type:'integer',minimum:0,maximum:6},startTime:clock,endTime:clock}}}}};
const blockBody={type:'object',required:['professionalId','startsAt','endsAt'],additionalProperties:false,
  properties:{professionalId:uuidField,startsAt:{type:'string',maxLength:40},endsAt:{type:'string',maxLength:40},
    reason:{type:'string',maxLength:250}}};

const timestampPattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:(?:\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function businessTimeZone(): string {
  const zone=process.env.BUSINESS_TIMEZONE ?? 'America/Sao_Paulo';
  new Intl.DateTimeFormat('en-US',{timeZone:zone}); // falha imediatamente para zona inválida
  return zone;
}

function parseTimestamp(value:string): number {
  if (!timestampPattern.test(value) || !validDate(value.slice(0,10))) throw new Error('Data/hora exige ISO 8601 com fuso, como 2035-01-01T14:00:00Z.');
  const parsed=Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Data/hora inválida.');
  return parsed;
}

function ensureNearFuture(value: number, now: number) {
  if (value<=now || value > now + 90*24*60*60*1000) {
    throw new Error('Escolha um horário futuro dentro de 90 dias.');
  }
}

export const availabilityRoutes: FastifyPluginAsync = async app => {
  app.get<{Querystring:SlotsQuery}>('/availability/slots', {schema:{querystring:slotsQuery}}, async(request,reply)=>{
    const {professionalId,serviceId,date}=request.query;
    const zone=businessTimeZone();
    if (!validDate(date)) return reply.code(400).send({error:'Data inválida.'});
    const today=getBusinessDay(Date.now(),zone);
    const maxFuture=getBusinessDay(Date.now()+90*24*60*60*1000,zone);
    if (date<today || date>maxFuture) return reply.code(400).send({error:'Consulte datas de hoje até 90 dias.'});
    const relation=await database().query<{duration_minutes:number}>(
      `SELECT s.duration_minutes FROM services s
       JOIN professional_services ps ON ps.service_id=s.id
       JOIN professionals p ON p.id=ps.professional_id
       WHERE s.id=$1 AND p.id=$2 AND s.active=true AND p.active=true`,
      [serviceId,professionalId],
    );
    if (!relation.rowCount) return reply.code(404).send({error:'Serviço ou profissional indisponível.'});
    const [weekly,blocked,bookings]=await Promise.all([
      database().query<{weekday:number;startTime:string;endTime:string}>(
        `SELECT weekday, to_char(start_time,'HH24:MI') AS "startTime",
          to_char(end_time,'HH24:MI') AS "endTime"
          FROM availabilities WHERE professional_id=$1 ORDER BY weekday,start_time`,[professionalId]),
      database().query<{startsAt:Date;endsAt:Date}>(
        `SELECT starts_at AS "startsAt",ends_at AS "endsAt" FROM blocked_periods
         WHERE professional_id=$1 AND ends_at >= ($2::date - interval '2 days')
           AND starts_at < ($2::date + interval '3 days')`,[professionalId,date]),
      database().query<{startsAt:Date;endsAt:Date}>(
        `SELECT starts_at AS "startsAt",ends_at AS "endsAt" FROM appointments
         WHERE professional_id=$1 AND status IN ('PENDENTE','CONFIRMADO')
           AND ends_at >= ($2::date - interval '2 days')
           AND starts_at < ($2::date + interval '3 days')`,[professionalId,date]),
    ]);
    const convert=(rows:Array<{startsAt:Date;endsAt:Date}>)=>rows.map(row=>({
      startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),
    }));
    const slots=calculateAvailableSlots({
      date,zone,durationMinutes:relation.rows[0].duration_minutes,
      windows:weekly.rows,blocked:convert(blocked.rows),bookings:convert(bookings.rows),
    });
    return {date,timezone:zone,professionalId,serviceId,durationMinutes:relation.rows[0].duration_minutes,slots};
  });

  app.get<{Querystring:AdminQuery}>('/admin/availability', {schema:{querystring:adminQuery}}, async(request,reply)=>{
    if (!await requireAdmin(request,reply)) return;
    const {professionalId}=request.query;
    const exists=await database().query('SELECT 1 FROM professionals WHERE id=$1',[professionalId]);
    if (!exists.rowCount) return reply.code(404).send({error:'Profissional não encontrado.'});
    const [weekly,blocked]=await Promise.all([
      database().query(`SELECT id,weekday,to_char(start_time,'HH24:MI') AS "startTime",
          to_char(end_time,'HH24:MI') AS "endTime"
          FROM availabilities WHERE professional_id=$1 ORDER BY weekday,start_time`,[professionalId]),
      database().query(`SELECT id,starts_at AS "startsAt",ends_at AS "endsAt",reason
          FROM blocked_periods WHERE professional_id=$1 AND ends_at>now()
          ORDER BY starts_at LIMIT 100`,[professionalId]),
    ]);
    return {professionalId,timezone:businessTimeZone(),windows:weekly.rows,blocked:blocked.rows};
  });

  app.put<{Params:Id;Body:ScheduleBody}>('/admin/professionals/:id/availability',
    {schema:{params:idParams,body:scheduleBody}}, async(request,reply)=>{
    if (!await requireAdmin(request,reply)) return;
    const windows=request.body.windows;
    try { validateWeeklyWindows(windows); }
    catch(error) { return reply.code(400).send({error:(error as Error).message}); }
    const client=await database().connect();
    try{
      await client.query('BEGIN');
      const exists=await client.query('SELECT 1 FROM professionals WHERE id=$1 FOR UPDATE',[request.params.id]);
      if (!exists.rowCount){
        await client.query('ROLLBACK');
        return reply.code(404).send({error:'Profissional não encontrado.'});
      }
      // Não alterar jornada enquanto houver agendamentos futuros ativos.
      // A política para realocar reservas será especificada na Fase 3.
      const reserved=await client.query(
        "SELECT 1 FROM appointments WHERE professional_id=$1 AND starts_at>now() AND status IN ('PENDENTE','CONFIRMADO') LIMIT 1",
        [request.params.id],
      );
      if (reserved.rowCount) {
        await client.query('ROLLBACK');
        return reply.code(409).send({error:'Há reservas futuras ativas. Replaneje antes de alterar o expediente.'});
      }
      await client.query('DELETE FROM availabilities WHERE professional_id=$1',[request.params.id]);
      for(const window of windows) {
        await client.query(
          'INSERT INTO availabilities(professional_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4)',
          [request.params.id,window.weekday,window.startTime,window.endTime],
        );
      }
      await client.query('COMMIT');
      return {professionalId:request.params.id,windows};
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
  });

  app.post<{Body:BlockBody}>('/admin/blocked-periods',{schema:{body:blockBody}},async(request,reply)=>{
    if (!await requireAdmin(request,reply)) return;
    const {professionalId,startsAt,endsAt,reason}=request.body;
    let start:number,end:number;
    try{
      start=parseTimestamp(startsAt);
      end=parseTimestamp(endsAt);
      ensureNearFuture(start,Date.now());
      if(end<=start || end-start>30*24*60*60*1000) throw new Error('Bloqueio deve terminar depois do início e durar no máximo 30 dias.');
    }catch(error){return reply.code(400).send({error:(error as Error).message})}
    const client=await database().connect();
    try{
      await client.query('BEGIN');
      const pro=await client.query('SELECT 1 FROM professionals WHERE id=$1 FOR UPDATE',[professionalId]);
      if(!pro.rowCount){
        await client.query('ROLLBACK');
        return reply.code(404).send({error:'Profissional não encontrado.'});
      }
      const conflicts=await client.query(
        `SELECT 1 FROM appointments WHERE professional_id=$1 AND status IN('PENDENTE','CONFIRMADO')
         AND tstzrange(starts_at,ends_at,'[)') && tstzrange($2::timestamptz,$3::timestamptz,'[)')
         LIMIT 1`,[professionalId,new Date(start).toISOString(),new Date(end).toISOString()],
      );
      if(conflicts.rowCount){
        await client.query('ROLLBACK');
        return reply.code(409).send({error:'Bloqueio conflita com reserva ativa.'});
      }
      const duplicates=await client.query(
        `SELECT 1 FROM blocked_periods WHERE professional_id=$1
         AND tstzrange(starts_at,ends_at,'[)') && tstzrange($2::timestamptz,$3::timestamptz,'[)')
         LIMIT 1`,[professionalId,new Date(start).toISOString(),new Date(end).toISOString()],
      );
      if(duplicates.rowCount){
        await client.query('ROLLBACK');
        return reply.code(409).send({error:'Já existe um bloqueio nesse intervalo.'});
      }
      const saved=await client.query(
        `INSERT INTO blocked_periods(professional_id,starts_at,ends_at,reason)
         VALUES($1,$2,$3,$4) RETURNING id,starts_at AS "startsAt",ends_at AS "endsAt",reason`,
        [professionalId,new Date(start).toISOString(),new Date(end).toISOString(),reason?.trim()??null],
      );
      await client.query('COMMIT');
      return reply.code(201).send({blockedPeriod:saved.rows[0]});
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
  });

  app.delete<{Params:Id}>('/admin/blocked-periods/:id',{schema:{params:idParams}},async(request,reply)=>{
    if (!await requireAdmin(request,reply)) return;
    const result=await database().query(
      'DELETE FROM blocked_periods WHERE id=$1 RETURNING id',[request.params.id],
    );
    if(!result.rowCount)return reply.code(404).send({error:'Bloqueio não encontrado.'});
    return reply.code(204).send();
  });
};
