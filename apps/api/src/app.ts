import Fastify from 'fastify';
import { APP_NAME, type HealthResponse, type ReadyResponse } from '@agendaflow/shared';
import { checkDatabase } from './db/client.js';
import { authRoutes } from './modules/auth/routes.js';
import { checkWriteOrigin } from './modules/auth/session.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { availabilityRoutes } from './modules/availability/routes.js';
import {appointmentRoutes} from './modules/appointments/routes.js';
import {adminAppointmentRoutes} from './modules/admin/routes.js';
import {staffRoutes} from './modules/staff/routes.js';

type Options = { databaseCheck?: () => Promise<boolean>; logger?: boolean };

/** Factory: a API pode ser testada sem abrir porta HTTP externa. */
export function createApp(options: Options = {}) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 32 * 1024,
    ajv: {customOptions: {removeAdditional: false}},
  });
  const databaseCheck = options.databaseCheck ?? checkDatabase;
  // Uma instância produtiva não deve emitir cookies de sessão sem HTTPS.
  if (process.env.NODE_ENV === 'production') {
    const origin = process.env.WEB_ORIGIN;
    let valid = false;
    try { valid = !!origin && new URL(origin).protocol === 'https:'; } catch { valid = false; }
    if (!valid) throw new Error('Em produção, WEB_ORIGIN deve ser uma origem HTTPS válida.');
  }
  app.addHook('onSend', async (request,reply,payload) => {
    reply.header('X-Content-Type-Options','nosniff');
    reply.header('X-Frame-Options','DENY');
    reply.header('Referrer-Policy','no-referrer');
    if (request.url.startsWith('/api/v1/')) {
      reply.header('Cache-Control','no-store');
    }
    return payload;
  });

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
  app.register(availabilityRoutes, {prefix:'/api/v1'});
  app.register(appointmentRoutes, {prefix:'/api/v1'});
  app.register(adminAppointmentRoutes, {prefix:'/api/v1'});
  app.register(staffRoutes, {prefix:'/api/v1'});

  app.get('/', async() => ({name:APP_NAME,phase:4}));
  app.setErrorHandler((error,_request,reply) => {
    const err = error as { statusCode?: number; message?: string };
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode : 500;
    if (status===500) app.log.error(error);
    reply.code(status).send({error: status===500 ? 'Falha interna no servidor.' : (err.message ?? 'Requisição inválida.')});
  });
  return app;
}
