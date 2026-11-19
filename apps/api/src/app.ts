import Fastify from 'fastify';
import { APP_NAME, type HealthResponse, type ReadyResponse } from '@agendaflow/shared';
import { checkDatabase } from './db/client.js';
import { authRoutes } from './modules/auth/routes.js';
import { checkWriteOrigin } from './modules/auth/session.js';
import { catalogRoutes } from './modules/catalog/routes.js';

type Options = { databaseCheck?: () => Promise<boolean>; logger?: boolean };

/** Factory: a API pode ser testada sem abrir porta HTTP externa. */
export function createApp(options: Options = {}) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 32 * 1024,
    ajv: {customOptions: {removeAdditional: false}},
  });
  const databaseCheck = options.databaseCheck ?? checkDatabase;

  app.addHook('onRequest', async (request, reply) => {
    if (['POST','PUT','PATCH','DELETE'].includes(request.method) && !checkWriteOrigin(request)) {
      return reply.code(403).send({error: 'Origem da requisição não autorizada.'});
    }
  });

  app.get<{Reply:HealthResponse}>('/api/v1/health', async () => ({
    status:'ok', service:'agendaflow-api', version:'0.1.0',
  }));
  app.get<{Reply:ReadyResponse}>('/api/v1/ready', async(_request,reply) => {
    if (await databaseCheck()) return {status:'ready'};
    return reply.code(503).send({status:'unavailable'});
  });

  app.register(authRoutes, {prefix:'/api/v1/auth'});
  app.register(catalogRoutes, {prefix:'/api/v1'});

  app.get('/', async() => ({name:APP_NAME,phase:1}));
  app.setErrorHandler((error,_request,reply) => {
    const err = error as { statusCode?: number; message?: string };
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode : 500;
    if (status===500) app.log.error(error);
    reply.code(status).send({error: status===500 ? 'Falha interna no servidor.' : (err.message ?? 'Requisição inválida.')});
  });
  return app;
}
