import type {Pool, PoolClient} from 'pg';

export type DemoMaintenanceResult = {
  mode: 'preview' | 'executed';
  retentionDays: number;
  maxUsersPerRun: number;
  eligibleClients: number;
  expiredSessions: number;
  relatedAppointments: number;
  removedClients: number;
  removedSessions: number;
  removedAppointments: number;
  removedAuditEvents: number;
};

export type DemoMaintenanceOptions = {
  retentionDays?: number;
  maxUsersPerRun?: number;
  execute?: boolean;
};

const cutoffSql = "(now() - ($1::integer * interval '1 day'))";
const eligibleSql = [
  'SELECT u.id FROM users u',
  "WHERE u.role = 'CLIENTE'",
  "  AND lower(u.email) LIKE '%@example.invalid'",
  '  AND u.created_at < ' + cutoffSql,
  '  AND NOT EXISTS (SELECT 1 FROM appointments a',
  '    WHERE a.client_id = u.id AND (a.ends_at >= ' + cutoffSql + ' OR a.updated_at >= ' + cutoffSql + '))',
  '  AND NOT EXISTS (SELECT 1 FROM sessions s',
  '    WHERE s.user_id = u.id AND (s.expires_at > now() OR s.created_at >= ' + cutoffSql + '))',
  '  AND NOT EXISTS (SELECT 1 FROM audit_events e',
  '    WHERE e.actor_id = u.id AND e.occurred_at >= ' + cutoffSql + ')',
].join('\n');

function checkedInteger(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(label + ' precisa ser um inteiro entre ' + min + ' e ' + max + '.');
  }
  return value;
}

async function counts(db: Pool | PoolClient, retentionDays: number) {
  const eligible = await db.query<{total: number}>(
    'SELECT count(*)::int AS total FROM (' + eligibleSql + ') eligible', [retentionDays],
  );
  const expired = await db.query<{total: number}>(
    'SELECT count(*)::int AS total FROM sessions WHERE expires_at <= now()',
  );
  const related = await db.query<{total: number}>(
    'SELECT count(*)::int AS total FROM appointments WHERE client_id IN (' + eligibleSql + ')',
    [retentionDays],
  );
  return {
    eligibleClients: eligible.rows[0].total,
    expiredSessions: expired.rows[0].total,
    relatedAppointments: related.rows[0].total,
  };
}

/**
 * Segurança: não roda fora de DEMO_MODE=true. Dry-run é o padrão.
 * Exclusões também exigem DEMO_MAINTENANCE_ENABLED=true e execute=true.
 * Nunca usar contra um banco com dados reais.
 */
export async function runDemoMaintenance(db: Pool, options: DemoMaintenanceOptions = {}): Promise<DemoMaintenanceResult> {
  if (process.env.DEMO_MODE !== 'true') {
    throw new Error('Manutenção bloqueada: DEMO_MODE=true é obrigatório.');
  }
  const retentionDays = checkedInteger(options.retentionDays ?? 30, 30, 365, 'Retenção');
  const maxUsersPerRun = checkedInteger(options.maxUsersPerRun ?? 50, 1, 100, 'Limite por execução');
  const execute = options.execute === true;
  if (execute && process.env.DEMO_MAINTENANCE_ENABLED !== 'true') {
    throw new Error('Exclusão bloqueada: DEMO_MAINTENANCE_ENABLED=true é obrigatório.');
  }

  if (!execute) {
    const current = await counts(db, retentionDays);
    return {
      mode: 'preview', retentionDays, maxUsersPerRun, ...current,
      removedClients: 0, removedSessions: 0, removedAppointments: 0, removedAuditEvents: 0,
    };
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '20s'");
    const lock = await client.query<{acquired: boolean}>(
      'SELECT pg_try_advisory_xact_lock(742811, 30001) AS acquired',
    );
    if (!lock.rows[0].acquired) throw new Error('Outra execução da manutenção já está em andamento.');

    const current = await counts(client, retentionDays);
    await client.query('CREATE TEMP TABLE demo_cleanup_targets (id uuid PRIMARY KEY) ON COMMIT DROP');
    await client.query(
      'INSERT INTO demo_cleanup_targets(id) ' + eligibleSql +
        ' ORDER BY u.created_at, u.id LIMIT $2 FOR UPDATE OF u SKIP LOCKED',
      [retentionDays, maxUsersPerRun],
    );

    // Eventos antigos relacionados a contas ou reservas eliminadas.
    const audit = await client.query(
      'DELETE FROM audit_events WHERE actor_id IN (SELECT id FROM demo_cleanup_targets)' +
      ' OR entity_id IN (SELECT id FROM demo_cleanup_targets)' +
      ' OR entity_id IN (SELECT id FROM appointments WHERE client_id IN (SELECT id FROM demo_cleanup_targets))',
    );
    const sessions = await client.query(
      'DELETE FROM sessions WHERE expires_at <= now() OR user_id IN (SELECT id FROM demo_cleanup_targets)',
    );
    const appointments = await client.query(
      'DELETE FROM appointments WHERE client_id IN (SELECT id FROM demo_cleanup_targets)',
    );
    const users = await client.query(
      "DELETE FROM users WHERE role='CLIENTE' AND id IN (SELECT id FROM demo_cleanup_targets)",
    );
    await client.query('COMMIT');
    return {
      mode: 'executed', retentionDays, maxUsersPerRun, ...current,
      removedClients: users.rowCount ?? 0,
      removedSessions: sessions.rowCount ?? 0,
      removedAppointments: appointments.rowCount ?? 0,
      removedAuditEvents: audit.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
