import {database} from './client.js';

export type BackupFreshness = 'fresh' | 'stale' | 'missing' | 'unavailable';
const MAX_BACKUP_AGE_MS = 36 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/** Pure policy used by the backup health endpoint. */
export function freshnessFor(verifiedAt: Date | null, now = new Date()): BackupFreshness {
  if (!verifiedAt || !Number.isFinite(verifiedAt.getTime())) return 'missing';
  const age = now.getTime() - verifiedAt.getTime();
  return age >= -MAX_FUTURE_SKEW_MS && age <= MAX_BACKUP_AGE_MS ? 'fresh' : 'stale';
}

/** Read-only and deliberately excludes S3 names, hashes and credentials. */
export async function checkBackupFreshness(): Promise<BackupFreshness> {
  try {
    const result = await database().query<{verified_at: Date}>(
      'SELECT verified_at FROM backup_verifications WHERE id=1',
    );
    return freshnessFor(result.rows[0]?.verified_at ?? null);
  } catch {
    return 'unavailable';
  }
}


/** Cron agendado às 03:20 UTC. Define a última janela esperada. */
export function latestBackupScheduleBoundary(now = new Date()): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 20);
  const previous = now.getTime() < today ? today - 86_400_000 : today;
  return new Date(previous);
}

/** Confirma uma cópia íntegra APÓS o horário esperado, sem afirmar que foi o cron que a produziu. */
export function verifiedAfterDailySchedule(verifiedAt: Date | null, now = new Date()): boolean {
  if (!verifiedAt || !Number.isFinite(verifiedAt.getTime())) return false;
  const stamp = verifiedAt.getTime();
  return stamp >= latestBackupScheduleBoundary(now).getTime()
    && stamp <= now.getTime() + MAX_FUTURE_SKEW_MS;
}

/** O endpoint diário consulta apenas o mesmo registro protegido de integridade. */
export async function checkDailyBackup(): Promise<boolean> {
  try {
    const result = await database().query<{verified_at: Date}>(
      'SELECT verified_at FROM backup_verifications WHERE id=1',
    );
    return verifiedAfterDailySchedule(result.rows[0]?.verified_at ?? null);
  } catch {
    return false;
  }
}
