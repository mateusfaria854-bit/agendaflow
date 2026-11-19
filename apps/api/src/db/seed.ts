import { database, closeDatabase } from './client.js';

const services = [
  ['11111111-1111-4111-8111-111111111111', 'Corte clássico', 30, 4500],
  ['22222222-2222-4222-8222-222222222222', 'Barba', 20, 3000],
  ['33333333-3333-4333-8333-333333333333', 'Cabelo e barba', 60, 6500],
] as const;
const professionals = [
  ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alex Demo'],
  ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Pat Demo'],
] as const;

const client = await database().connect();
try {
  await client.query('BEGIN');
  for (const [id, name, minutes, cents] of services) {
    await client.query(
      'INSERT INTO services(id, name, duration_minutes, price_cents) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
      [id, name, minutes, cents],
    );
  }
  for (const [id, name] of professionals) {
    await client.query('INSERT INTO professionals(id, name) VALUES($1,$2) ON CONFLICT (id) DO NOTHING', [id, name]);
    for (const [serviceId] of services) {
      await client.query(
        'INSERT INTO professional_services(professional_id, service_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [id, serviceId],
      );
    }
    for (let weekday = 1; weekday <= 5; weekday++) {
      for (const [start, end] of [['09:00','12:00'], ['13:00','18:00']]) {
        await client.query(
          'INSERT INTO availabilities(professional_id, weekday, start_time, end_time) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [id, weekday, start, end],
        );
      }
    }
  }
  await client.query('COMMIT');
  console.log('Seed fictício criado. Nenhum usuário ou senha foi gerado.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await closeDatabase();
}
