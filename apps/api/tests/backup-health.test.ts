import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createApp} from '../src/app.js';
import {freshnessFor, latestBackupScheduleBoundary, verifiedAfterDailySchedule} from '../src/db/backup-health.js';

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

test('backup diário: limite esperado do cron às 03:20 UTC, incluindo virada de ano',()=>{
  const utc=(s:string)=>new Date(s);
  assert.equal(latestBackupScheduleBoundary(utc('2026-11-21T08:30:00Z')).toISOString(),'2026-11-21T03:20:00.000Z');
  assert.equal(latestBackupScheduleBoundary(utc('2026-11-21T03:19:59Z')).toISOString(),'2026-11-20T03:20:00.000Z');
  assert.equal(latestBackupScheduleBoundary(utc('2027-01-01T00:05:00Z')).toISOString(),'2026-12-31T03:20:00.000Z');
});

test('backup diário: exige uma cópia íntegra depois do horário previsto e não aceita futuro remoto',()=>{
  const now=new Date('2026-11-21T08:30:00Z');
  assert.equal(verifiedAfterDailySchedule(null,now),false);
  assert.equal(verifiedAfterDailySchedule(new Date('2026-11-20T22:00:00Z'),now),false);
  assert.equal(verifiedAfterDailySchedule(new Date('2026-11-21T03:19:59Z'),now),false);
  assert.equal(verifiedAfterDailySchedule(new Date('2026-11-21T03:20:00Z'),now),true);
  assert.equal(verifiedAfterDailySchedule(new Date('2026-11-21T04:00:00Z'),now),true);
  assert.equal(verifiedAfterDailySchedule(new Date('2026-11-21T08:35:01Z'),now),false);
  assert.equal(verifiedAfterDailySchedule(new Date(NaN),now),false);
});

test('backup diário: endpoint é privado ao modo demo e retorna apenas estado genérico',async()=>{
  const old=process.env.DEMO_MODE;
  try{
    process.env.DEMO_MODE='true';
    for(const yes of [true,false]){
      const app=createApp({dailyBackupCheck:async()=>yes});
      try{
        const r=await app.inject({method:'GET',url:'/api/v1/backups/daily'});
        assert.equal(r.statusCode,yes?200:503);
        assert.deepEqual(r.json(),{status:yes?'verified':'unavailable'});
        assert.equal(r.headers['cache-control'],'no-store');
        assert.doesNotMatch(r.body,/bucket|database_url|sha256|verified_at|email/i);
      }finally{await app.close();}
    }
    delete process.env.DEMO_MODE;
    const app=createApp({dailyBackupCheck:async()=>{throw Error('não deve consultar');}});
    try{
      const r=await app.inject({method:'GET',url:'/api/v1/backups/daily'});
      assert.equal(r.statusCode,404);
    }finally{await app.close();}
  }finally{
    if(old===undefined)delete process.env.DEMO_MODE;else process.env.DEMO_MODE=old;
  }
});
