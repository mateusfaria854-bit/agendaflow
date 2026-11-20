import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {database} from '../src/db/client.js';
import {createApp} from '../src/app.js';
import {hashPassword} from '../src/modules/auth/password.js';
import {getBusinessDay} from '../src/modules/availability/domain.js';

function cookie(response:{headers:Record<string,unknown>}){
  const raw=response.headers['set-cookie'];
  return String(Array.isArray(raw)?raw[0]:raw).split(';')[0];
}

test('Fase 4: calendário, filtros, segurança, reserva manual e transições de status',
  {skip:!process.env.DATABASE_URL},async()=>{
  const pool=database(),app=createApp();
  const adminId=randomUUID(),clientId=randomUUID(),staffId=randomUUID();
  const proId=randomUUID(),serviceId=randomUUID();
  const date=getBusinessDay(Date.now()+10*86_400_000,'America/Sao_Paulo');
  const weekday=new Date(date+'T00:00:00Z').getUTCDay();
  let appointmentId:string|undefined;
  let secondAppointmentId:string|undefined;
  try{
    const password='senha-forte-de-integracao-fase-quatro';
    const hashed=await hashPassword(password);
    for(const [id,role,name] of [
      [adminId,'ADMIN','Admin da agenda'],
      [clientId,'CLIENTE','Cliente da agenda'],
      [staffId,'PROFISSIONAL','Profissional sem área admin'],
    ]){
      await pool.query(
        'INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',
        [id,name,`agenda-${id}@example.invalid`,hashed,role],
      );
    }
    await pool.query(
      'INSERT INTO services(id,name,duration_minutes,price_cents) VALUES($1,$2,30,7200)',
      [serviceId,'Serviço Fase 4'],
    );
    await pool.query(
      'INSERT INTO professionals(id,name,user_id) VALUES($1,$2,$3)',
      [proId,'Equipe Teste',staffId],
    );
    await pool.query(
      'INSERT INTO professional_services(professional_id,service_id) VALUES($1,$2)',
      [proId,serviceId],
    );
    await pool.query(
      'INSERT INTO availabilities(professional_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4)',
      [proId,weekday,'09:00','16:00'],
    );
    async function login(id:string){
      const result=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{
        email:`agenda-${id}@example.invalid`,password,
      }});
      assert.equal(result.statusCode,200,result.body);
      return cookie(result);
    }
    const [admin,client,staff]=await Promise.all([login(adminId),login(clientId),login(staffId)]);
    const path=`/api/v1/admin/appointments?from=${date}&to=${date}&professionalId=${proId}`;
    const anonymous=await app.inject({method:'GET',url:path});
    assert.equal(anonymous.statusCode,401);
    assert.equal((await app.inject({method:'GET',url:path,headers:{cookie:client}})).statusCode,403);
    assert.equal((await app.inject({method:'GET',url:path,headers:{cookie:staff}})).statusCode,403);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/clients?query=age',headers:{cookie:client}})).statusCode,403);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/clients?query=a',headers:{cookie:admin}})).statusCode,400);
    const found=await app.inject({method:'GET',
      url:'/api/v1/admin/clients?query=Cliente%20da%20agenda',headers:{cookie:admin}});
    assert.equal(found.statusCode,200,found.body);
    assert.ok(found.json().clients.some((c:{id:string})=>c.id===clientId));
    assert.ok(!found.body.includes('password_hash'));
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/appointments?from=2035-02-30&to=2035-02-30',headers:{cookie:admin}})).statusCode,400);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/appointments?from=2025-01-01&to=2025-02-15',headers:{cookie:admin}})).statusCode,400);

    const slots=await app.inject({method:'GET',
      url:`/api/v1/availability/slots?serviceId=${serviceId}&professionalId=${proId}&date=${date}`});
    assert.equal(slots.statusCode,200,slots.body);
    const slot=slots.json().slots[0] as {startsAt:string;endsAt:string};
    assert.ok(slot);
    const body={clientId,serviceId,professionalId:proId,startsAt:slot.startsAt};
    const manual=(headers?:Record<string,string>,payload:Record<string,unknown>=body)=>app.inject({
      method:'POST',url:'/api/v1/admin/appointments',headers,payload,
    });
    assert.equal((await manual(undefined)).statusCode,401);
    assert.equal((await manual({cookie:client})).statusCode,403);
    assert.equal((await manual({cookie:staff})).statusCode,403);
    assert.equal((await manual({cookie:admin},{...body,priceCents:1})).statusCode,400);
    assert.equal((await manual({cookie:admin},{...body,clientId:adminId})).statusCode,404);
    const booking=await manual({cookie:admin});
    assert.equal(booking.statusCode,201,booking.body);
    appointmentId=booking.json().appointment.id;
    assert.equal(booking.json().appointment.priceCents,7200);
    assert.equal(booking.json().appointment.status,'CONFIRMADO');

    const duplicate=await Promise.all([manual({cookie:admin}),app.inject({
      method:'POST',url:'/api/v1/appointments',headers:{cookie:client},
      payload:{serviceId,professionalId:proId,startsAt:slot.startsAt},
    })]);
    assert.deepEqual(duplicate.map(x=>x.statusCode),[409,409]);
    const listing=await app.inject({method:'GET',url:path,headers:{cookie:admin}});
    assert.equal(listing.statusCode,200,listing.body);
    assert.equal(listing.json().total,1);
    assert.equal(listing.json().counts[0].status,'CONFIRMADO');
    assert.equal(listing.json().appointments[0].clientId,clientId);
    assert.equal(listing.json().appointments[0].clientName,'Cliente da agenda');
    assert.ok(!listing.body.includes('password_hash'));
    const filtered=await app.inject({method:'GET',
      url:path+'&status=CONFIRMADO&offset=0',
      headers:{cookie:admin}});
    assert.equal(filtered.statusCode,200,filtered.body);
    assert.equal(filtered.json().total,1);
    const otherPro=await app.inject({method:'GET',
      url:path.replace(`professionalId=${proId}`,`professionalId=${randomUUID()}`),headers:{cookie:admin}});
    assert.equal(otherPro.json().total,0);
    assert.equal((await app.inject({method:'GET',
      url:path+'&status=INVALIDO',headers:{cookie:admin}})).statusCode,400);

    const statusPath=`/api/v1/admin/appointments/${appointmentId}/status`;
    const change=(auth:string,status:string,id=appointmentId)=>app.inject({
      method:'PATCH',
      url:`/api/v1/admin/appointments/${id}/status`,
      headers:{cookie:auth},payload:{status},
    });
    assert.equal((await change(client,'CANCELADO')).statusCode,403);
    assert.equal((await change(admin,'CONCLUIDO')).statusCode,409,'não pode concluir antes do término');
    assert.equal((await change(admin,'CONFIRMADO')).statusCode,409,'confirmação duplicada');
    assert.equal((await change(admin,'CANCELADO',randomUUID())).statusCode,404);
    const canceled=await change(admin,'CANCELADO');
    assert.equal(canceled.statusCode,200,canceled.body);
    assert.equal(canceled.json().appointment.status,'CANCELADO');
    assert.equal((await change(admin,'CANCELADO')).statusCode,409);
    const recovered=await app.inject({method:'GET',
      url:`/api/v1/availability/slots?serviceId=${serviceId}&professionalId=${proId}&date=${date}`});
    assert.ok(recovered.json().slots.some((s:{startsAt:string})=>s.startsAt===slot.startsAt));

    const again=await manual({cookie:admin});
    assert.equal(again.statusCode,201,again.body);
    secondAppointmentId=again.json().appointment.id;
    await pool.query("UPDATE appointments SET status='PENDENTE' WHERE id=$1",[secondAppointmentId]);
    assert.equal((await change(admin,'CONFIRMADO',secondAppointmentId)).statusCode,200);
    await pool.query(
      `UPDATE appointments SET starts_at=now()-interval '3 days',
       ends_at=now()-interval '3 days'+interval '30 minutes'
       WHERE id=$1`,[secondAppointmentId],
    );
    const completed=await change(admin,'CONCLUIDO',secondAppointmentId);
    assert.equal(completed.statusCode,200,completed.body);
    assert.equal(completed.json().appointment.status,'CONCLUIDO');
    assert.equal((await change(admin,'CANCELADO',secondAppointmentId)).statusCode,409);
    const audits=await pool.query<{count:number}>(
      "SELECT count(*)::int AS count FROM audit_events WHERE entity_id=ANY($1::uuid[])",
      [[appointmentId,secondAppointmentId]],
    );
    assert.ok(audits.rows[0].count>=4,'transições auditadas');
  }finally{
    await pool.query('DELETE FROM audit_events WHERE actor_id=ANY($1::uuid[])',
      [[adminId,clientId,staffId]]);
    await pool.query('DELETE FROM appointments WHERE professional_id=$1',[proId]);
    await pool.query('DELETE FROM availabilities WHERE professional_id=$1',[proId]);
    await pool.query('DELETE FROM professional_services WHERE professional_id=$1',[proId]);
    await pool.query('DELETE FROM professionals WHERE id=$1',[proId]);
    await pool.query('DELETE FROM services WHERE id=$1',[serviceId]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',
      [[adminId,clientId,staffId]]);
    await app.close();
  }
});
