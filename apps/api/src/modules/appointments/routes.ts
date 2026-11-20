import type {FastifyPluginAsync, FastifyReply, FastifyRequest} from 'fastify';
import {database} from '../../db/client.js';
import {findSessionUser, type SessionUser} from '../auth/session.js';
import {businessTimeZone} from '../availability/routes.js';
import {createBooking, appointmentSelect, displayAppointment, type NewBooking, type StoredAppointment} from './service.js';

type Id = {id:string};

const UUID='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
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

export const appointmentRoutes:FastifyPluginAsync=async app=>{
  app.post<{Body:NewBooking}>('/appointments',{schema:{body:createSchema}},async(request,reply)=>{
    const user=await requireClient(request,reply);
    if(!user)return;
    const result=await createBooking(user.id,request.body,user.id);
    return reply.code(result.status).send(result.status===201?{appointment:result.appointment}:{error:result.error});
  });

  app.get('/appointments/mine',async(request,reply)=>{
    const user=await requireClient(request,reply);
    if(!user)return;
    const result=await database().query<StoredAppointment>(
      appointmentSelect+' WHERE a.client_id=$1 ORDER BY a.starts_at DESC, a.id DESC LIMIT 50',
      [user.id],
    );
    return {appointments:result.rows.map(displayAppointment),timezone:businessTimeZone()};
  });

  app.patch<{Params:Id}>('/appointments/:id/cancel',{schema:{params:idParams}},async(request,reply)=>{
    const user=await requireClient(request,reply);
    if(!user)return;
    const client=await database().connect();
    try{
      await client.query('BEGIN');
      const updated=await client.query<StoredAppointment>(
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
      const result=await client.query<StoredAppointment>(appointmentSelect+' WHERE a.id=$1',[request.params.id]);
      await client.query('COMMIT');
      return {appointment:displayAppointment(result.rows[0])};
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
  });
};
