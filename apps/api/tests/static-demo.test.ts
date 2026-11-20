import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';

test('build único: Fastify serve React e mantém API com respostas JSON',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'agenda-static-'));
  await mkdir(join(directory,'assets'));
  await writeFile(join(directory,'index.html'),'<html><head><title>AgendaFlow</title></head><body>Demo</body></html>');
  await writeFile(join(directory,'assets','demo.css'),'.app{display:block}');
  const app=createApp({serveWeb:true,webRoot:directory,databaseCheck:async()=>true});
  try{
    const home=await app.inject({method:'GET',url:'/'});
    assert.equal(home.statusCode,200,home.body);
    assert.match(home.body,/AgendaFlow/);
    assert.match(String(home.headers['content-type']),/text\/html/);

    const css=await app.inject({method:'GET',url:'/assets/demo.css'});
    assert.equal(css.statusCode,200);
    assert.match(css.body,/display:block/);

    const deep=await app.inject({method:'GET',url:'/meus-agendamentos'});
    assert.equal(deep.statusCode,200);
    assert.match(deep.body,/AgendaFlow/);

    const api=await app.inject({method:'GET',url:'/api/v1/health'});
    assert.equal(api.statusCode,200);
    assert.equal(api.json().status,'ok');
    assert.equal(api.headers['cache-control'],'no-store');
    const missing=await app.inject({method:'GET',url:'/api/v1/nao-existe'});
    assert.equal(missing.statusCode,404);
    assert.match(missing.headers['content-type'] as string,/application\/json/);
    assert.ok(!missing.body.includes('<html>'));
    assert.equal((await app.inject({method:'GET',url:'/nao-existe.png'})).statusCode,404);
  }finally{
    await app.close();
    await rm(directory,{recursive:true,force:true});
  }
});
