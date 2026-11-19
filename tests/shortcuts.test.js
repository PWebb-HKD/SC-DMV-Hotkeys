// Manifest policy: preferred keys remain unassigned for manual Global setup.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMMANDS} from '../extension/core.js';
test('manifest leaves browser shortcuts unassigned and declares their global scope', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url)));
  const assigned = Object.fromEntries(Object.entries(manifest.commands).filter(([, command]) => command.suggested_key).map(([name, command]) => [name, command.suggested_key.default]));
  assert.deepEqual(assigned, {});
  assert.deepEqual(Object.keys(manifest.commands).sort(), Object.keys(COMMANDS).sort());
  assert.equal(COMMANDS.previous.key, 'Alt+M');
  assert.equal(COMMANDS.help.key, 'Alt+H');
  for (const command of Object.values(manifest.commands)) assert.equal(command.global, true);
});

test('browser-only release requires neither native messaging nor retry alarms', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url)));
  assert.equal(manifest.permissions.includes('nativeMessaging'), false);
  assert.equal(manifest.permissions.includes('alarms'), false);
});

test('host access is restricted to the DMV origin without broad optional permissions',()=>{
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url)));
  assert.deepEqual(manifest.host_permissions,['https://www.scdmvonline.com/*']);
  assert.deepEqual(manifest.optional_host_permissions||[],[]);
});
