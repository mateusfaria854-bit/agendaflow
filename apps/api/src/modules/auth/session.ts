import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { database } from '../../db/client.js';

export type Role = 'CLIENTE' | 'PROFISSIONAL' | 'ADMIN';
export type SessionUser = { id: string; name: string; email: string; role: Role };

const COOKIE_NAME = 'agendaflow_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const SECURE_COOKIE = process.env.NODE_ENV === 'production' ? '; Secure' : '';

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionToken(request: FastifyRequest): string | null {
  const piece = request.headers.cookie?.split(';').map(p => p.trim()).find(p => p.startsWith(`${COOKIE_NAME}=`));
  const token = piece?.slice(COOKIE_NAME.length + 1) ?? '';
  return /^[a-zA-Z0-9_-]{43}$/.test(token) ? token : null;
}

export function clearCookie(reply: FastifyReply): void {
  reply.header('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE_COOKIE}`);
}

export async function createSession(userId: string, reply: FastifyReply): Promise<void> {
  const raw = randomBytes(32).toString('base64url');
  await database().query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '7 days')",
    [userId, digest(raw)],
  );
  await database().query('UPDATE users SET last_activity_at=now() WHERE id=$1', [userId]);
  reply.header('Set-Cookie', `${COOKIE_NAME}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${SECURE_COOKIE}`);
}

export async function findSessionUser(request: FastifyRequest): Promise<SessionUser | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const query = await database().query<SessionUser>(
    `SELECT u.id, u.name, u.email, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [digest(token)],
  );
  return query.rows[0] ?? null;
}

export async function revokeSession(request: FastifyRequest): Promise<void> {
  const token = sessionToken(request);
  if (token) {
    await database().query(
      'WITH revoked AS (DELETE FROM sessions WHERE token_hash=$1 RETURNING user_id) ' +
      'UPDATE users SET last_activity_at=now() FROM revoked WHERE users.id=revoked.user_id',
      [digest(token)],
    );
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<SessionUser | null> {
  const user = await findSessionUser(request);
  if (!user) {
    reply.code(401).send({ error: 'Autenticação necessária.' });
    return null;
  }
  if (user.role !== 'ADMIN') {
    reply.code(403).send({ error: 'Acesso reservado ao administrador.' });
    return null;
  }
  return user;
}

export function checkWriteOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const configured = process.env.WEB_ORIGIN;
    return (configured ? parsed.origin === new URL(configured).origin : parsed.host === request.headers.host);
  } catch {
    return false;
  }
}
