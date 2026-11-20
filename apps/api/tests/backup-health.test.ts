import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createApp} from '../src/app.js';
import {freshnessFor} from '../src/db/backup-health.js';

test('backups: relogio permite ate 36h, com tolerancia de cinco minutos no futuro',()=>{
  const now = new Date('2026-11-20T18:00:00.000Z');
  const date = (ms: number)=>new Date(now.getTime()+ms);
  assert.equal(freshnessFor(null,now),'missing');
  assert.equal(freshnessFor(date(-36*60*60*1000),now),'fresh');
  assert.equal(freshnessFor(date(-36*60*60*1000-1),now),'stale');
  assert.equal(freshnessFor(date(5*60*1000),now),'fresh');
  assert.equal(freshnessFor(date(5*60*1000+1),now),'stale');
  assert.equal(freshnessFor(new Date(NaN),now),'missing');
});

test('backups: endpoint falha fechado e nao revela nomes/sha/segredos',async()=>{
  const old=process.env.DEMO_MODE;
  process.env.DEMO_MODE='true';
  try {
    for (const status of ['fresh','stale','missing','unavailable'] as const) {
      const app=createApp({databaseCheck:async()=>true,backupCheck:async()=>status});
      try {
        const res=await app.inject({method:'GET',url:'/api/v1/backups/ready'});
        assert.equal(res.statusCode,status==='fresh'?200:503);
        assert.deepEqual(res.json(),{status:status==='fresh'?'fresh':'unavailable'});
        assert.equal(res.headers['cache-control'],'no-store');
        assert.doesNotMatch(res.body,/bucket|database_url|sha256|backup\.dump/i);
      }finally{await app.close();}
    }
  }finally{
    if(old===undefined)delete process.env.DEMO_MODE;else process.env.DEMO_MODE=old;
  }
});

test('backups: rota indisponivel fora do modo de demonstracao',async()=>{
  const old=process.env.DEMO_MODE;
  delete process.env.DEMO_MODE;
  const app=createApp({backupCheck:async()=>{throw new Error('nao deveria consultar banco');}});
  try {
    const res=await app.inject({method:'GET',url:'/api/v1/backups/ready'});
    assert.equal(res.statusCode,404);
  }finally{
    await app.close();
    if(old===undefined)delete process.env.DEMO_MODE;else process.env.DEMO_MODE=old;
  }
});
