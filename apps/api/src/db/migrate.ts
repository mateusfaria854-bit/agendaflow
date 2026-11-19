import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { database, closeDatabase } from './client.js';

const db = database();
const client = await db.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const dir = resolve(process.cwd(), 'db/migrations');
  for (const name of readdirSync(dir).filter(n => /^\d+.*\.sql$/.test(n)).sort()) {
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [name]);
    if (applied.rowCount) {
      console.log('Já aplicada:', name);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(resolve(dir, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [name]);
      await client.query('COMMIT');
      console.log('Migração aplicada:', name);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await closeDatabase();
}
