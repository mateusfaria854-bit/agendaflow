import type { FastifyPluginAsync } from 'fastify';
import { database } from '../../db/client.js';
import { hashPassword, verifyPassword, validPassword } from './password.js';
import { clearCookie, createSession, findSessionUser, revokeSession } from './session.js';

type Credentials = { email: string; password: string };
type Registration = Credentials & { name: string };
type PublicUser = { id: string; name: string; email: string; role: string };
type StoredUser = PublicUser & { password_hash: string };

const mail = { type: 'string', minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' };
const password = { type: 'string', minLength: 12, maxLength: 128 };
const loginBody = {
  type: 'object', required: ['email','password'], additionalProperties: false,
  properties: { email: mail, password: { type: 'string', minLength: 1, maxLength: 128 } },
};
const registerBody = {
  type: 'object', required: ['name','email','password'], additionalProperties: false,
  properties: { name: { type: 'string', minLength: 2, maxLength: 140 }, email: mail, password },
};
const WINDOW = 15 * 60 * 1000;
const attempts = new Map<string, {count: number; resetAt: number}>();
const dummy = hashPassword('dummy-auth-verification-password');

function allowAttempt(ip: string): boolean {
  const now = Date.now();
  if (attempts.size > 5000) for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
  const entry = attempts.get(ip);
  return !entry || entry.resetAt <= now || entry.count < 10;
}
function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) attempts.set(ip, {count: 1, resetAt: now + WINDOW});
  else entry.count++;
}
function publicUser(user: StoredUser | PublicUser): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export const authRoutes: FastifyPluginAsync = async app => {
  app.post<{Body: Registration}>('/register', {schema: {body: registerBody}}, async (request, reply) => {
    const {name, email, password} = request.body;
    // Demo pública: evita recolher e-mails reais. Não é substituto para limites de abuso.
    if(process.env.DEMO_MODE==='true' && !email.trim().toLowerCase().endsWith('@example.invalid')){
      return reply.code(400).send({error:'Na demonstração, use apenas um e-mail fictício @example.invalid.'});
    }
    if (!validPassword(password) || name.trim().length < 2) {
      return reply.code(400).send({error: 'Dados de cadastro inválidos.'});
    }
    const stored = await hashPassword(password);
    try {
      const result = await database().query<PublicUser>(
        `INSERT INTO users(name, email, password_hash, role)
         VALUES($1,$2,$3,'CLIENTE') RETURNING id,name,email,role`,
        [name.trim(), email.trim().toLowerCase(), stored],
      );
      const user = result.rows[0];
      await createSession(user.id, reply);
      return reply.code(201).send({user});
    } catch (error) {
      if ((error as {code?: string}).code === '23505') return reply.code(409).send({error: 'E-mail já cadastrado.'});
      throw error;
    }
  });

  app.post<{Body: Credentials}>('/login', {schema: {body: loginBody}}, async (request, reply) => {
    if (!allowAttempt(request.ip)) return reply.code(429).send({error: 'Muitas tentativas. Tente novamente mais tarde.'});
    const result = await database().query<StoredUser>(
      'SELECT id,name,email,role,password_hash FROM users WHERE lower(email)=$1',
      [request.body.email.trim().toLowerCase()],
    );
    const user = result.rows[0];
    const good = await verifyPassword(request.body.password, user?.password_hash ?? await dummy);
    if (!user || !good) {
      recordFailure(request.ip);
      return reply.code(401).send({error: 'E-mail ou senha inválidos.'});
    }
    attempts.delete(request.ip);
    await revokeSession(request);
    await createSession(user.id, reply);
    return {user: publicUser(user)};
  });

  app.get('/me', async (request, reply) => {
    const user = await findSessionUser(request);
    if (!user) return reply.code(401).send({error: 'Autenticação necessária.'});
    return {user};
  });

  app.post('/logout', async (request, reply) => {
    await revokeSession(request);
    clearCookie(reply);
    return reply.code(204).send();
  });
};
