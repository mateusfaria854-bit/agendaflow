import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createApp} from '../src/app.js';

test('modo demonstrativo não armazena e-mails reais no cadastro público',async()=>{
  const previous=process.env.DEMO_MODE;
  process.env.DEMO_MODE='true';
  const app=createApp({databaseCheck:async()=>true});
  try{
    const response=await app.inject({
      method:'POST',url:'/api/v1/auth/register',
      payload:{name:'Pessoa fictícia',email:'pessoa@gmail.com',password:'TesteFicticioSeguro123!'},
    });
    assert.equal(response.statusCode,400);
    assert.match(response.json().error,/example\.invalid/);
  }finally{
    await app.close();
    if(previous===undefined)delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE=previous;
  }
});
