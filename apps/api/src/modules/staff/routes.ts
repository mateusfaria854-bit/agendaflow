import type {FastifyPluginAsync,FastifyReply,FastifyRequest} from 'fastify';
import {database} from '../../db/client.js';
import {findSessionUser,type SessionUser} from '../auth/session.js';
import {businessTimeZone} from '../availability/routes.js';
import {validDate} from '../availability/domain.js';

type Status='PENDENTE'|'CONFIRMADO'|'CONCLUIDO'|'CANCELADO';
type Query={from:string;to:string;status?:Status;offset?:number};
const schema={
  type:'object',required:['from','to'],additionalProperties:false,
  properties:{
    from:{type:'string',maxLength:10},to:{type:'string',maxLength:10},
    status:{type:'string',enum:['PENDENTE','CONFIRMADO','CONCLUIDO','CANCELADO']},
    offset:{type:'integer',minimum:0,maximum:10000},
  },
};

async function requireStaff(request:FastifyRequest,reply:FastifyReply):Promise<SessionUser|null>{
  const user=await findSessionUser(request);
  if(!user){
    reply.code(401).send({error:'Entre como profissional para consultar a agenda.'});
    return null;
  }
  if(user.role!=='PROFISSIONAL'){
    reply.code(403).send({error:'Agenda disponível apenas para profissionais.'});
    return null;
  }
  return user;
}

async function linkedProfessional(userId:string){
  const result=await database().query<{id:string;name:string}>(
    'SELECT id,name FROM professionals WHERE user_id=$1 AND active=true',[userId],
  );
  return result.rows[0]??null;
}

export const staffRoutes:FastifyPluginAsync=async app=>{
  app.get('/staff/me',async(request,reply)=>{
    const user=await requireStaff(request,reply);
    if(!user)return;
    const professional=await linkedProfessional(user.id);
    if(!professional)return reply.code(404).send({error:'Não há uma agenda profissional ativa vinculada à sua conta.'});
    return {professional};
  });

  app.get<{Querystring:Query}>('/staff/appointments',{schema:{querystring:schema}},async(request,reply)=>{
    const user=await requireStaff(request,reply);
    if(!user)return;
    const {from,to,status,offset=0}=request.query;
    if(!validDate(from)||!validDate(to)||from>to||
       (Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86_400_000>30){
      return reply.code(400).send({error:'Informe um período válido de até 31 dias.'});
    }
    const professional=await linkedProfessional(user.id);
    if(!professional)return reply.code(404).send({error:'Não há uma agenda profissional ativa vinculada à sua conta.'});
    const zone=businessTimeZone();
    // O profissional é derivado SOMENTE da sessão, nunca de parâmetros da consulta.
    const args=[professional.id,from,to,zone,status??null];
    const where=[
      ' WHERE a.professional_id=$1',
      ' AND a.starts_at>=($2::date::timestamp AT TIME ZONE $4)',
      ' AND a.starts_at<(($3::date+1)::timestamp AT TIME ZONE $4)',
      ' AND ($5::text IS NULL OR a.status=$5)',
    ].join('');
    const [records,total]=await Promise.all([
      database().query<{
        id:string;startsAt:Date;endsAt:Date;status:Status;
        serviceName:string;clientName:string;
      }>(
        'SELECT a.id,a.starts_at AS "startsAt",a.ends_at AS "endsAt",a.status,'+
        ' s.name AS "serviceName",u.name AS "clientName"'+
        ' FROM appointments a JOIN services s ON s.id=a.service_id'+
        ' JOIN users u ON u.id=a.client_id'+where+
        ' ORDER BY a.starts_at ASC,a.id ASC LIMIT 100 OFFSET $6',
        [...args,offset],
      ),
      database().query<{total:number}>(
        'SELECT count(*)::int AS total FROM appointments a'+where,args,
      ),
    ]);
    return {
      professional,timezone:zone,from,to,offset,pageSize:100,total:total.rows[0].total,
      appointments:records.rows.map(row=>({
        id:row.id,startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),
        status:row.status,serviceName:row.serviceName,clientName:row.clientName,
      })),
    };
  });
};
