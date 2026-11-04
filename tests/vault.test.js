// Credential vault encryption/unlock round trips with mocked Chrome storage.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveCredentials, unlockCredentials} from '../extension/vault.js';
const local = {}, session = {};
globalThis.chrome = {storage: {local: {set: async v => Object.assign(local,v), get: async () => local}, session: {set: async v => Object.assign(session,v)}}};
test('saved login is encrypted, unlocked with the passphrase, and rejects wrong passphrases', async () => {
  const value = {user: 'TEST-USER', password: 'fictional-password'};
  await assert.rejects(saveCredentials(value, 'short'), /12 characters/);
  await saveCredentials(value, 'fictional vault passphrase');
  assert.equal(JSON.stringify(local).includes(value.password), false);
  assert.equal(JSON.stringify(local).includes(value.user), false);
  assert.deepEqual(await unlockCredentials('fictional vault passphrase'), value);
  await assert.rejects(unlockCredentials('incorrect passphrase'), /Could not unlock/);
});
