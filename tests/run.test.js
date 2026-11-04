// Cancellation contracts across in-flight APIs and continuations.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SearchRun, guardedApi} from '../extension/run.js';
test('cancellation releases a wait immediately and suppresses late API continuations', async () => {
  const run = new SearchRun(); let resolve, continued = false;
  const api = guardedApi({slow: () => new Promise(r => { resolve = r; })}, run);
  const task = (async () => { await api.slow(); continued = true; })();
  await Promise.resolve(); run.cancel();
  await assert.rejects(task, {name: 'AbortError'});
  resolve('late result'); await Promise.resolve(); assert.equal(continued, false);
});
test('a cancelled run cannot issue subsequent browser mutations', async () => {
  const run = new SearchRun(); let calls = 0;
  const api = guardedApi({tabs: {update: async () => calls++}}, run);
  run.cancel(); await assert.rejects(api.tabs.update(1, {url: 'https://example.test'}), {name: 'AbortError'});
  assert.equal(calls, 0);
});
test('rejection from an obsolete API call remains handled after cancellation', async () => {
  const run = new SearchRun(); let reject;
  const task = run.step(() => new Promise((_, r) => { reject = r; }));
  await Promise.resolve(); run.cancel(); await assert.rejects(task, {name: 'AbortError'});
  reject(new Error('obsolete page failure')); await new Promise(resolve => setTimeout(resolve, 0));
});
