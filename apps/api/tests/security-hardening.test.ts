import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createApp} from '../src/app.js';

test('API não armazena respostas sensíveis em cache e envia cabeçalhos de proteção',async()=>{
  const app=createApp({databaseCheck:async()=>true});
  try{
    const health=await app.inject({method:'GET',url:'/api/v1/health'});
    assert.equal(health.statusCode,200);
    assert.equal(health.headers['cache-control'],'no-store');
    assert.equal(health.headers['x-content-type-options'],'nosniff');
    assert.equal(health.headers['x-frame-options'],'DENY');
    assert.equal(health.headers['referrer-policy'],'no-referrer');
    assert.equal(health.headers['permissions-policy'],'camera=(), microphone=(), geolocation=(), payment=()');
    assert.equal(health.headers['strict-transport-security'],undefined);
  }finally{await app.close()}
});

test('tentativas cross-origin com Origin externo são bloqueadas antes de tocar no banco',async()=>{
  const app=createApp({databaseCheck:async()=>true});
  try{
    const blocked=await app.inject({
      method:'POST',url:'/api/v1/auth/logout',
      headers:{origin:'https://dominio-nao-autorizado.example',host:'127.0.0.1:3333'},
    });
    assert.equal(blocked.statusCode,403);
    assert.equal(blocked.headers['cache-control'],'no-store');
  }finally{await app.close()}
});

test('em produção HTTPS API envia HSTS sem impor preload no domínio público',async()=>{
  const oldNode=process.env.NODE_ENV;
  const oldOrigin=process.env.WEB_ORIGIN;
  process.env.NODE_ENV='production';
  process.env.WEB_ORIGIN='https://agendaflow-web-production.up.railway.app';
  try{
    const app=createApp({databaseCheck:async()=>true});
    try {
      const response=await app.inject({method:'GET',url:'/api/v1/health'});
      assert.equal(response.statusCode,200);
      assert.equal(response.headers['strict-transport-security'],'max-age=15552000');
      assert.equal(response.headers['permissions-policy'],'camera=(), microphone=(), geolocation=(), payment=()');
    }finally{await app.close()}
  }finally{
    if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;
    if(oldOrigin===undefined)delete process.env.WEB_ORIGIN;else process.env.WEB_ORIGIN=oldOrigin;
  }
});
