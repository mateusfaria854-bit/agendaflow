import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {database} from '../src/db/client.js';
import {createApp} from '../src/app.js';
import {provisionStaffAccount,ProvisioningError} from '../src/modules/staff/provision.js';
import {hashPassword} from '../src/modules/auth/password.js';
import {getBusinessDay} from '../src/modules/availability/domain.js';

function cookie(response:{headers:Record<string,unknown>}):string{
  const v=response.headers['set-cookie'];
  return String(Array.isArray(v)?v[0]:v).split(';')[0];
}

test('Área profissional: vínculo seguro, isolamento da agenda e privacidade',{skip:!process.env.DATABASE_URL},async()=>{
  const db=database(),app=createApp();
  const pro1=randomUUID(),pro2=randomUUID(),unlinked=randomUUID(),service=randomUUID(),client=randomUUID(),admin=randomUUID();
  const accountIds:string[]=[];
  const reservationIds:string[]=[];
  const date=getBusinessDay(Date.now()+10*86_400_000,'America/Sao_Paulo');
  const startsAt=date+'T13:00:00Z',endsAt=date+'T13:30:00Z';
  const authPassword='senha-forte-para-profissional-123';
  const email1='prof-'+pro1+'@example.invalid',email2='prof-'+pro2+'@example.invalid';
  try{
    await db.query('INSERT INTO professionals(id,name) VALUES($1,$2),($3,$4)',
      [pro1,'Equipe Alfa',pro2,'Equipe Beta']);
    const bad=provisionStaffAccount({
      professionalId:pro1,name:'Equipe Alfa',email:email1,password:'123',
    });
    await assert.rejects(bad,(error:unknown)=>error instanceof ProvisioningError&&error.kind==='INVALID');
    const first=await provisionStaffAccount({
      professionalId:pro1,name:'Profissional Alfa',email:email1,password:authPassword,
    });
    accountIds.push(first.id);
    assert.equal(first.professionalId,pro1);
    assert.equal(first.email,email1);
    await assert.rejects(provisionStaffAccount({
      professionalId:pro1,name:'Outro vínculo',email:'outro@example.invalid',password:authPassword,
    }),error=>error instanceof ProvisioningError&&error.kind==='CONFLICT');
    await assert.rejects(provisionStaffAccount({
      professionalId:pro2,name:'Duplicado',email:email1,password:authPassword,
    }),error=>error instanceof ProvisioningError&&error.kind==='CONFLICT');
    const notLinkedYet=await db.query<{user_id:string|null}>('SELECT user_id FROM professionals WHERE id=$1',[pro2]);
    assert.equal(notLinkedYet.rows[0].user_id,null,'falha não deve deixar vínculo parcial');
    const second=await provisionStaffAccount({
      professionalId:pro2,name:'Profissional Beta',email:email2,password:authPassword,
    });
    accountIds.push(second.id);
    const hash=await hashPassword(authPassword);
    await db.query(
      "INSERT INTO users(id,name,email,password_hash,role) VALUES($1,'Staff sem vínculo',$2,$3,'PROFISSIONAL'),($4,'Cliente teste',$5,$3,'CLIENTE'),($6,'Admin teste',$7,$3,'ADMIN')",
      [unlinked,'staff-unlinked-'+unlinked+'@example.invalid',hash,
       client,'client-staff-'+client+'@example.invalid',admin,'admin-staff-'+admin+'@example.invalid'],
    );
    accountIds.push(unlinked,client,admin);
    await db.query("INSERT INTO services(id,name,duration_minutes,price_cents) VALUES($1,'Corte básico',30,9000)",[service]);
    const a=await db.query<{id:string}>(
      "INSERT INTO appointments(client_id,professional_id,service_id,starts_at,ends_at,price_cents,status) VALUES($1,$2,$3,$4,$5,9000,'CONFIRMADO') RETURNING id",
      [client,pro1,service,startsAt,endsAt],
    );
    reservationIds.push(a.rows[0].id);
    const b=await db.query<{id:string}>(
      "INSERT INTO appointments(client_id,professional_id,service_id,starts_at,ends_at,price_cents,status) VALUES($1,$2,$3,$4,$5,9000,'CANCELADO') RETURNING id",
      [client,pro2,service,startsAt,endsAt],
    );
    reservationIds.push(b.rows[0].id);
    async function login(email:string){
      const response=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email,password:authPassword}});
      assert.equal(response.statusCode,200,response.body);
      return cookie(response);
    }
    const [s1,s2,s0,clientCookie,adminCookie]=await Promise.all([
      login(email1),login(email2),login('staff-unlinked-'+unlinked+'@example.invalid'),
      login('client-staff-'+client+'@example.invalid'),login('admin-staff-'+admin+'@example.invalid'),
    ]);
    const adminProfessionals=await app.inject({
      url:'/api/v1/admin/professionals',headers:{cookie:adminCookie},
    });
    assert.equal(adminProfessionals.statusCode,200,adminProfessionals.body);
    const adminRecord=adminProfessionals.json().professionals.find((p:{id:string})=>p.id===pro1);
    assert.equal(adminRecord.hasAccount,true);
    const publicProfessionals=await app.inject({url:'/api/v1/professionals'});
    assert.equal(publicProfessionals.statusCode,200,publicProfessionals.body);
    const publicRecord=publicProfessionals.json().professionals.find((p:{id:string})=>p.id===pro1);
    assert.ok(!Object.hasOwn(publicRecord,'hasAccount'),'catálogo público não revela status de conta');
    const path='/api/v1/staff/appointments?from='+date+'&to='+date;
    assert.equal((await app.inject({url:'/api/v1/staff/me'})).statusCode,401);
    assert.equal((await app.inject({url:path})).statusCode,401);
    assert.equal((await app.inject({url:path,headers:{cookie:clientCookie}})).statusCode,403);
    assert.equal((await app.inject({url:path,headers:{cookie:adminCookie}})).statusCode,403);
    assert.equal((await app.inject({url:path,headers:{cookie:s0}})).statusCode,404);
    assert.equal((await app.inject({url:'/api/v1/staff/me',headers:{cookie:s0}})).statusCode,404);
    const own=await app.inject({url:'/api/v1/staff/me',headers:{cookie:s1}});
    assert.equal(own.statusCode,200);
    assert.deepEqual(own.json().professional,{id:pro1,name:'Equipe Alfa'});
    const list=await app.inject({url:path,headers:{cookie:s1}});
    assert.equal(list.statusCode,200,list.body);
    assert.equal(list.json().total,1);
    assert.equal(list.json().appointments[0].id,a.rows[0].id);
    assert.equal(list.json().appointments[0].clientName,'Cliente teste');
    for(const forbidden of ['clientEmail','priceCents','password_hash','clientId','professionalId']){
      assert.ok(!list.body.includes(forbidden),forbidden+' não pode ser exposto');
    }
    const beta=await app.inject({url:path,headers:{cookie:s2}});
    assert.equal(beta.statusCode,200,beta.body);
    assert.equal(beta.json().total,1);
    assert.equal(beta.json().appointments[0].id,b.rows[0].id);
    const filtered=await app.inject({url:path+'&status=CANCELADO',headers:{cookie:s1}});
    assert.equal(filtered.json().total,0);
    const betaFiltered=await app.inject({url:path+'&status=CANCELADO',headers:{cookie:s2}});
    assert.equal(betaFiltered.json().total,1);
    const emptyPage=await app.inject({url:path+'&offset=100',headers:{cookie:s1}});
    assert.equal(emptyPage.statusCode,200);
    assert.equal(emptyPage.json().appointments.length,0);
    assert.equal(emptyPage.json().total,1);
    assert.equal((await app.inject({url:path+'&professionalId='+pro2,headers:{cookie:s1}})).statusCode,400);
    assert.equal((await app.inject({url:path+'&status=ATIVO',headers:{cookie:s1}})).statusCode,400);
    assert.equal((await app.inject({url:'/api/v1/staff/appointments?from=2035-02-30&to=2035-02-30',headers:{cookie:s1}})).statusCode,400);
    assert.equal((await app.inject({url:'/api/v1/staff/appointments?from=2026-01-01&to=2026-03-01',headers:{cookie:s1}})).statusCode,400);
    assert.equal((await app.inject({url:'/api/v1/admin/clients?query=Cli',headers:{cookie:s1}})).statusCode,403);
    const publicRegister=await app.inject({method:'POST',url:'/api/v1/auth/register',
      payload:{name:'Auto staff',email:'auto-'+randomUUID()+'@example.invalid',password:authPassword,role:'PROFISSIONAL'}});
    assert.equal(publicRegister.statusCode,400);
    await db.query('UPDATE professionals SET active=false WHERE id=$1',[pro1]);
    assert.equal((await app.inject({url:'/api/v1/staff/me',headers:{cookie:s1}})).statusCode,404);
    assert.equal((await app.inject({url:path,headers:{cookie:s1}})).statusCode,404);
  }finally{
    await db.query('DELETE FROM appointments WHERE id=ANY($1::uuid[])',[reservationIds]);
    await db.query('DELETE FROM audit_events WHERE entity_type=$1 AND entity_id=ANY($2::uuid[])',['professional',[pro1,pro2]]);
    await db.query('DELETE FROM professionals WHERE id=ANY($1::uuid[])',[[pro1,pro2]]);
    await db.query('DELETE FROM services WHERE id=$1',[service]);
    await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[accountIds]);
    await app.close();
  }
});
