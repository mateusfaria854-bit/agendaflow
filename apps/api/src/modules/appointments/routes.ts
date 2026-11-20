import type {FastifyPluginAsync, FastifyReply, FastifyRequest} from 'fastify';
import {database} from '../../db/client.js';
import {findSessionUser, type SessionUser} from '../auth/session.js';
import {businessTimeZone} from '../availability/routes.js';
import {calculateAvailableSlots, getBusinessDay, validDate} from '../availability/domain.js';

type BookingInput = {professionalId: string; serviceId: string; startsAt: string};
type Id = {id:string};
type Appointment = {
  id:string; professionalId:string; serviceId:string;
  startsAt:Date; endsAt:Date; status:string; priceCents:number;
  serviceName:string; professionalName:string;
};

const UUID='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const ISO_UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const idParams={type:'object',required:['id'],additionalProperties:false,properties:{id:{type:'string',pattern:UUID}}};
const createSchema={type:'object',required:['professionalId','serviceId','startsAt'],additionalProperties:false,
  properties:{
    professionalId:{type:'string',pattern:UUID},
    serviceId:{type:'string',pattern:UUID},
    startsAt:{type:'string',maxLength:30,pattern:'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$'},
  },
};

async function requireClient(request:FastifyRequest,reply:FastifyReply):Promise<SessionUser|null>{
  const user=await findSessionUser(request);
  if(!user){reply.code(401).send({error:'Entre na sua conta para gerenciar reservas.'});return null}
  if(user.role!=='CLIENTE'){reply.code(403).send({error:'Reservas pessoais são exclusivas de clientes.'});return null}
  return user;
}

/** Somente propriedades públicas. Preço e término são sempre calculados no servidor. */
function display(row:Appointment){
  return {
    id:row.id,professionalId:row.professionalId,serviceId:row.serviceId,
    startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),
    status:row.status,priceCents:row.priceCents,
    serviceName:row.serviceName,professionalName:row.professionalName,
  };
}
const SELECT_APPOINTMENT=`
  SELECT a.id, a.professional_id AS "professionalId", a.service_id AS "serviceId",
         a.starts_at AS "startsAt", a.ends_at AS "endsAt",
         a.status, a.price_cents AS "priceCents",
         s.name AS "serviceName", p.name AS "professionalName"
  FROM appointments a
  JOIN services s ON s.id=a.service_id
  JOIN professionals p ON p.id=a.professional_id
`;

export const appointmentRoutes:FastifyPluginAsync=async app=>{
  app.post<{Body:BookingInput}>('/appointments',{schema:{body:createSchema}},async(request,reply)=>{
    const user=await requireClient(request,reply);
    if(!user)return;
    const {professionalId,serviceId,startsAt}=request.body;
    if(!ISO_UTC.test(startsAt)) return reply.code(400).send({error:'Informe um horário UTC ISO 8601 válido.'});
    const start=Date.parse(startsAt);
    if(!Number.isFinite(start)||!validDate(startsAt.slice(0,10)))
      return reply.code(400).send({error:'Data/hora inválida.'});
    const zone=businessTimeZone();
    const date=getBusinessDay(start,zone);
    const maxDate=getBusinessDay(Date.now()+90*24*60*60_000,zone);
    if(start<=Date.now()||start>Date.now()+90*24*60*60_000||date>maxDate){
      return reply.code(400).send({error:'Escolha um horário futuro dentro de 90 dias.'});
    }

    const client=await database().connect();
    try{
      await client.query('BEGIN');
      // Mesmo lock da edição do expediente/bloqueios: duas reservas
      // simultâneas do mesmo profissional são validadas em sequência.
      const pro=await client.query('SELECT id FROM professionals WHERE id=$1 AND active=true FOR UPDATE',[professionalId]);
      if(!pro.rowCount){
        await client.query('ROLLBACK');
        return reply.code(404).send({error:'Profissional indisponível.'});
      }
      const service=await client.query<{durationMinutes:number;priceCents:number}>(
        `SELECT s.duration_minutes AS "durationMinutes",s.price_cents AS "priceCents"
         FROM services s JOIN professional_services ps ON ps.service_id=s.id
         WHERE s.id=$1 AND ps.professional_id=$2 AND s.active=true
         FOR SHARE OF s,ps`,[serviceId,professionalId],
      );
      if(!service.rowCount){
        await client.query('ROLLBACK');
        return reply.code(404).send({error:'Este serviço não é oferecido pelo profissional.'});
      }
      const [weekly,blocks,bookings]=await Promise.all([
        client.query<{weekday:number;startTime:string;endTime:string}>(
          `SELECT weekday,to_char(start_time,'HH24:MI') AS "startTime",
           to_char(end_time,'HH24:MI') AS "endTime"
           FROM availabilities WHERE professional_id=$1 ORDER BY weekday,start_time`,[professionalId]),
        client.query<{startsAt:Date;endsAt:Date}>(
          `SELECT starts_at AS "startsAt", ends_at AS "endsAt" FROM blocked_periods
           WHERE professional_id=$1 AND ends_at >= ($2::date - interval '2 days')
           AND starts_at < ($2::date + interval '3 days')`,[professionalId,date]),
        client.query<{startsAt:Date;endsAt:Date}>(
          `SELECT starts_at AS "startsAt", ends_at AS "endsAt" FROM appointments
           WHERE professional_id=$1 AND status IN ('PENDENTE','CONFIRMADO')
           AND ends_at >= ($2::date - interval '2 days')
           AND starts_at < ($2::date + interval '3 days')`,[professionalId,date]),
      ]);
      const iso=(rows:{startsAt:Date;endsAt:Date}[])=>rows.map(v=>({
        startsAt:v.startsAt.toISOString(),endsAt:v.endsAt.toISOString(),
      }));
      const allowed=calculateAvailableSlots({
        date,zone,durationMinutes:service.rows[0].durationMinutes,windows:weekly.rows,
        blocked:iso(blocks.rows),bookings:iso(bookings.rows),nowMs:Date.now(),
      });
      const slot=allowed.find(v=>v.startsAt===new Date(start).toISOString());
      if(!slot){
        await client.query('ROLLBACK');
        return reply.code(409).send({error:'Horário indisponível. Consulte a agenda e escolha outro horário.'});
      }
      // O banco ainda impõe EXCLUDE USING gist para evitar reservas
      // sobrepostas mesmo se uma futura rota não respeitar o lock.
      const inserted=await client.query<{id:string}>(`INSERT INTO appointments
        (client_id,professional_id,service_id,starts_at,ends_at,status,price_cents)
        VALUES($1,$2,$3,$4,$5,'CONFIRMADO',$6) RETURNING id`,
      [user.id,professionalId,serviceId,slot.startsAt,slot.endsAt,service.rows[0].priceCents]);
      await client.query(`INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id)
        VALUES($1,'APPOINTMENT_CREATED','appointment',$2)`,[user.id,inserted.rows[0].id]);
      const booked=await client.query<Appointment>(
        SELECT_APPOINTMENT+' WHERE a.id=$1',[inserted.rows[0].id],
      );
      await client.query('COMMIT');
      return reply.code(201).send({appointment:display(booked.rows[0])});
    }catch(error){
      await client.query('ROLLBACK');
      if((error as {code?:string}).code==='23P01'){
        return reply.code(409).send({error:'O horário acabou de ser reservado. Escolha outro.'});
      }
      throw error;
    }finally{client.release()}
  });

  app.get('/appointments/mine',async(request,reply)=>{
    const user=await requireClient(request,reply);
    if(!user)return;
    const result=await database().query<Appointment>(
      SELECT_APPOINTMENT+' WHERE a.client_id=$1 ORDER BY a.starts_at DESC, a.id DESC LIMIT 50',
      [user.id],
    );
    return {appointments:result.rows.map(display),timezone:businessTimeZone()};
  });

  app.patch<{Params:Id}>('/appointments/:id/cancel',{schema:{params:idParams}},async(request,reply)=>{
    const user=await requireClient(request,reply);
    if(!user)return;
    const client=await database().connect();
    try{
      await client.query('BEGIN');
      const updated=await client.query<Appointment>(
        `UPDATE appointments SET status='CANCELADO',updated_at=now()
         WHERE id=$1 AND client_id=$2 AND starts_at>now()
           AND status IN ('PENDENTE','CONFIRMADO')
         RETURNING id`,[request.params.id,user.id],
      );
      if(!updated.rowCount){
        const owned=await client.query('SELECT status FROM appointments WHERE id=$1 AND client_id=$2',
          [request.params.id,user.id]);
        await client.query('ROLLBACK');
        if(!owned.rowCount) return reply.code(404).send({error:'Agendamento não encontrado.'});
        return reply.code(409).send({error:'Somente reservas futuras e ativas podem ser canceladas.'});
      }
      await client.query(`INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id)
        VALUES($1,'APPOINTMENT_CANCELLED','appointment',$2)`,[user.id,request.params.id]);
      const result=await client.query<Appointment>(SELECT_APPOINTMENT+' WHERE a.id=$1',[request.params.id]);
      await client.query('COMMIT');
      return {appointment:display(result.rows[0])};
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
  });
};
