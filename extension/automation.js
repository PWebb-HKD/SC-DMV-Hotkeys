/**
 * Portal workflow layer: select a tab, establish a session, submit a search, and
 * discover its results. ctx carries cancellation plus UI callbacks supplied by the
 * service worker. All asynchronous browser operations must remain run-guarded.
 */
import {ROOT, MEMBER, LOGIN, ERROR_SELECTOR, samePage, isPortal, isPdf, loginSucceeded} from './core.js';
import {pageOperation} from './page.js';
import {guardedApi} from './run.js';
import {watchResults} from './results.js';

const TRANSACTIONS = `${MEMBER}Transactions/TransactionList.aspx`;
const LOGOFF = '#ContentPlaceHolder1_menuContainer > div > div:nth-child(1) > div:nth-child(1) > div.panel-body > ul > li:nth-child(1) > a';
const USER = '#ContentPlaceHolder1_userNameText', PASS = '#ContentPlaceHolder1_passwordText';
const api = ctx => guardedApi(chrome, ctx?.run);
export const delay = (ms, ctx) => ctx?.run ? ctx.run.step(() => new Promise(resolve => setTimeout(resolve, ms))) : new Promise(resolve => setTimeout(resolve, ms));
/** Run one self-contained DOM operation in the page MAIN world and return its result. */
export async function evaluate(tabId, op, args = {}, ctx) {
  const results = await api(ctx).scripting.executeScript({target: {tabId}, world: 'MAIN', func: pageOperation, args: [op, args]});
  if (!results.length) throw new Error('The page could not be accessed.');
  return results[0].result;
}
async function state(tabId, selector, ctx) { return evaluate(tabId, 'state', {selector, errorSelector: ERROR_SELECTOR}, ctx); }
async function click(tabId, selector, ctx) {
  try { await evaluate(tabId, 'click', {selector}, ctx); }
  catch (e) { if (!/frame.*removed|context.*invalidated|document.*unloaded/i.test(e.message)) throw e; }
}
/** Poll until a truthy result or deadline; cancellation is checked across every await. */
async function until(fn, description, ms = 60000, ctx) {
  const end = Date.now() + ms;
  while (Date.now() < end) { ctx?.run?.check(); const v = await fn(); ctx?.run?.check(); if (v) return v; await delay(350, ctx); }
  throw new Error(`Timed out waiting for ${description}. The site may need your attention.`);
}
/** Wait for a completed page with controls, surfacing visible website errors. */
async function ready(tabId, selector, ctx) {
  return until(async () => {
    const tab = await api(ctx).tabs.get(tabId);
    if (tab.status !== 'complete') return false;
    let s; try { s = await state(tabId, selector, ctx); } catch { ctx?.run?.check(); return false; }
    if (s.errors.length) throw new Error(s.errors.join('\n'));
    if (samePage(s.url, LOGIN)) throw new Error('Your DMV session has expired. Run the command again to sign in.');
    return s.present && s;
  }, 'the search page controls', 60000, ctx);
}
async function navigate(tabId, url, ctx) {
  await api(ctx).tabs.update(tabId, {url}); // The workflow has already focused its portal tab.
  await until(async () => {
    const t = await api(ctx).tabs.get(tabId); return t.status === 'complete' && samePage(t.url, url);
  }, 'the page to load', 60000, ctx);
}
/** Activate the tab and restore/focus its window before automation and on results/errors. */
export async function focusTab(tabId, ctx) {
  const tab = await api(ctx).tabs.get(tabId);
  await api(ctx).tabs.update(tabId, {active: true});
  const win = await api(ctx).windows.get(tab.windowId);
  if (win.state === 'minimized') await api(ctx).windows.update(win.id, {state: 'normal'});
  await api(ctx).windows.update(win.id, {focused: true});
}
/** Reuse a portal tab but exclude PDF results, preserving those reports for follow-ups. */
export async function portalTab(ctx) {
  const {portalId} = await api(ctx).storage.session.get('portalId');
  const tabs = (await api(ctx).tabs.query({url: `${ROOT}/*`})).filter(t => isPortal(t.url));
  const target = tabs.find(t => t.id === portalId) || tabs.find(t => t.active) || tabs.sort((a,b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || await api(ctx).tabs.create({url: LOGIN, active: false});
  await api(ctx).storage.session.set({portalId: target.id});
  // A fresh session skips login, so focus cannot be left to the login path.
  await focusTab(target.id, ctx);
  return target;
}
/** Use extension credentials exclusively, notify form handlers, and allow synchronization
 * before submission. Any completed same-origin redirect away from logon verifies success. */
async function login(tabId, ctx) {
  ctx.status('Checking DMV login');
  const current = await api(ctx).tabs.get(tabId);
  // Reuse the login page, but never use its existing fields as credentials.
  if (!samePage(current.url, LOGIN)) await api(ctx).tabs.update(tabId, {url: LOGIN});
  await focusTab(tabId, ctx);
  await until(async () => {
    const t = await api(ctx).tabs.get(tabId); if (t.status !== 'complete') return false;
    if (loginSucceeded(t.url)) return true;
    try {
      const form = await evaluate(tabId, 'state', {selectors: [USER, PASS] }, ctx);
      return form.presentSelectors.every(Boolean);
    } catch { ctx.run?.check(); return false; }
  }, 'the login form', 60000, ctx);
  if (samePage((await api(ctx).tabs.get(tabId)).url, LOGIN)) {
    const saved = await ctx.credentials(tabId);
    ctx.run?.check();
    if (!saved) throw new Error('Login cancelled.');
    const credentials = {user: String(saved.user || '').trim(), password: String(saved.password || '')};
    if (!credentials.user || !credentials.password) throw new Error('User ID and password are required.');
    if (loginSucceeded((await api(ctx).tabs.get(tabId)).url)) return;
    await focusTab(tabId, ctx);
    const fields = {selectors: [USER, PASS], credentials, button: '#ContentPlaceHolder1_loginButton'};
    await evaluate(tabId, 'extensionLogin', fields, ctx);
    // Allow form handlers to synchronize after extension autofill.
    await delay(1000, ctx);
    const destination = await api(ctx).tabs.get(tabId);
    if (loginSucceeded(destination.url) && destination.status === 'complete') return;
    await delay(100, ctx);
    await focusTab(tabId, ctx);
    // Reassert extension values and click in one page operation, preventing a
    // late browser autofill from selecting a different account for submission.
    try { await evaluate(tabId, 'extensionLogin', {...fields, submit: true}, ctx); }
    catch (error) {
      // A successful form post may unload the document before the script's
      // response arrives. Verify the destination instead of reporting failure.
      if (!/frame.*removed|context.*invalidated|document.*unloaded/i.test(error.message)) throw error;
    }
    await until(async () => {
      const t = await api(ctx).tabs.get(tabId);
      if (t.status !== 'complete') return false;
      if (loginSucceeded(t.url)) return true;
      const s = await state(tabId, undefined, ctx);
      if (s.errors.length) throw new Error(s.errors.join('\n'));
      if (!samePage(t.url, LOGIN)) throw new Error('The website requires an additional login step or password update. Complete it in the browser, then run the command again.');
      return false;
    }, 'a successful redirect away from the login page on the SCDMV site', 30000, ctx);
  }
  // Any completed same-origin redirect away from logon.aspx verifies login.
}
/** Use the ten-minute activity hint, with login redirects checked again by search(). */
async function ensureSession(tabId, ctx) {
  const {lastQuery = 0} = await api(ctx).storage.session.get('lastQuery');
  const t = await api(ctx).tabs.get(tabId);
  const reused = Date.now() - lastQuery < 600000 && !samePage(t.url, LOGIN);
  if (!reused) await login(tabId, ctx);
  return reused;
}
/** Inspect only the first requested search page after bypassing login. Never retry a
 * submitted transaction: the broken-session redirect happens before any form fill. */
async function initialSearchPage(tabId, url, reusedSession, ctx) {
  const load = async () => {
    await api(ctx).tabs.update(tabId, {url});
    return until(async () => {
      const tab = await api(ctx).tabs.get(tabId);
      return tab.status === 'complete' && !tab.pendingUrl && tab;
    }, 'the search form', 60000, ctx);
  };
  let page = await load();
  if (reusedSession && samePage(page.url, TRANSACTIONS)) {
    ctx.status('Recovering DMV session: logging off and signing in');
    // A failed/cancelled recovery must not leave the old ten-minute hint valid.
    await api(ctx).storage.session.set({lastQuery: 0});
    await focusTab(tabId, ctx);
    await click(tabId, LOGOFF, ctx);
    await until(async () => {
      const tab = await api(ctx).tabs.get(tabId);
      return tab.status === 'complete' && !samePage(tab.url, TRANSACTIONS);
    }, 'DMV log off to finish', 30000, ctx);
    await login(tabId, ctx);
    page = await load();
    if (samePage(page.url, TRANSACTIONS)) throw new Error('The DMV returned to the transaction list again after signing in. Please check the website and try again.');
  }
  return page;
}
const SEARCHES = {
  plate: ['VehRec', '', '#ContentPlaceHolder1_txtPlateNbr'],
  license: ['DrvRec', '?opt=CP', '#ContentPlaceHolder1_dlNumberTextBox'],
  customer: ['DrvRec', '?opt=CP', '#ContentPlaceHolder1_idNumberTextBox'],
  address: ['DrvSameRes', '', '#ContentPlaceHolder1_txtDLNumber']
};
/** Run a plate/license/customer/address transaction using the shared Page1/Page2 flow. */
export async function search(kind, value, ctx) {
  const tab = await portalTab(ctx); ctx.tabId = tab.id;
  const reusedSession = await ensureSession(tab.id, ctx);
  const [path, query, selector] = SEARCHES[kind];
  const base = `${MEMBER}Transactions/${path}/`;
  ctx.status(`Submitting ${kind} search`);
  const firstPage = await initialSearchPage(tab.id, `${base}Page1.aspx${query}`, reusedSession, ctx);
  // Sessions can expire early; do not rely solely on the ten-minute clock.
  if (samePage(firstPage.url, LOGIN)) {
    await login(tab.id, ctx); await navigate(tab.id, `${base}Page1.aspx${query}`, ctx);
  }
  await ready(tab.id, selector, ctx);
  if (kind === 'plate') {
    await click(tab.id, '#ContentPlaceHolder1_rblReportType_0', ctx);
    await delay(500, ctx); await ready(tab.id, selector, ctx);
  }
  await evaluate(tab.id, 'fill', {selector, value}, ctx);
  await click(tab.id, '#btnFooterNavNext', ctx);
  await until(async () => {
    const t = await api(ctx).tabs.get(tab.id);
    if (t.status !== 'complete') return false;
    const s = await state(tab.id, undefined, ctx);
    if (s.errors.length) throw new Error(s.errors.join('\n'));
    if (samePage(t.url, LOGIN)) throw new Error('The DMV session expired during the search. Please run it again.');
    return samePage(t.url, `${base}Page2.aspx`);
  }, 'search results', 60000, ctx);
  await ready(tab.id, '#downloadButton', ctx);
  const watcher = await watchResults(tab.id, ctx);
  let result;
  try {
    watcher.arm();
    await click(tab.id, '#downloadButton', ctx);
    result = await until(() => watcher.find(), 'the PDF results tab', 60000, ctx);
  } finally { watcher.dispose(); }
  const readyResult = {tabId: result.tab.id, portalId: tab.id, sourceUrl: result.sourceUrl, reused: result.reused, startedAt: result.startedAt};
  await api(ctx).storage.session.set({lastQuery: Date.now()});
  if (ctx.resultReady) await ctx.resultReady(readyResult);
  await focusTab(result.tab.id, ctx);
  ctx.status('Results ready');
  return readyResult;
}
const SC_NAME = '#home > div > div.col-xs-12.row > div:nth-child(3) > div.panel-body > div:nth-child(1) > div:nth-child(1) > input';
const SC_DOB = '#home > div > div.col-xs-12.row > div:nth-child(3) > div.panel-body > div:nth-child(1) > div:nth-child(2) > input';
const SC_SEARCH = '#home > div > div.col-xs-12.row > div:nth-child(3) > div.panel-body > div:nth-child(1) > div.col-xs-8 > button:nth-child(2)';
/** Follow the portal handoff, request access only for the destination origin, and wait
 * for the real form. Notify both fields after filling before clicking Search. */
export async function scutties(identity, ctx) {
  const tab = await portalTab(ctx); ctx.tabId = tab.id;
  await ensureSession(tab.id, ctx);
  await api(ctx).tabs.update(tab.id, {url: `${MEMBER}Transactions/TransactionList.aspx`});
  await ready(tab.id, 'a[href="/SCTRNS/Member/Transactions/SCUTTIES/SCUTTIES.aspx"]', ctx);
  const previous = new Set((await api(ctx).tabs.query({})).map(t => t.id));
  await click(tab.id, 'a[href="/SCTRNS/Member/Transactions/SCUTTIES/SCUTTIES.aspx"]', ctx);
  ctx.status('Waiting for SCUTTIES sign-in and search form');
  let destination, focusedDestination = tab.id;
  await until(async () => {
    const tabs = await api(ctx).tabs.query({});
    const children = tabs.filter(t => !previous.has(t.id) && t.openerTabId === tab.id);
    const candidates = [...children, await api(ctx).tabs.get(tab.id)];
    for (const t of candidates) {
      if (t.id === candidates[0].id && t.id !== focusedDestination) {
        await focusTab(t.id, ctx); focusedDestination = t.id;
      }
      if (t.status !== 'complete' || !/^https:\/\//i.test(t.url || '')) continue;
      ctx.tabId = t.id;
      const origin = `${new URL(t.url).origin}/*`;
      if (!await api(ctx).permissions.contains({origins: [origin]})) {
        await ctx.permission(origin); // Explicit user gesture in panel grants only this origin.
        await focusTab(t.id, ctx); // The permission popup may have taken focus.
      }
      const s = await state(t.id, SC_NAME, ctx);
      if (s.errors.length) throw new Error(s.errors.join('\n'));
      if (s.present) { destination = t; return true; }
    }
    return false;
  }, 'the SCUTTIES search inputs (complete any interactive login in the browser)', 180000, ctx);
  ctx.tabId = destination.id;
  await focusTab(destination.id, ctx);
  await evaluate(destination.id, 'fill', {selector: SC_NAME, value: identity.lastName}, ctx);
  await evaluate(destination.id, 'fill', {selector: SC_DOB, value: identity.dob}, ctx);
  // Notify both controls after both values exist, so delegated handlers can
  // update the complete search model instead of observing a partial form.
  await evaluate(destination.id, 'notifyInputs', {selectors: [SC_NAME, SC_DOB]}, ctx);
  await delay(100, ctx);
  await until(async () => {
    const form = await state(destination.id, SC_SEARCH, ctx);
    if (form.errors.length) throw new Error(form.errors.join('\n'));
    return form.present && form.enabled;
  }, 'SCUTTIES to enable its Search button', 10000, ctx);
  await click(destination.id, SC_SEARCH, ctx);
  await delay(900, ctx);
  // No SCUTTIES result selector was supplied; expose the response for user review.
  const s = await state(destination.id, undefined, ctx);
  if (s.errors.length) throw new Error(s.errors.join('\n'));
  await api(ctx).storage.session.set({lastQuery: Date.now()});
  await focusTab(destination.id, ctx);
}
