import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {database} from '../src/db/client.js';
import {createApp} from '../src/app.js';
import {hashPassword} from '../src/modules/auth/password.js';
import {getBusinessDay} from '../src/modules/availability/domain.js';

function cookie(response:{headers:Record<string,unknown>}):string{
  const header=response.headers['set-cookie'];
  return String(Array.isArray(header)?header[0]:header).split(';')[0];
}

test('Fase 3: criar, listar, cancelar e impedir dupla reserva', {skip:!process.env.DATABASE_URL},async()=>{
  const pool=database(), app=createApp();
  const clientIds=[randomUUID(),randomUUID()],adminId=randomUUID();
  const professionalId=randomUUID(),serviceId=randomUUID(),otherServiceId=randomUUID();
  const date=getBusinessDay(Date.now()+10*24*60*60_000,'America/Sao_Paulo');
  const weekday=new Date(date+'T00:00:00Z').getUTCDay();
  let appointmentId:string|undefined;
  let secondAppointmentId:string|undefined;
  try{
    const hash=await hashPassword('senha-segura-fase3-concorrencia');
    for(const [i,id] of clientIds.entries()){
      await pool.query(`INSERT INTO users(id,name,email,password_hash,role)
        VALUES($1,$2,$3,$4,'CLIENTE')`,
      [id,`Cliente ${i+1}`,`reserva-${id}@example.invalid`,hash]);
    }
    await pool.query(`INSERT INTO users(id,name,email,password_hash,role)
       VALUES($1,'Administrador', $2, $3,'ADMIN')`,
      [adminId,`admin-reserva-${adminId}@example.invalid`,hash]);
    await pool.query('INSERT INTO services(id,name,duration_minutes,price_cents) VALUES($1,$2,30,6700)',
      [serviceId,'Serviço para agendamento']);
    await pool.query('INSERT INTO services(id,name,duration_minutes,price_cents) VALUES($1,$2,30,3500)',
      [otherServiceId,'Serviço sem vínculo']);
    await pool.query('INSERT INTO professionals(id,name) VALUES($1,$2)',[professionalId,'Profissional Reserva']);
    await pool.query('INSERT INTO professional_services(professional_id,service_id) VALUES($1,$2)',[professionalId,serviceId]);
    for(const [start,end] of [['09:00','12:00'],['13:00','18:00']]){
      await pool.query('INSERT INTO availabilities(professional_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4)',
        [professionalId,weekday,start,end]);
    }
    const users=await Promise.all([...clientIds,adminId].map(async id=>{
      const login=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{
        email:id===adminId?`admin-reserva-${id}@example.invalid`:`reserva-${id}@example.invalid`,
        password:'senha-segura-fase3-concorrencia',
      }});
      assert.equal(login.statusCode,200,login.body);
      return cookie(login);
    }));
    const [first,second,admin]=users;
    const available=await app.inject({method:'GET',
      url:`/api/v1/availability/slots?professionalId=${professionalId}&serviceId=${serviceId}&date=${date}`});
    assert.equal(available.statusCode,200,available.body);
    const firstSlot=available.json().slots[0] as {startsAt:string;endsAt:string};
    assert.ok(firstSlot);
    const body={professionalId,serviceId,startsAt:firstSlot.startsAt};
    const create=(auth?:string,payload:Record<string,unknown>=body)=>app.inject({
      method:'POST',url:'/api/v1/appointments',
      ...(auth?{headers:{cookie:auth}}:{}),payload,
    });

    assert.equal((await create()).statusCode,401,'visitante não agenda');
    assert.equal((await create(admin)).statusCode,403,'admin não pode reservar como cliente');
    assert.equal((await create(first,{...body,priceCents:1})).statusCode,400,'preço enviado pelo cliente deve ser rejeitado');
    assert.equal((await create(first,{...body,startsAt:'2020-01-01T09:00:00.000Z'})).statusCode,400,'passado inválido');
    assert.equal((await create(first,{...body,serviceId:otherServiceId})).statusCode,404,'vínculo serviço-profissional obrigatório');
    assert.equal((await create(first,{...body,startsAt:'2035-02-30T09:00:00.000Z'})).statusCode,400,'data inválida');

    const simultaneous=await Promise.all([create(first),create(second)]);
    assert.deepEqual(simultaneous.map(x=>x.statusCode).sort(),[201,409],
      'apenas um dos clientes pode reservar o mesmo slot');
    const success=simultaneous.find(x=>x.statusCode===201)!;
    const winner=simultaneous[0].statusCode===201?first:second;
    const loser=simultaneous[0].statusCode===201?second:first;
    const winnerId=simultaneous[0].statusCode===201?clientIds[0]:clientIds[1];
    appointmentId=success.json().appointment.id;
    assert.equal(success.json().appointment.priceCents,6700,'preço vem do banco');
    assert.equal(success.json().appointment.status,'CONFIRMADO');
    assert.equal(success.json().appointment.endsAt,firstSlot.endsAt);

    const count=await pool.query<{count:number}>(`SELECT count(*)::int AS count FROM appointments
      WHERE professional_id=$1 AND status='CONFIRMADO'`,[professionalId]);
    assert.equal(count.rows[0].count,1);
    const mine=await app.inject({method:'GET',url:'/api/v1/appointments/mine',headers:{cookie:winner}});
    assert.equal(mine.statusCode,200);
    assert.ok(mine.json().appointments.some((a:{id:string})=>a.id===appointmentId));
    assert.ok(!mine.body.includes('password_hash'));
    assert.ok(!mine.body.includes('client_id'));

    const others=await app.inject({method:'GET',url:'/api/v1/appointments/mine',headers:{cookie:loser}});
    assert.equal(others.statusCode,200);
    assert.ok(!others.json().appointments.some((a:{id:string})=>a.id===appointmentId));
    assert.equal((await app.inject({method:'GET',url:'/api/v1/appointments/mine'})).statusCode,401);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/appointments/mine',headers:{cookie:admin}})).statusCode,403);
    const cancel=(auth:string,id:string)=>app.inject({method:'PATCH',
      url:`/api/v1/appointments/${id}/cancel`,headers:{cookie:auth}});
    assert.equal((await cancel(loser,appointmentId)).statusCode,404,'outro cliente não pode cancelar');
    assert.equal((await cancel(admin,appointmentId)).statusCode,403);
    assert.equal((await cancel(winner,randomUUID())).statusCode,404);
    const canceled=await cancel(winner,appointmentId);
    assert.equal(canceled.statusCode,200,canceled.body);
    assert.equal(canceled.json().appointment.status,'CANCELADO');
    assert.equal((await cancel(winner,appointmentId)).statusCode,409,'cancelamento repetido não modifica');
    const freed=await app.inject({method:'GET',
      url:`/api/v1/availability/slots?professionalId=${professionalId}&serviceId=${serviceId}&date=${date}`});
    assert.ok(freed.json().slots.some((s:{startsAt:string})=>s.startsAt===firstSlot.startsAt));
    const newBooking=await create(loser);
    assert.equal(newBooking.statusCode,201,newBooking.body);
    secondAppointmentId=newBooking.json().appointment.id;
    assert.notEqual(secondAppointmentId,appointmentId);
    assert.equal((await create(winner)).statusCode,409,'slot volta a ficar ocupado');
    const dbClient=await pool.query<{client_id:string;price_cents:number;status:string}>(
      'SELECT client_id,price_cents,status FROM appointments WHERE id=$1',[secondAppointmentId]);
    assert.notEqual(dbClient.rows[0].client_id,winnerId);
    assert.equal(dbClient.rows[0].price_cents,6700);
    assert.equal(dbClient.rows[0].status,'CONFIRMADO');
  }finally{
    await pool.query('DELETE FROM audit_events WHERE actor_id=ANY($1::uuid[])',[[...clientIds,adminId]]);
    await pool.query('DELETE FROM appointments WHERE professional_id=$1',[professionalId]);
    await pool.query('DELETE FROM availabilities WHERE professional_id=$1',[professionalId]);
    await pool.query('DELETE FROM professional_services WHERE professional_id=$1',[professionalId]);
    await pool.query('DELETE FROM professionals WHERE id=$1',[professionalId]);
    await pool.query('DELETE FROM services WHERE id=ANY($1::uuid[])',[[serviceId,otherServiceId]]);
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[...clientIds,adminId]]);
    await app.close();
  }
});
