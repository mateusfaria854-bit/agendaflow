import Fastify from 'fastify';
import { APP_NAME, type HealthResponse, type ReadyResponse } from '@agendaflow/shared';
import { checkDatabase } from './db/client.js';

type Options = {
  databaseCheck?: () => Promise<boolean>;
  logger?: boolean;
};

/** Factory: HTTP handlers can be tested without starting a port or PostgreSQL. */
export function createApp(options: Options = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const databaseCheck = options.databaseCheck ?? checkDatabase;

  app.get<{ Reply: HealthResponse }>('/api/v1/health', async () => ({
    status: 'ok',
    service: 'agendaflow-api',
    version: '0.1.0',
  }));

  app.get<{ Reply: ReadyResponse }>('/api/v1/ready', async (_request, reply) => {
    if (await databaseCheck()) return { status: 'ready' };
    return reply.code(503).send({ status: 'unavailable' });
  });

  // Routes for accounts, services and appointments will be added by their specs.
  app.get('/', async () => ({ name: APP_NAME, phase: 0 }));
  return app;
}
