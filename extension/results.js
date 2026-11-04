/**
 * Identify the PDF produced by a particular Download click, including reused named tabs
 * and Chromium viewer wrappers. Discovery deliberately does not require load completion.
 * The caller must arm before clicking and dispose listeners in a finally block.
 */
import {attachmentUrl} from './core.js';
import {guardedApi} from './run.js';

// Listen before clicking Download: PDF viewers may never report 'complete',
// and named windows may reuse a pre-existing results tab.
export async function watchResults(portalId, ctx = {}) {
  const api = guardedApi(chrome, ctx.run);
  const before = new Map((await api.tabs.query({})).map(tab => [tab.id, {...tab}]));
  const changed = new Map();
  let armed = false, sequence = 0;
  const record = (tab, change = {}) => {
    if (!armed) return;
    const prior = changed.get(tab.id);
    changed.set(tab.id, {tab: {...prior?.tab, ...tab}, sequence: ++sequence,
      navigated: !!(prior?.navigated || change.url || change.pendingUrl || change.status === 'loading')});
  };
  const created = tab => record(tab, {url: tab.pendingUrl || tab.url});
  const updated = (id, change, tab) => record({...tab, id}, change);
  chrome.tabs.onCreated.addListener(created); chrome.tabs.onUpdated.addListener(updated);
  return {
    startedAt: 0,
    arm() { this.startedAt = Date.now(); armed = true; },
    async find() {
      ctx.run?.check();
      const tabs = await api.tabs.query({});
      const candidates = [];
      for (const current of tabs) {
        const event = changed.get(current.id), tab = {...event?.tab, ...current};
        const sourceUrl = attachmentUrl(tab.pendingUrl) || attachmentUrl(tab.url);
        if (!sourceUrl) continue;
        const old = before.get(tab.id);
        const changedUrl = old && (old.url !== tab.url || old.pendingUrl !== tab.pendingUrl);
        const navigated = !!(event?.navigated || changedUrl || old?.status === 'complete' && tab.status === 'loading');
        if (old && !navigated) continue; // Never select an unchanged historical PDF.
        if (tab.id !== portalId && tab.openerTabId != null && tab.openerTabId !== portalId) continue;
        const score = (tab.openerTabId === portalId ? 1000 : tab.id === portalId ? 900 : 0) + (event?.sequence || 0);
        candidates.push({tab, sourceUrl, reused: !!old, score});
      }
      candidates.sort((a, b) => b.score - a.score);
      const match = candidates[0];
      return match && {...match, startedAt: this.startedAt};
    },
    dispose() { chrome.tabs.onCreated.removeListener(created); chrome.tabs.onUpdated.removeListener(updated); }
  };
}
