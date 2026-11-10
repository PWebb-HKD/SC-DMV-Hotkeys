/**
 * Identify the PDF produced by a particular Download click, including reused named tabs
 * and Chromium viewer wrappers. Related ErrorPage.aspx tabs are returned as failures.
 * PDF discovery deliberately does not require load completion.
 * The caller must arm before clicking and dispose listeners in a finally block.
 */
import {attachmentUrl, isPortalErrorPage} from './core.js';
import {guardedApi} from './run.js';

// Listen before clicking Download: PDF viewers may never report 'complete',
// and named windows may reuse a pre-existing results tab.
export async function watchResults(portalId, ctx = {}) {
  const api = guardedApi(chrome, ctx.run);
  const before = new Map((await api.tabs.query({})).map(tab => [tab.id, {...tab}]));
  const changed = new Map();
  let armed = false, sequence = 0;
  // Track only changes after Download is armed, including named-window reuse at an unchanged URL.
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
    /** Begin attributing tab events to this Download click. */
    arm() { this.startedAt = Date.now(); armed = true; },
    /** Rank new/navigated results; return related server errors distinctly from PDF source matches. */
    async find() {
      ctx.run?.check();
      const tabs = await api.tabs.query({});
      const candidates = [];
      for (const current of tabs) {
        const event = changed.get(current.id), tab = {...event?.tab, ...current};
        const sourceUrl = attachmentUrl(tab.pendingUrl) || attachmentUrl(tab.url);
        const old = before.get(tab.id);
        const errorPage = !sourceUrl && (isPortalErrorPage(tab.pendingUrl) || isPortalErrorPage(tab.url));
        if (!sourceUrl && !errorPage) continue;
        // Error pages must belong to this transaction, never an unrelated window.
        if (errorPage && tab.id !== portalId && tab.openerTabId !== portalId && old?.openerTabId !== portalId) continue;
        const changedUrl = old && (old.url !== tab.url || old.pendingUrl !== tab.pendingUrl);
        const navigated = !!(event?.navigated || changedUrl || old?.status === 'complete' && tab.status === 'loading');
        if (old && !navigated) continue; // Never select an unchanged historical PDF.
        if (tab.id !== portalId && tab.openerTabId != null && tab.openerTabId !== portalId) continue;
        const score = (tab.openerTabId === portalId ? 1000 : tab.id === portalId ? 900 : 0) + (event?.sequence || 0);
        candidates.push({tab, sourceUrl, reused: !!old, score, ...(errorPage ? {errorPage: true} : {})});
      }
      candidates.sort((a, b) => b.score - a.score);
      const match = candidates[0];
      return match && {...match, startedAt: this.startedAt};
    },
    /** Release both listeners whether discovery succeeded, failed, or was cancelled. */
    dispose() { chrome.tabs.onCreated.removeListener(created); chrome.tabs.onUpdated.removeListener(updated); }
  };
}
