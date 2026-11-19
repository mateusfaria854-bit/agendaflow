import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

test('GET health retorna JSON sem depender do banco', async () => {
  const app = createApp({ databaseCheck: async () => false });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok', service: 'agendaflow-api', version: '0.1.0' });
  } finally { await app.close(); }
});

test('GET ready retorna 503 quando o banco está indisponível', async () => {
  const app = createApp({ databaseCheck: async () => false });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { status: 'unavailable' });
  } finally { await app.close(); }
});

test('GET ready retorna 200 com conexão disponível', async () => {
  const app = createApp({ databaseCheck: async () => true });
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ready' });
  } finally { await app.close(); }
});
