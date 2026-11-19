import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, closeDatabase } from './client.js';

const db = database();
const client = await db.connect();
try {
  const services = await client.query('SELECT COUNT(*)::int AS total FROM services');
  assert.ok(services.rows[0].total >= 3, 'Seed fictício de serviços não encontrado');

  const constraint = await client.query(
    "SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap' AND contype = 'x'",
  );
  assert.equal(constraint.rowCount, 1, 'Restrição de sobreposição não encontrada');

  // A transação é revertida: o teste não deixa clientes nem agendamentos no banco.
  await client.query('BEGIN');
  try {
    const userId = randomUUID();
    await client.query(
      'INSERT INTO users(id, name, email, password_hash) VALUES($1,$2,$3,$4)',
      [userId, 'Usuário de integração', `teste-${userId}@example.invalid`, 'hash-nao-autenticavel'],
    );
    const proId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const serviceId = '11111111-1111-4111-8111-111111111111';
    const insert = `INSERT INTO appointments
      (client_id, professional_id, service_id, starts_at, ends_at, price_cents)
      VALUES ($1,$2,$3,$4,$5,4500)`;
    await client.query(insert, [userId, proId, serviceId, '2035-01-01T12:00:00Z', '2035-01-01T12:30:00Z']);
    await client.query('SAVEPOINT conflict_check');
    let conflictRejected = false;
    try {
      await client.query(insert, [userId, proId, serviceId, '2035-01-01T12:15:00Z', '2035-01-01T12:45:00Z']);
    } catch (error) {
      conflictRejected = (error as { code?: string }).code === '23P01';
      await client.query('ROLLBACK TO SAVEPOINT conflict_check');
    }
    assert.ok(conflictRejected, 'Banco aceitou duas reservas sobrepostas');
    console.log('OK: conflito de reservas impedido pelo PostgreSQL');
  } finally {
    await client.query('ROLLBACK');
  }
  console.log('OK: migrações e seed fictício verificados');
} finally {
  client.release();
  await closeDatabase();
}
