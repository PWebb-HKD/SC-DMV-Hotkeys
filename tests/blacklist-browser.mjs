// Real extension/vault smoke test. Synthetic identifiers only; all HTTP traffic is blocked.
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {dependency} from './runtime.mjs';
const {chromium} = dependency('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(join(root, 'tests/tmp'), {recursive: true});
const profile = await mkdtemp(join(root, 'tests/tmp/blacklist-profile-'));
const extension = join(root, 'extension'), phrase = 'synthetic vault passphrase';
let context, httpRequests = 0;
async function launch() {
  context = await chromium.launchPersistentContext(profile, {executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    // Debian's launcher derives its extension allowlist from CHROMIUM_FLAGS.
    env: {...process.env, CHROMIUM_FLAGS: `${process.env.CHROMIUM_FLAGS || ''} --load-extension=${extension}`},
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]});
  await context.route(/^https?:\/\//, route => {httpRequests++; return route.abort();});
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker').catch(() => { throw new Error('Chromium did not load the unpacked extension. Check that browser policy permits local extensions; do not bypass a managed install policy.'); });
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForFunction(() => document.querySelector('#blacklistState').textContent.length > 0);
  return page;
}
async function panel(action) {
  const next = context.waitForEvent('page', {predicate: async page => {
    try { await page.waitForURL(url => url.pathname.endsWith('/panel.html'), {timeout: 5000}); return true; } catch { return false; }
  }});
  await action();
  const page = await next; await page.waitForLoadState(); return page;
}
async function send(page, message) {
  const response = await page.evaluate(message => chrome.runtime.sendMessage(message), message);
  assert.equal(response.ok, true, response.error); return response.value;
}
try {
  let page = await launch();
  await page.locator('#settingsTab').click();
  const setup = await panel(() => page.locator('#blacklistSetup').click());
  await setup.locator('#user').fill('SYNTHETIC-USER');await setup.locator('#password').fill('synthetic-password');await setup.locator('#savePass').fill(phrase);
  assert.equal(await setup.locator('#save').isChecked(), true);
  await setup.locator('#submit').click();
  await page.waitForFunction(() => !document.querySelector('#blacklistAdd').disabled);
  await page.locator('#blacklistKind').selectOption('customer');await page.locator('#blacklistValue').fill('00001234');await page.locator('#blacklistPassphrase').fill(phrase);await page.locator('#blacklistAdd').click();
  await page.waitForFunction(() => document.querySelectorAll('#blacklistEntries tr').length === 1);
  assert.match(await page.locator('#blacklistEntries').textContent(), /1234/);
  const encrypted = await page.evaluate(async () => JSON.stringify((await chrome.storage.local.get('vault')).vault));
  assert.equal(encrypted.includes('SYNTHETIC-USER'), false);assert.equal(encrypted.includes('synthetic-password'), false);
  assert.equal(encrypted.includes('"value":"1234"'), false);
  const input = await panel(() => send(page, {type: 'run', command: 'customer'}));
  await input.locator('#value').fill('00001234');
  const warning = await panel(() => input.locator('#submit').click());
  await warning.locator('.blacklist-panel .record-status-title').waitFor();
  assert.match(await warning.locator('.record-status-title').textContent(), /Customer number is blacklisted/);
  assert.equal(httpRequests, 0);
  await send(page, {type: 'stop'});
  await page.evaluate(() => chrome.storage.session.set({queue: {values: ['1234', '70000001'], index: 0}}));
  const queuedWarning = await panel(() => send(page, {type: 'run', command: 'next'}));
  await queuedWarning.locator('.blacklist-panel').waitFor();
  assert.equal((await send(page, {type: 'state'})).queue.index, 1);
  assert.equal(httpRequests, 0);
  await context.close(); context = null;
  page = await launch();await page.locator('#settingsTab').click();
  const locked = (await send(page, {type: 'state'})).blacklist;
  assert.equal(locked.hasVault, true);assert.equal(locked.unlocked, false);assert.deepEqual(locked.entries, []);
  await page.locator('#blacklistPassphrase').fill(phrase);await page.locator('#blacklistUnlock').click();
  await page.waitForFunction(() => document.querySelectorAll('#blacklistEntries tr').length === 1);
  assert.deepEqual((await send(page, {type: 'state'})).blacklist.entries, [{kind: 'customer', value: '1234'}]);
  assert.equal(httpRequests, 0);
  console.log('PASS real Chromium vault setup, encrypted storage, mandatory manual/queue blocking, browser restart, and passphrase unlock. No DMV HTTP requests.');
} finally {
  await context?.close(); await rm(profile, {recursive: true, force: true});
}
