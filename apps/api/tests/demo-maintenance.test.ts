import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {database, closeDatabase} from '../src/db/client.js';
import {runDemoMaintenance} from '../src/db/demo-maintenance.js';

test('retencao demo: simula por padrao e remove apenas clientes ficticios inativos', async () => {
  const oldMode = process.env.DEMO_MODE;
  const oldEnabled = process.env.DEMO_MAINTENANCE_ENABLED;
  process.env.DEMO_MODE = 'true';
  delete process.env.DEMO_MAINTENANCE_ENABLED;
  const db = database();
  const target = randomUUID();
  const active = randomUUID();
  const admin = randomUUID();
  const fresh = randomUUID();
  const ids = [target, active, admin, fresh];
  try {
    for (const [id, role, days] of [
      [target, 'CLIENTE', 61],
      [active, 'CLIENTE', 61],
      [admin, 'ADMIN', 61],
      [fresh, 'CLIENTE', 0],
    ] as const) {
      await db.query(
        "INSERT INTO users(id,name,email,password_hash,role,created_at)" +
        " VALUES($1,'Conta Ficticia', $2, 'hash-ficticio', $3, now()-($4::int*interval '1 day'))",
        [id, 'demo-' + id + '@example.invalid', role, days],
      );
    }
    await db.query(
      "INSERT INTO appointments(client_id,professional_id,service_id,starts_at,ends_at,price_cents,created_at,updated_at)" +
      " VALUES($1,$2,$3,now()-interval '65 days',now()-interval '65 days'+interval '30 minutes'," +
      "4500,now()-interval '65 days',now()-interval '65 days')",
      [target, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'],
    );
    await db.query(
      "INSERT INTO sessions(user_id,token_hash,created_at,expires_at)" +
      " VALUES($1,$2,now()-interval '1 day',now()+interval '2 days')",
      [active, randomBytes(32).toString('hex')],
    );
    await db.query(
      "INSERT INTO sessions(user_id,token_hash,created_at,expires_at)" +
      " VALUES($1,$2,now()-interval '70 days',now()-interval '60 days')",
      [target, randomBytes(32).toString('hex')],
    );

    const preview = await runDemoMaintenance(db);
    assert.equal(preview.mode, 'preview');
    assert.ok(preview.eligibleClients >= 1);
    assert.equal(preview.removedClients, 0);
    assert.equal((await db.query('SELECT 1 FROM users WHERE id=$1', [target])).rowCount, 1);

    await assert.rejects(runDemoMaintenance(db, {execute: true}), /ENABLED/);
    process.env.DEMO_MAINTENANCE_ENABLED = 'true';
    const result = await runDemoMaintenance(db, {execute: true, maxUsersPerRun: 50});
    assert.equal(result.mode, 'executed');
    assert.ok(result.removedClients >= 1);
    assert.ok(result.removedAppointments >= 1);
    assert.ok(result.removedSessions >= 1);
    assert.equal((await db.query('SELECT 1 FROM users WHERE id=$1', [target])).rowCount, 0);
    for (const id of [active, admin, fresh]) {
      assert.equal((await db.query('SELECT 1 FROM users WHERE id=$1', [id])).rowCount, 1);
    }
    const repeated = await runDemoMaintenance(db, {execute: true});
    assert.equal(repeated.removedClients, 0);
  } finally {
    await db.query(
      'DELETE FROM audit_events WHERE actor_id = ANY($1::uuid[]) OR entity_id = ANY($1::uuid[])',
      [ids],
    );
    await db.query('DELETE FROM sessions WHERE user_id = ANY($1::uuid[])', [ids]);
    await db.query('DELETE FROM appointments WHERE client_id = ANY($1::uuid[])', [ids]);
    await db.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    if (oldMode === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = oldMode;
    if (oldEnabled === undefined) delete process.env.DEMO_MAINTENANCE_ENABLED;
    else process.env.DEMO_MAINTENANCE_ENABLED = oldEnabled;
    await closeDatabase();
  }
});

test('retencao demo: bloqueia outros ambientes e configuracoes perigosas', async () => {
  const mode = process.env.DEMO_MODE;
  delete process.env.DEMO_MODE;
  try {
    await assert.rejects(runDemoMaintenance(database()), /DEMO_MODE/);
    process.env.DEMO_MODE = 'true';
    await assert.rejects(runDemoMaintenance(database(), {retentionDays: 1}), /Retenção/);
    await assert.rejects(runDemoMaintenance(database(), {maxUsersPerRun: 100000}), /Limite/);
  } finally {
    if (mode === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = mode;
    await closeDatabase();
  }
});
