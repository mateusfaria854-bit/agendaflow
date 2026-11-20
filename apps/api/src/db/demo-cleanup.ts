import {database, closeDatabase} from './client.js';
import {runDemoMaintenance} from './demo-maintenance.js';

const execute = process.argv.includes('--execute');
const accepted = new Set(['--execute', '--dry-run']);
const unknown = process.argv.slice(2).filter(argument => !accepted.has(argument));
if (unknown.length || (execute && process.argv.includes('--dry-run'))) {
  console.error('Uso: npm run db:demo:cleanup [-- --execute] (dry-run por padrão).');
  process.exitCode = 1;
} else {
  try {
    const result = await runDemoMaintenance(database(), {
      execute,
      retentionDays: Number(process.env.DEMO_RETENTION_DAYS ?? 30),
      maxUsersPerRun: Number(process.env.DEMO_CLEANUP_BATCH ?? 50),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('A manutenção foi recusada ou falhou:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
