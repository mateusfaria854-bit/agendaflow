import 'dotenv/config';
import { createApp } from './app.js';
import { closeDatabase } from './db/client.js';

const app = createApp({ logger: true });
const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? '127.0.0.1';

async function shutdown() {
  await app.close();
  await closeDatabase();
}

process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await shutdown();
}
