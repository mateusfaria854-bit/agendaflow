import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {database} from '../src/db/client.js';
import {createApp} from '../src/app.js';
import {hashPassword} from '../src/modules/auth/password.js';
import {getBusinessDay} from '../src/modules/availability/domain.js';

function cookie(reply:{headers:Record<string,unknown>}):string{
  const all=reply.headers['set-cookie'];
  return String(Array.isArray(all)?all[0]:all).split(';')[0];
}

test('Fase 2: validações, horários, bloqueios, autorização e reservas', {skip:!process.env.DATABASE_URL},async()=>{
  const db=database();
  const app=createApp();
  const adminId=randomUUID(), clientId=randomUUID(), serviceId=randomUUID(), professionalId=randomUUID();
  const date=getBusinessDay(Date.now()+12*24*60*60_000,'America/Sao_Paulo');
  const weekday=new Date(date+'T00:00:00Z').getUTCDay();
  const base='/api/v1';
  const params=`?professionalId=${professionalId}&serviceId=${serviceId}&date=${date}`;
  let blockId:string|undefined;
  try{
    const passwordHash=await hashPassword('senha-segura-para-esta-suite');
    await db.query(
      `INSERT INTO users(id,name,email,password_hash,role) VALUES
        ($1,'Admin Fase 2',$3,$5,'ADMIN'),($2,'Cliente Fase 2',$4,$5,'CLIENTE')`,
      [adminId,clientId,`admin2-${adminId}@example.invalid`,`cliente2-${clientId}@example.invalid`,passwordHash],
    );
    const adminLogin=await app.inject({method:'POST',url:base+'/auth/login',payload:{
      email:`admin2-${adminId}@example.invalid`,password:'senha-segura-para-esta-suite',
    }});
    assert.equal(adminLogin.statusCode,200,adminLogin.body);
    const adminCookie=cookie(adminLogin);
    const clientLogin=await app.inject({method:'POST',url:base+'/auth/login',payload:{
      email:`cliente2-${clientId}@example.invalid`,password:'senha-segura-para-esta-suite',
    }});
    assert.equal(clientLogin.statusCode,200,clientLogin.body);
    const clientCookie=cookie(clientLogin);

    await db.query('INSERT INTO services(id,name,duration_minutes,price_cents) VALUES($1,$2,30,5000)',[serviceId,'Serviço Fase 2']);
    await db.query('INSERT INTO professionals(id,name) VALUES($1,$2)',[professionalId,'Profissional Fase 2']);
    await db.query('INSERT INTO professional_services(professional_id,service_id) VALUES($1,$2)',[professionalId,serviceId]);

    const listBefore=await app.inject({method:'GET',url:base+'/availability/slots'+params});
    assert.equal(listBefore.statusCode,200,listBefore.body);
    assert.deepEqual(listBefore.json().slots,[]);
    const noAuth=await app.inject({method:'PUT',url:`${base}/admin/professionals/${professionalId}/availability`,
      payload:{windows:[]}});
    assert.equal(noAuth.statusCode,401);
    const denied=await app.inject({method:'PUT',url:`${base}/admin/professionals/${professionalId}/availability`,
      headers:{cookie:clientCookie},payload:{windows:[]}});
    assert.equal(denied.statusCode,403);
    const overlapping=await app.inject({method:'PUT',url:`${base}/admin/professionals/${professionalId}/availability`,
      headers:{cookie:adminCookie},payload:{windows:[
        {weekday,startTime:'09:00',endTime:'12:00'},
        {weekday,startTime:'11:00',endTime:'13:00'},
      ]}});
    assert.equal(overlapping.statusCode,400,overlapping.body);
    const configured=await app.inject({method:'PUT',url:`${base}/admin/professionals/${professionalId}/availability`,
      headers:{cookie:adminCookie},payload:{windows:[
        {weekday,startTime:'09:00',endTime:'12:00'},
        {weekday,startTime:'13:00',endTime:'18:00'},
      ]}});
    assert.equal(configured.statusCode,200,configured.body);
    const adminView=await app.inject({method:'GET',
      url:`${base}/admin/availability?professionalId=${professionalId}`,
      headers:{cookie:adminCookie}});
    assert.equal(adminView.statusCode,200);
    assert.equal(adminView.json().windows.length,2);
    assert.equal(adminView.json().timezone,'America/Sao_Paulo');

    const initial=await app.inject({method:'GET',url:base+'/availability/slots'+params});
    assert.equal(initial.statusCode,200,initial.body);
    assert.equal(initial.json().slots.length,30);
    assert.ok(initial.json().slots.some((s:{label:string})=>s.label==='09:00'));
    assert.ok(!initial.json().slots.some((s:{label:string})=>s.label==='12:00'));
    const invalidDate=await app.inject({method:'GET',
      url:`${base}/availability/slots?professionalId=${professionalId}&serviceId=${serviceId}&date=2035-02-30`});
    assert.equal(invalidDate.statusCode,400);

    const blocked=await app.inject({method:'POST',url:base+'/admin/blocked-periods',
      headers:{cookie:adminCookie},
      payload:{professionalId,startsAt:`${date}T10:00:00-03:00`,
        endsAt:`${date}T11:00:00-03:00`,reason:'Pausa interna de teste'}});
    assert.equal(blocked.statusCode,201,blocked.body);
    blockId=blocked.json().blockedPeriod.id;
    const duplicate=await app.inject({method:'POST',url:base+'/admin/blocked-periods',
      headers:{cookie:adminCookie},
      payload:{professionalId,startsAt:`${date}T10:30:00-03:00`,
        endsAt:`${date}T11:30:00-03:00`}});
    assert.equal(duplicate.statusCode,409,duplicate.body);
    const afterBlock=await app.inject({method:'GET',url:base+'/availability/slots'+params});
    const labels=(afterBlock.json().slots as Array<{label:string}>).map(x=>x.label);
    assert.ok(labels.includes('09:30'));
    for(const missing of ['09:45','10:00','10:15','10:30','10:45']) assert.ok(!labels.includes(missing),missing);
    assert.ok(labels.includes('11:00'));
    const removed=await app.inject({method:'DELETE',url:`${base}/admin/blocked-periods/${blockId}`,headers:{cookie:adminCookie}});
    assert.equal(removed.statusCode,204,removed.body);
    blockId=undefined;
    const recovered=await app.inject({method:'GET',url:base+'/availability/slots'+params});
    assert.equal(recovered.json().slots.length,30);

    const booked=await db.query<{id:string}>(`INSERT INTO appointments
       (client_id,professional_id,service_id,starts_at,ends_at,price_cents,status)
       VALUES($1,$2,$3,$4,$5,5000,'CONFIRMADO') RETURNING id`,
      [clientId,professionalId,serviceId,`${date}T10:00:00-03:00`,`${date}T10:30:00-03:00`]);
    assert.equal(booked.rowCount,1);
    const postBooking=await app.inject({method:'GET',url:base+'/availability/slots'+params});
    assert.ok(!postBooking.json().slots.some((s:{label:string})=>s.label==='10:00'));
    const updateDenied=await app.inject({method:'PUT',url:`${base}/admin/professionals/${professionalId}/availability`,
      headers:{cookie:adminCookie},payload:{windows:[]}});
    assert.equal(updateDenied.statusCode,409);
    const blockedBooked=await app.inject({method:'POST',url:base+'/admin/blocked-periods',
      headers:{cookie:adminCookie},payload:{professionalId,startsAt:`${date}T10:00:00-03:00`,
        endsAt:`${date}T11:00:00-03:00`}});
    assert.equal(blockedBooked.statusCode,409);
    await db.query('DELETE FROM appointments WHERE client_id=$1 AND professional_id=$2',[clientId,professionalId]);
    const clearSchedule=await app.inject({method:'PUT',url:`${base}/admin/professionals/${professionalId}/availability`,
      headers:{cookie:adminCookie},payload:{windows:[]}});
    assert.equal(clearSchedule.statusCode,200);
  }finally{
    if(blockId)await db.query('DELETE FROM blocked_periods WHERE id=$1',[blockId]);
    await db.query('DELETE FROM appointments WHERE professional_id=$1',[professionalId]);
    await db.query('DELETE FROM blocked_periods WHERE professional_id=$1',[professionalId]);
    await db.query('DELETE FROM availabilities WHERE professional_id=$1',[professionalId]);
    await db.query('DELETE FROM professional_services WHERE professional_id=$1',[professionalId]);
    await db.query('DELETE FROM professionals WHERE id=$1',[professionalId]);
    await db.query('DELETE FROM services WHERE id=$1',[serviceId]);
    await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[adminId,clientId]]);
    await app.close();
  }
});
