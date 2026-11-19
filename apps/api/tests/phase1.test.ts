import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {database} from '../src/db/client.js';
import {createApp} from '../src/app.js';
import {hashPassword} from '../src/modules/auth/password.js';

function cookie(response: {headers: Record<string, unknown>}): string {
  const value=response.headers['set-cookie'];
  const first=Array.isArray(value)?value[0]:String(value??'');
  return first.split(';')[0];
}

test('integração: cadastro, sessão, autorização e catálogo', {skip:!process.env.DATABASE_URL}, async() => {
  const app=createApp();
  const ids:{user?:string;admin?:string;service?:string;professional?:string}={};
  const email=`cliente-${randomUUID()}@example.invalid`;
  const adminEmail=`admin-${randomUUID()}@example.invalid`;
  const pool=database();
  try {
    const payload={name:'Cliente Teste',email,password:'senha-segura-para-teste-123'};
    const badRole=await app.inject({
      method:'POST',url:'/api/v1/auth/register',
      payload:{...payload,email:`wrong-${email}`,role:'ADMIN'},
    });
    assert.equal(badRole.statusCode,400,'registro não aceita role fornecida pelo cliente');

    const registered=await app.inject({method:'POST',url:'/api/v1/auth/register',payload});
    assert.equal(registered.statusCode,201,registered.body);
    ids.user=registered.json().user.id;
    assert.equal(registered.json().user.role,'CLIENTE');
    assert.ok(!registered.body.includes('password_hash'));
    const clientCookie=cookie(registered);
    assert.match(clientCookie,/^agendaflow_session=[a-zA-Z0-9_-]{43}$/);
    assert.match(String(registered.headers['set-cookie']),/HttpOnly/);

    const duplicate=await app.inject({method:'POST',url:'/api/v1/auth/register',payload});
    assert.equal(duplicate.statusCode,409);
    const anonymous=await app.inject({method:'GET',url:'/api/v1/auth/me'});
    assert.equal(anonymous.statusCode,401);

    const me=await app.inject({method:'GET',url:'/api/v1/auth/me',headers:{cookie:clientCookie}});
    assert.equal(me.statusCode,200);
    assert.equal(me.json().user.email,email);
    assert.equal(me.json().user.role,'CLIENTE');

    const deniedAnon=await app.inject({method:'POST',url:'/api/v1/services',payload:{name:'Novo serviço',durationMinutes:30,priceCents:4500}});
    assert.equal(deniedAnon.statusCode,401);
    const deniedClient=await app.inject({method:'POST',url:'/api/v1/services',headers:{cookie:clientCookie},payload:{name:'Novo serviço',durationMinutes:30,priceCents:4500}});
    assert.equal(deniedClient.statusCode,403);
    const wrongOrigin=await app.inject({method:'POST',url:'/api/v1/auth/logout',headers:{cookie:clientCookie,origin:'https://malicioso.example'}});
    assert.equal(wrongOrigin.statusCode,403);
    const stillAuthenticated=await app.inject({method:'GET',url:'/api/v1/auth/me',headers:{cookie:clientCookie}});
    assert.equal(stillAuthenticated.statusCode,200);

    const badPass=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email,password:'senha-incorreta'}});
    assert.equal(badPass.statusCode,401);
    const logged=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email,password:payload.password}});
    assert.equal(logged.statusCode,200);
    const loggedCookie=cookie(logged);
    assert.notEqual(loggedCookie,clientCookie,'login gera nova sessão');
    const logout=await app.inject({method:'POST',url:'/api/v1/auth/logout',headers:{cookie:loggedCookie}});
    assert.equal(logout.statusCode,204);
    assert.match(String(logout.headers['set-cookie']),/Max-Age=0/);
    const afterLogout=await app.inject({method:'GET',url:'/api/v1/auth/me',headers:{cookie:loggedCookie}});
    assert.equal(afterLogout.statusCode,401);
    await app.inject({method:'POST',url:'/api/v1/auth/logout',headers:{cookie:clientCookie}});

    const adminHash=await hashPassword('senha-administrador-para-teste');
    const result=await pool.query<{id:string}>(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'ADMIN') RETURNING id",
      ['Admin Teste',adminEmail,adminHash],
    );
    ids.admin=result.rows[0].id;
    const loginAdmin=await app.inject({method:'POST',url:'/api/v1/auth/login',payload:{email:adminEmail,password:'senha-administrador-para-teste'}});
    assert.equal(loginAdmin.statusCode,200);
    const adminCookie=cookie(loginAdmin);

    const invalidService=await app.inject({method:'POST',url:'/api/v1/services',headers:{cookie:adminCookie},payload:{name:'Inválido',durationMinutes:2,priceCents:-1}});
    assert.equal(invalidService.statusCode,400);
    const createdService=await app.inject({method:'POST',url:'/api/v1/services',headers:{cookie:adminCookie},payload:{name:'Atendimento Teste',durationMinutes:40,priceCents:5000}});
    assert.equal(createdService.statusCode,201,createdService.body);
    ids.service=createdService.json().service.id;
    const publicServices=await app.inject({method:'GET',url:'/api/v1/services'});
    assert.equal(publicServices.statusCode,200);
    assert.ok(publicServices.json().services.some((s:{id:string})=>s.id===ids.service));

    const createdProfessional=await app.inject({method:'POST',url:'/api/v1/professionals',headers:{cookie:adminCookie},payload:{name:'Profissional Teste',serviceIds:[ids.service]}});
    assert.equal(createdProfessional.statusCode,201,createdProfessional.body);
    ids.professional=createdProfessional.json().professional.id;
    const publicPros=await app.inject({method:'GET',url:'/api/v1/professionals'});
    assert.ok(publicPros.json().professionals.some((p:{id:string;services:{id:string}[]})=>p.id===ids.professional&&p.services.some(s=>s.id===ids.service)));

    const inactive=await app.inject({method:'PATCH',url:`/api/v1/services/${ids.service}`,headers:{cookie:adminCookie},payload:{active:false}});
    assert.equal(inactive.statusCode,200);
    const afterInactive=await app.inject({method:'GET',url:'/api/v1/services'});
    assert.ok(!afterInactive.json().services.some((s:{id:string})=>s.id===ids.service));
    const cannotLink=await app.inject({method:'PATCH',url:`/api/v1/professionals/${ids.professional}`,headers:{cookie:adminCookie},payload:{serviceIds:[ids.service]}});
    assert.equal(cannotLink.statusCode,400);
    const disablePro=await app.inject({method:'PATCH',url:`/api/v1/professionals/${ids.professional}`,headers:{cookie:adminCookie},payload:{active:false,serviceIds:[]}});
    assert.equal(disablePro.statusCode,200);
    const adminList=await app.inject({method:'GET',url:'/api/v1/admin/services',headers:{cookie:adminCookie}});
    assert.ok(adminList.json().services.some((s:{id:string;active:boolean})=>s.id===ids.service&&!s.active));
  } finally {
    if (ids.professional) await pool.query('DELETE FROM professionals WHERE id=$1',[ids.professional]);
    if (ids.service) await pool.query('DELETE FROM services WHERE id=$1',[ids.service]);
    if (ids.user) await pool.query('DELETE FROM users WHERE id=$1',[ids.user]);
    if (ids.admin) await pool.query('DELETE FROM users WHERE id=$1',[ids.admin]);
    await app.close();
  }
});
