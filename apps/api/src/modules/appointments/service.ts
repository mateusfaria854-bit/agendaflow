import {database} from '../../db/client.js';
import {businessTimeZone} from '../availability/routes.js';
import {calculateAvailableSlots, getBusinessDay, validDate} from '../availability/domain.js';

export type NewBooking = {professionalId:string;serviceId:string;startsAt:string};
export type StoredAppointment = {
  id:string;professionalId:string;serviceId:string;startsAt:Date;endsAt:Date;
  status:string;priceCents:number;serviceName:string;professionalName:string;
};
export const appointmentSelect = `
  SELECT a.id, a.professional_id AS "professionalId", a.service_id AS "serviceId",
         a.starts_at AS "startsAt", a.ends_at AS "endsAt",
         a.status, a.price_cents AS "priceCents",
         s.name AS "serviceName", p.name AS "professionalName"
  FROM appointments a
  JOIN services s ON s.id=a.service_id
  JOIN professionals p ON p.id=a.professional_id
`;
export function displayAppointment(row:StoredAppointment) {
  return {
    id:row.id,professionalId:row.professionalId,serviceId:row.serviceId,
    startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),
    status:row.status,priceCents:row.priceCents,
    serviceName:row.serviceName,professionalName:row.professionalName,
  };
}
export type CreateResult =
  | {status:201;appointment:ReturnType<typeof displayAppointment>}
  | {status:400|404|409;error:string};

const ISO_UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/**
 * Serviço de aplicação único para reservas do cliente e do administrador.
 * Lock de profissional serializa confirmação e mudanças de agenda.
 * Nenhum caller escolhe status, preço ou duração.
 */
export async function createBooking(clientId:string, input:NewBooking, actorId:string):Promise<CreateResult>{
  const {professionalId,serviceId,startsAt}=input;
  if(!ISO_UTC.test(startsAt)||!validDate(startsAt.slice(0,10))) {
    return {status:400,error:'Informe uma data/hora UTC válida retornada pela consulta de horários.'};
  }
  const start=Date.parse(startsAt),now=Date.now();
  if(!Number.isFinite(start)||start<=now||start>now+90*24*60*60_000){
    return {status:400,error:'Escolha um horário futuro dentro de 90 dias.'};
  }
  const zone=businessTimeZone(),date=getBusinessDay(start,zone);
  const dbClient=await database().connect();
  try{
    await dbClient.query('BEGIN');
    const professional=await dbClient.query(
      'SELECT id FROM professionals WHERE id=$1 AND active=true FOR UPDATE',[professionalId],
    );
    if(!professional.rowCount){
      await dbClient.query('ROLLBACK');
      return {status:404,error:'Profissional indisponível.'};
    }
    const owner=await dbClient.query(
      "SELECT id FROM users WHERE id=$1 AND role='CLIENTE' FOR SHARE",[clientId],
    );
    if(!owner.rowCount){
      await dbClient.query('ROLLBACK');
      return {status:404,error:'Cliente não encontrado.'};
    }
    const service=await dbClient.query<{durationMinutes:number;priceCents:number}>(
      `SELECT s.duration_minutes AS "durationMinutes",s.price_cents AS "priceCents"
       FROM services s JOIN professional_services ps ON ps.service_id=s.id
       WHERE s.id=$1 AND ps.professional_id=$2 AND s.active=true
       FOR SHARE OF s,ps`,[serviceId,professionalId],
    );
    if(!service.rowCount){
      await dbClient.query('ROLLBACK');
      return {status:404,error:'Este serviço não é oferecido pelo profissional.'};
    }
    const [weekly,blocks,bookings]=await Promise.all([
      dbClient.query<{weekday:number;startTime:string;endTime:string}>(
        `SELECT weekday,to_char(start_time,'HH24:MI') AS "startTime",
         to_char(end_time,'HH24:MI') AS "endTime"
         FROM availabilities WHERE professional_id=$1 ORDER BY weekday,start_time`,[professionalId]),
      dbClient.query<{startsAt:Date;endsAt:Date}>(
        `SELECT starts_at AS "startsAt", ends_at AS "endsAt" FROM blocked_periods
         WHERE professional_id=$1 AND ends_at >= ($2::date - interval '2 days')
         AND starts_at < ($2::date + interval '3 days')`,[professionalId,date]),
      dbClient.query<{startsAt:Date;endsAt:Date}>(
        `SELECT starts_at AS "startsAt", ends_at AS "endsAt" FROM appointments
         WHERE professional_id=$1 AND status IN ('PENDENTE','CONFIRMADO')
         AND ends_at >= ($2::date - interval '2 days')
         AND starts_at < ($2::date + interval '3 days')`,[professionalId,date]),
    ]);
    const iso=(rows:Array<{startsAt:Date;endsAt:Date}>)=>rows.map(v=>({
      startsAt:v.startsAt.toISOString(),endsAt:v.endsAt.toISOString(),
    }));
    const available=calculateAvailableSlots({
      date,zone,durationMinutes:service.rows[0].durationMinutes,windows:weekly.rows,
      blocked:iso(blocks.rows),bookings:iso(bookings.rows),nowMs:Date.now(),
    });
    const slot=available.find(v=>v.startsAt===new Date(start).toISOString());
    if(!slot){
      await dbClient.query('ROLLBACK');
      return {status:409,error:'Horário indisponível. Consulte a agenda e escolha outro.'};
    }
    const result=await dbClient.query<{id:string}>(`INSERT INTO appointments
      (client_id,professional_id,service_id,starts_at,ends_at,status,price_cents)
      VALUES($1,$2,$3,$4,$5,'CONFIRMADO',$6) RETURNING id`,
      [clientId,professionalId,serviceId,slot.startsAt,slot.endsAt,service.rows[0].priceCents]);
    await dbClient.query(`INSERT INTO audit_events(actor_id,event_type,entity_type,entity_id)
      VALUES($1,$2,'appointment',$3)`,
      [actorId,actorId===clientId?'APPOINTMENT_CREATED':'APPOINTMENT_CREATED_BY_ADMIN',result.rows[0].id]);
    const created=await dbClient.query<StoredAppointment>(
      appointmentSelect+' WHERE a.id=$1',[result.rows[0].id],
    );
    await dbClient.query('COMMIT');
    return {status:201,appointment:displayAppointment(created.rows[0])};
  }catch(error){
    await dbClient.query('ROLLBACK');
    if((error as {code?:string}).code==='23P01'){
      return {status:409,error:'Este horário acabou de ser reservado. Escolha outro.'};
    }
    throw error;
  }finally{dbClient.release()}
}
