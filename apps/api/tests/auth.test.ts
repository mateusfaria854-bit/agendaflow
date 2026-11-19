import assert from 'node:assert/strict';
import {test} from 'node:test';
import {hashPassword, verifyPassword, validPassword} from '../src/modules/auth/password.js';

test('scrypt usa salt único e verifica senha corretamente', async() => {
  const first=await hashPassword('segredo-com-pelo-menos-doze');
  const second=await hashPassword('segredo-com-pelo-menos-doze');
  assert.notEqual(first,second);
  assert.equal(await verifyPassword('segredo-com-pelo-menos-doze',first),true);
  assert.equal(await verifyPassword('senha-totalmente-errada',first),false);
  assert.equal(await verifyPassword('qualquer','hash-malformado'),false);
});
test('senha de cadastro exige comprimento mínimo', () => {
  assert.equal(validPassword('abc'),false);
  assert.equal(validPassword('uma-senha-bem-maior'),true);
});
