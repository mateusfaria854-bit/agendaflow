import 'dotenv/config';
import { database, closeDatabase } from './client.js';
import { hashPassword, validPassword } from '../modules/auth/password.js';

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!name || name.length < 2 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validPassword(password)) {
  console.error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (12 a 128 caracteres) como variáveis temporárias de ambiente.');
  process.exitCode = 1;
} else {
  try {
    const hashed = await hashPassword(password);
    const created = await database().query(
      `INSERT INTO users(name,email,password_hash,role)
       VALUES($1,$2,$3,'ADMIN') RETURNING id,email`,
      [name,email,hashed],
    );
    console.log('Administrador criado:', created.rows[0].email);
  } catch (error) {
    if ((error as {code?: string}).code === '23505') {
      console.error('E-mail já cadastrado. O bootstrap não promove contas existentes automaticamente.');
      process.exitCode = 1;
    } else {
      console.error('Não foi possível criar o administrador.');
      process.exitCode = 1;
    }
  } finally {
    await closeDatabase();
  }
}
