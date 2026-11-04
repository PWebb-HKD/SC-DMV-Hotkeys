// Credential vault encryption/unlock round trips with mocked Chrome storage.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveCredentials, unlockCredentials, blacklistState, addBlacklistEntry, removeBlacklistEntry, forgetCredentials} from '../extension/vault.js';
const local = {}, session = {};
globalThis.chrome = {storage: {local: {set: async v => Object.assign(local,v), get: async () => local, remove: async key => {delete local[key];}}, session: {set: async v => Object.assign(session,v), get: async () => session, remove: async keys => {for(const k of Array.isArray(keys)?keys:[keys])delete session[k];}}}};
test('saved login is encrypted, unlocked with the passphrase, and rejects wrong passphrases', async () => {
  const value = {user: 'TEST-USER', password: 'fictional-password'};
  await assert.rejects(saveCredentials(value, 'short'), /12 characters/);
  await saveCredentials(value, 'fictional vault passphrase');
  assert.equal(JSON.stringify(local).includes(value.password), false);
  assert.equal(JSON.stringify(local).includes(value.user), false);
  assert.deepEqual(await unlockCredentials('fictional vault passphrase'), value);
  await assert.rejects(unlockCredentials('incorrect passphrase'), /Could not unlock/);
});

const PASSPHRASE='fictional vault passphrase';
const resetSession=()=>{for(const key of Object.keys(session))delete session[key];};
test('blacklist entries persist only inside the encrypted vault and unlock with the login after session loss',async()=>{
  await addBlacklistEntry('plate','TEST123',PASSPHRASE);
  await addBlacklistEntry('customer','00001234',PASSPHRASE);
  assert.equal(JSON.stringify(local).includes('TEST123'),false);
  resetSession();assert.equal((await blacklistState()).unlocked,false);
  await assert.rejects(unlockCredentials('wrong passphrase'),/Could not unlock/);
  assert.equal((await blacklistState()).unlocked,false);
  const credentials=await unlockCredentials(PASSPHRASE);
  assert.equal(credentials.user,'TEST-USER');
  assert.deepEqual((await blacklistState()).entries,[{kind:'plate',value:'TEST123'},{kind:'customer',value:'1234'}]);
  assert.equal('passphrase' in session,false);assert.equal('key' in session,false);
});
test('wrong phrases, duplicate entries and unconfirmed deletion never change the persisted vault',async()=>{
  const before=JSON.stringify(local.vault);
  await assert.rejects(addBlacklistEntry('license','123456789','wrong passphrase'),/Could not unlock/);
  await assert.rejects(addBlacklistEntry('plate','test123',PASSPHRASE),/already blacklisted/);
  await assert.rejects(removeBlacklistEntry('plate','TEST123',PASSPHRASE,false),/Confirm removal/);
  await assert.rejects(removeBlacklistEntry('plate','TEST123','wrong passphrase',true),/Could not unlock/);
  assert.equal(JSON.stringify(local.vault),before);
  await assert.rejects(forgetCredentials(),/remove its blacklist entries/);
});
test('concurrent edits merge instead of dropping entries, and confirmed removal is durable',async()=>{
  await Promise.all([addBlacklistEntry('license','123456789',PASSPHRASE),addBlacklistEntry('plate','TEST456',PASSPHRASE)]);
  assert.equal((await blacklistState()).entries.length,4);
  await removeBlacklistEntry('plate','TEST123',PASSPHRASE,true);
  resetSession();await unlockCredentials(PASSPHRASE);
  assert.equal((await blacklistState()).entries.some(x=>x.value==='TEST123'),false);
  assert.equal((await blacklistState()).entries.length,3);
});
test('saving a different login or passphrase preserves the blacklist and a locked vault cannot be overwritten blindly',async()=>{
  const before=(await blacklistState()).entries;
  await saveCredentials({user:'NEW-USER',password:'new-fictional-password'},'another fictional passphrase');
  resetSession();const ciphertext=JSON.stringify(local.vault);
  await assert.rejects(saveCredentials({user:'bad',password:'bad'},'incorrect passphrase'),/Could not unlock/);
  assert.equal(JSON.stringify(local.vault),ciphertext);
  assert.deepEqual(await unlockCredentials('another fictional passphrase'),{user:'NEW-USER',password:'new-fictional-password'});
  assert.deepEqual((await blacklistState()).entries,before);
});
test('legacy credential-only vaults unlock and migrate without losing the login',async()=>{
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const enc=new TextEncoder(),base=await crypto.subtle.importKey('raw',enc.encode(PASSPHRASE),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt']);
  const old={user:'LEGACY-USER',password:'legacy-fictional-password'};
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(old)));
  const b64=v=>Buffer.from(v).toString('base64');local.vault={salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)};
  resetSession();assert.deepEqual(await unlockCredentials(PASSPHRASE),old);
  assert.deepEqual((await blacklistState()).entries,[]);
  await addBlacklistEntry('customer','1234',PASSPHRASE);resetSession();
  assert.deepEqual(await unlockCredentials(PASSPHRASE),old);
  assert.deepEqual((await blacklistState()).entries,[{kind:'customer',value:'1234'}]);
});

test('vault unlock markers are stable if browser storage reorders object properties',async()=>{
  const original=local.vault;local.vault={ciphertext:original.ciphertext,iv:original.iv,salt:original.salt};
  assert.equal((await blacklistState()).unlocked,true);
});
