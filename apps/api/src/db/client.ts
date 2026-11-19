import 'dotenv/config';
import { Pool } from 'pg';

let pool: Pool | undefined;

export function database(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não configurada. Consulte apps/api/.env.example');
  }
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 3000,
  });
  return pool;
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await database().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}
