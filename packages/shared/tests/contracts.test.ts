import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_NAME, intervalsOverlap } from '../src/index.ts';

test('identificador compartilhado do projeto', () => {
  assert.equal(APP_NAME, 'AgendaFlow');
});
test('intervalos adjacentes não se sobrepõem', () => {
  assert.equal(intervalsOverlap(9, 10, 10, 11), false);
});
test('reservas que se cruzam são detectadas', () => {
  assert.equal(intervalsOverlap(9, 10, 9.5, 11), true);
});
test('intervalos inválidos são rejeitados', () => {
  assert.throws(() => intervalsOverlap(10, 10, 9, 11));
});
