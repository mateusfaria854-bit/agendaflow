import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 16384;
const SALT_BYTES = 24;

function derive(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { N: COST, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}

export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error('Senha deve ter entre 12 e 128 caracteres.');
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, KEY_LENGTH);
  return `scrypt$${COST}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, costText, saltText, hashText] = encoded.split('$');
    if (algorithm !== 'scrypt' || costText !== String(COST) || !saltText || !hashText || typeof password !== 'string') return false;
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (salt.length !== SALT_BYTES || expected.length !== KEY_LENGTH) return false;
    const received = await derive(password, salt, expected.length);
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
