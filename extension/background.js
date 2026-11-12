/**
 * Service-worker coordinator. Browser commands enter dispatch(), which creates one
 * cancellable SearchRun. This module owns panels, PDF snapshots, history, queue state,
 * credentials requests, and message authorization; DOM work belongs to page.js.
 * See DEVELOPMENT.md for the lifecycle and storage/message contracts.
 */
import {COMMANDS, ROOT, PDF_URL, attachmentUrl, isPdf, isPortal, normalize, ownerNumbers, isResidenceReport, driverLicense, driverIdentity, historySearch} from './core.js';
import {search, scutties, evaluate, focusTab, PortalSearchError} from './automation.js';
import {saveCredentials, unlockCredentials, blacklistState, addBlacklistEntry, removeBlacklistEntry, forgetCredentials, replaceCredentials, clearSavedUserInfo} from './vault.js';
import {checkBlacklist, driverIdentifiers, validateBlacklist, BlacklistedSearchError} from './blacklist.js';
import {SearchRun, guardedApi, isCancelled} from './run.js';
import {recordStatus, unavailableAlert} from './status-alerts.js';
import {initializeAlertPreferences, saveAlertPreferences, restoreAlertPreferences} from './alert-settings.js';
import {AudioAlerts, availableVoices} from './audio-alerts.js';
import {configureDmvTheme, initDmvTheme, refreshDmvThemeTabs, isDmvThemePage} from './dmv-theme-settings.js';
import {darkResultSource, setPdfRouting, isNativePrintUrl} from './pdf-routing.js';
import {reportBarcode, reportBarcodeDraft, VehiclePartyError} from './barcode-data.js';
const audioAlerts = new AudioAlerts();

// In-memory Maps hold live callbacks. Session storage holds view/report data, not
// resumable jobs. openingPanel and tracking serialize two independent mutation streams.
let resettingUserInfo = null;
let activeRun = null, openingPanel = Promise.resolve(), tracking = Promise.resolve();
let openingShortcutMenu = null, shortcutMenuRun = null;
let savingShortcutMenuSettings = Promise.resolve();
const panels = new Map(), readers = new Map(), captures = new Map();
const boot = Promise.all([
  chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'}),
  chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'}),
  // Delete legacy disk history without importing it; preserve current session history.
  // Worker startup also covers unpacked-extension reloads.
  chrome.storage.local.remove('history'),
  // Retire the removed shortcut-pause preference on update or worker startup.
  chrome.storage.session.remove('shortcutsPaused'),
  chrome.storage.local.get('pdfDarkMode').then(({pdfDarkMode}) => setPdfRouting(pdfDarkMode === true)),
  initializeAlertPreferences(),
  configureDmvTheme().catch(error=>chrome.storage.session.set({status:`DMV website dark mode unavailable: ${error.message}`}))
]);
/** Replace the active command and cancel its readers, audio, and panels. Callers await
 * run.cleanup before opening new UI; late-created windows also check this run. */
function beginRun() {
  shortcutMenuRun?.cancel();
  audioAlerts.stop();
  activeRun?.cancel();
  for (const capture of captures.values()) capture.run.cancel();
  const run = new SearchRun(); activeRun = run;
  const cleanup = [];
  for (const [id, entry] of panels) {
    entry.run?.cancel();
    clearTimeout(entry.timer); panels.delete(id); entry.resolve?.(null);
    cleanup.push(chrome.storage.session.remove(`panel:${id}`));
    if (entry.windowId != null) cleanup.push(chrome.windows.remove(entry.windowId).catch(() => {}));
  }
  run.cleanup = Promise.all(cleanup);
  return run;
}
/** Serialize read/modify/write updates to tab metadata without letting one failed
 * update permanently poison the chain. */
function track(fn) { const task = tracking.then(fn); tracking = task.catch(() => {}); return task; }

/** Register a panel before opening its window, then check cancellation again after
 * the asynchronous create. This closes the race with Stop or disabling alerts. */
async function createPanel(data, callbacks = {}, run) {
  run?.check();
  const id = crypto.randomUUID();
  const entry = {windowId: null, data, run, ...callbacks};
  panels.set(id, entry);
  await chrome.storage.session.set({[`panel:${id}`]: data});
  if (data.type === 'record-alert' && !data.blacklist && !(await chrome.storage.session.get('alertsEnabled')).alertsEnabled) entry.cancelled = true;
  if (entry.cancelled || run?.signal.aborted) {
    panels.delete(id); await chrome.storage.session.remove(`panel:${id}`); run?.check(); return null;
  }
  let win;
  try { run?.check(); win = await chrome.windows.create({url: chrome.runtime.getURL(`${data.type === 'barcode' ? 'barcode' : data.type === 'shortcut-menu' ? 'shortcut-menu' : 'panel'}.html?id=${id}`), type: 'popup', width: data.type === 'shortcut-menu' ? 360 : data.type === 'barcode' ? 1020 : (data.type === 'record-alert' || data.type === 'barcode-owner-incomplete') ? 580 : 460, height: data.type === 'shortcut-menu' ? 600 : data.type === 'barcode' ? 800 : data.type === 'credentials' ? 720 : data.type === 'barcode-owner-incomplete' ? 520 : data.type === 'record-alert' ? 620 : 430, focused: true}); }
  catch (e) { panels.delete(id); await chrome.storage.session.remove(`panel:${id}`); throw e; }
  entry.windowId = win.id;
  if (run?.signal.aborted || entry.cancelled) {
    panels.delete(id); await chrome.storage.session.remove(`panel:${id}`);
    await chrome.windows.remove(win.id).catch(() => {}); run?.check(); return null;
  }
  return {id, entry};
}
/** Open one launcher without interrupting current work. Capture its source before
 * focusing it; a later action starts the same workflow as a direct shortcut. */
function openShortcutMenu() {
  if (openingShortcutMenu) return openingShortcutMenu;
  openingShortcutMenu = (async()=>{
    const run = new SearchRun(); shortcutMenuRun = run;
    try {
      await run.step(()=>boot);
      const existing = [...panels.values()].find(entry=>entry.data.type === 'shortcut-menu');
      if (existing) {await run.step(()=>chrome.windows.update(existing.windowId,{focused:true,state:'normal'}));return;}
      const source = await run.step(()=>sourceTab());
      const {shortcutMenuNoTimeout,shortcutMenuAlwaysOnTop} = await run.step(()=>chrome.storage.local.get(['shortcutMenuNoTimeout','shortcutMenuAlwaysOnTop']));
      await createPanel({type:'shortcut-menu',sourceId:source?.id,noTimeout:shortcutMenuNoTimeout===true||shortcutMenuAlwaysOnTop===true,alwaysOnTop:shortcutMenuAlwaysOnTop===true},{},run);
    } finally {if (shortcutMenuRun === run) shortcutMenuRun = null;}
  })().finally(()=>{openingShortcutMenu = null;});
  return openingShortcutMenu;
}
/** Open an interactive panel and await its reply, cancellation, close, or timeout. */
async function ask(data, run) {
  let resolver, rejecter;
  const promise = new Promise((resolve, reject) => { resolver = resolve; rejecter = reject; });
  const {id, entry} = await createPanel(data, {resolve: resolver, reject: rejecter}, run);
  run?.check();
  entry.timer = setTimeout(() => {
    panels.delete(id); chrome.storage.session.remove(`panel:${id}`);
    chrome.windows.remove(entry.windowId).catch(() => {}); rejecter(new Error('The request timed out.'));
  }, 180000);
  return run ? run.step(() => promise) : promise;
}
/** Open a noninteractive message panel using the same cancellation checks as other worker-owned UI. */
async function notice(message, extra = {}, run) { await createPanel({type: 'notice', message, ...extra}, {}, run); }
/** Publish only errors belonging to the current run; AbortError is expected control flow. */
async function report(error, tabId, run) {
  if (isCancelled(error) || run?.signal.aborted) return;
  const message = error?.message || String(error);
  try {
    await guardedApi(chrome, run).storage.session.set({status: message});
    if (tabId) await focusTab(tabId, {run});
    await notice(message, {}, run);
  } catch (e) { if (!isCancelled(e)) throw e; }
}
/** Capture the focused tab once so follow-up commands retain their original report context. */
async function sourceTab() {
  const active = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  return active[0];
}
/** Prefer the focused report; otherwise select the newest tracked results tab. */
async function pdfTab(source, run) {
  run?.check();
  const {pdfViewSources = {}} = await guardedApi(chrome, run).storage.session.get('pdfViewSources');
  const isView = tab => pdfViewSources[tab.id] === true ? tab.url?.startsWith(chrome.runtime.getURL('reader.html') + '?') : typeof pdfViewSources[tab.id] === 'string' && (isNativePrintUrl(tab.url,pdfViewSources[tab.id]) || isNativePrintUrl(tab.pendingUrl,pdfViewSources[tab.id]));
  if (source && isView(source)) return source;
  if (source && (isPdf(source.url) || isPdf(source.pendingUrl))) return source;
  const api = guardedApi(chrome, run);
  const tabs = (await api.tabs.query({})).filter(t => isPdf(t.url) || isPdf(t.pendingUrl) || isView(t));
  if (!tabs.length) throw new Error('No open SCDMV PDF results tab was found.');
  const {pdfCreated = {}} = await api.storage.session.get('pdfCreated');
  // Chromium tab IDs are used only as a fallback for tabs predating installation.
  return tabs.sort((a,b) => (pdfCreated[b.id] || b.id) - (pdfCreated[a.id] || a.id))[0];
}
/** Capture one report snapshot per tab. The fixed attachment URL is session-dependent;
 * never refetch an untracked historical report and assume it is the same person. */
async function capturePdf(tab, portalId, forceDirect = false) {
  const existing = captures.get(tab.id);
  if (existing && !existing.run.signal.aborted) return existing.promise;
  const run = new SearchRun(), api = guardedApi(chrome, run);
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => {resolveReady = resolve; rejectReady = reject;});
  ready.catch(() => {}); // Temporary extraction readers do not need the direct-start handshake.
  const capture = {run, ready, attached: false, sameTab: forceDirect};
  const task = Promise.resolve().then(async () => {
    const cacheKey = `pdf:${tab.id}`;
    if ((await api.storage.session.get(cacheKey))[cacheKey]?.text) {resolveReady(null);return;}
    const {pdfDarkMode = false} = await api.storage.local.get('pdfDarkMode');
    capture.sameTab = forceDirect || !!darkResultSource(tab.pendingUrl || tab.url, chrome.runtime.getURL('reader.html')) || (pdfDarkMode && !!portalId);
    const {pdfCreated = {}, pdfSources = {}} = await api.storage.session.get(['pdfCreated', 'pdfSources']);
    if (!pdfCreated[tab.id]) throw new Error('This PDF predates extension tracking. Run its search again so the extension can capture the correct report.');
    const portal = portalId ? await api.tabs.get(portalId).catch(() => null) : null;
    const candidates = portal ? [portal] : (await api.tabs.query({url: `${ROOT}/*`})).filter(t => isPortal(t.url));
    const parent = candidates.find(t => t.id === tab.openerTabId) || candidates[0];
    let base64 = null;
    const sourceUrl = attachmentUrl(tab.pendingUrl) || attachmentUrl(tab.url) || pdfSources[tab.id] || PDF_URL;
    if (parent) {
      try { base64 = await evaluate(parent.id, 'fetchPdf', {url: sourceUrl}, {run}); } catch { run.check(); }
    }
    const id = crypto.randomUUID();
    const promise = new Promise((resolve, reject) => {readers.set(id, {resolve, reject, base64, url: sourceUrl, pdfId: tab.id});});
    let readerTab, timer;
    try {
      run.check();
      readerTab = capture.sameTab ? tab : await api.tabs.create({url: chrome.runtime.getURL(`reader.html?id=${id}`), active: false});
      const reader = readers.get(id); reader.tabId = readerTab.id;
      const cancelled = () => chrome.runtime.sendMessage({target:'pdf-reader',type:'reader-cancel',id}).catch(() => {});
      if(capture.sameTab)run.signal.addEventListener('abort',cancelled,{once:true});
      reader.cancelled = cancelled;
      resolveReady({id, base64, url: sourceUrl, sameTab: capture.sameTab});
      timer = setTimeout(() => reader.reject(new Error('PDF text extraction timed out.')), 45000);
      const text = await run.step(() => promise);
      if (!text.trim()) throw new Error('This PDF has no extractable text. Scanned PDFs require OCR; enter a number manually.');
      await api.storage.session.set({[cacheKey]: {text, capturedAt: Date.now(), ...(capture.documentId ? {documentId:capture.documentId} : {})}});
      if (capture.sameTab) await track(async () => {
        const {pdfViewSources = {}} = await api.storage.session.get('pdfViewSources');
        pdfViewSources[tab.id] = true; await api.storage.session.set({pdfViewSources});
      });
      if (reader.viewerError) await api.storage.session.set({status: `PDF dark view unavailable: ${reader.viewerError}`});
    } finally {
      clearTimeout(timer);
      run.signal.removeEventListener('abort',readers.get(id)?.cancelled);
      readers.delete(id);
      if (readerTab && !capture.sameTab) await chrome.tabs.remove(readerTab.id).catch(() => {});
    }
  });
  capture.promise = task; captures.set(tab.id, capture);
  try { await task; } catch (error) {rejectReady(error);throw error;}
  finally { if (captures.get(tab.id) === capture) captures.delete(tab.id); }
}
/** The redirected document joins its tab-bound capture; it never opens a second results tab. */
async function attachPdfViewer(sender) {
  const readerUrl = chrome.runtime.getURL('reader.html'), source = darkResultSource(sender.url, readerUrl);
  if (!source || sender.tab?.id == null || sender.frameId !== 0 || new URL(sender.url).searchParams.has('id')) throw new Error('Unknown PDF results page. Run its search again.');
  const tab = await chrome.tabs.get(sender.tab.id);
  if (darkResultSource(tab.url, readerUrl) !== source) throw new Error('The PDF results tab has changed.');
  await tracking;
  let capture = captures.get(tab.id), job;
  if (capture?.documentId && capture.documentId !== sender.documentId)capture.run.cancel();
  if (capture && !capture.run.signal.aborted && !capture.attached) {
    capture.documentId = sender.documentId;job = await capture.ready;capture.run.check();
  }
  if (!job?.sameTab) {
    capture?.run.cancel();
    await track(async () => {
      const {pdfCreated = {}, pdfSources = {}} = await chrome.storage.session.get(['pdfCreated','pdfSources']);
      pdfCreated[tab.id] = Date.now(); pdfSources[tab.id] = source;
      await chrome.storage.session.set({pdfCreated, pdfSources});
      await chrome.storage.session.remove(`pdf:${tab.id}`);
    });
    // Completion is consumed by resultReady()/pdfText(), or recorded here for a manual DMV download.
    capturePdf(tab, undefined, true).catch(error => {
      if (!isCancelled(error)) chrome.storage.session.set({status: `PDF follow-ups unavailable: ${error.message}`}).catch(() => {});
    });
    capture = captures.get(tab.id);capture.documentId = sender.documentId;job = await capture.ready;
  }
  if (!job || capture.attached) throw new Error('This PDF was already opened. Run its search again.');
  capture.run.check(); capture.attached = true;
  const reader = readers.get(job.id); reader.documentId = sender.documentId;
  return job;
}
/** A trusted reader owns the original Blob and its text; printing does not need
 * background capture jobs, mutable tab URLs, or webNavigation frame metadata. */
async function openNativePrint(sender,url,reportText) {
  if(!sender.tab || !sender.url?.startsWith(chrome.runtime.getURL('reader.html')+'?') || sender.frameId!==0) throw new Error('Open the report in the PDF viewer before using Print.');
  const prefix=`blob:${chrome.runtime.getURL('')}`;
  if(typeof url!=='string' || !url.startsWith(prefix) || !/^[a-f0-9-]{36}$/i.test(url.slice(prefix.length))) throw new Error('The original PDF file could not be prepared. Reopen the report and try Print again.');
  // The text comes from the same loaded document that created the immutable Blob.
  // Never borrow a different report's text from the shared tab/session cache.
  const text=typeof reportText==='string' && reportText.length<=1000000 ? reportText : '';
  return track(async()=>{
    const {pdfCreated={},pdfViewSources={}}=await chrome.storage.session.get(['pdfCreated','pdfViewSources']);
    for(const [id,knownUrl] of Object.entries(pdfViewSources)) {
      if(knownUrl!==url)continue;
      const tab=await chrome.tabs.get(+id).catch(()=>null);
      if(tab&&(isNativePrintUrl(tab.url,url)||isNativePrintUrl(tab.pendingUrl,url))) {await focusTab(tab.id);return true;}
    }
    const tab=await chrome.tabs.create({url,active:true,openerTabId:sender.tab.id});
    try {
      pdfViewSources[tab.id]=url;pdfCreated[tab.id]=pdfCreated[sender.tab.id]||Date.now();
      await chrome.storage.session.set({pdfViewSources,pdfCreated,[`pdf:${tab.id}`]:{text,capturedAt:Date.now()}});
      await focusTab(tab.id);return true;
    } catch(error) {await chrome.tabs.remove(tab.id).catch(()=>{});throw error;}
  });
}
/** Return the selected report snapshot, capturing only when it is safe to refetch. */
async function pdfText(source, run) {
  const api = guardedApi(chrome, run);
  const tab = await pdfTab(source, run), cacheKey = `pdf:${tab.id}`;
  let cached = (await api.storage.session.get(cacheKey))[cacheKey];
  if (!cached && captures.has(tab.id) && !captures.get(tab.id).run.signal.aborted) {
    await run.step(() => captures.get(tab.id).promise);
    cached = (await api.storage.session.get(cacheKey))[cacheKey];
  }
  if (!cached) {
    const {pdfViewSources = {}} = await api.storage.session.get('pdfViewSources');
    if (pdfViewSources[tab.id] || darkResultSource(tab.url, chrome.runtime.getURL('reader.html'))) throw new Error('The captured text for this PDF view is no longer available. Run its search again.');
    // If a newer report exists, re-fetching the fixed URL could silently select the wrong person.
    const {pdfCreated = {}} = await api.storage.session.get('pdfCreated');
    const newest = Math.max(...Object.values(pdfCreated), 0);
    if (!pdfCreated[tab.id] || pdfCreated[tab.id] < newest) throw new Error('The original text for this PDF is unavailable. Run its search again before using a PDF command.');
    await run.step(() => capturePdf(tab));
    cached = (await api.storage.session.get(cacheKey))[cacheKey];
  }
  return cached.text;
}
/** Keep at most twenty search attempts in this session; identity supports replay. */
async function addHistory(kind, value, run, details = {}) {
  const api = guardedApi(chrome, run);
  const {history = []} = await api.storage.session.get('history');
  await api.storage.session.set({history: [{...details, id: crypto.randomUUID(), kind, value, at: Date.now()}, ...history].slice(0, 20)});
}
/** Use extension session credentials or ask to enter/unlock them; ignore browser autofill. */
async function credentials(tabId, run) {
  const api = guardedApi(chrome, run);
  const {credentials} = await api.storage.session.get('credentials');
  if (credentials?.user && credentials?.password) return credentials;
  const {vault} = await api.storage.local.get('vault');
  return ask({type: 'credentials', hasVault: !!vault, tabId}, run);
}
/** Supply workflow callbacks without coupling automation.js to panel/storage internals. */
function context(run) {
  return {
    run,
    status: message => guardedApi(chrome, run).storage.session.set({status: message}).catch(() => {}),
    credentials: tabId => credentials(tabId, run)
  };
}
/** Never navigate to a search while a saved blacklist is still encrypted. */
async function unlockedBlacklist(run) {
  let current = await run.step(() => blacklistState());
  if (current.hasVault && !current.unlocked) {
    const unlocked = await ask({type: 'credentials', hasVault: true, unlockOnly: true}, run);
    if (!unlocked) throw new Error('Unlock the vault to check the blacklist before searching.');
    current = await run.step(() => blacklistState());
    if (!current.unlocked) throw new Error('The vault must be unlocked before searching.');
  }
  return current.entries;
}
/** Require an unlocked vault and reject every protected identifier immediately before portal submission. */
async function authorizeIdentifiers(identifiers, run, requireIdentifiers = false) {
  const entries = await unlockedBlacklist(run);
  if (entries.length && requireIdentifiers && !identifiers.length) throw new Error('Run SCUTTIES from the driver report so its identifiers can be checked against your blacklist.');
  for (const entry of identifiers) checkBlacklist(entries, entry.kind, entry.value);
}
/** Display the mandatory blocking warning independently of optional status-alert preferences. */
async function showBlacklistWarning(error, run) {
  await guardedApi(chrome, run).storage.session.set({status: error.message});
  await createPanel({type: 'record-alert', blacklist: true, tone: 'danger', autoCloseMs: 90000,
    subject: 'SEARCH BLOCKED: BLACKLIST', sections: [{title: error.message, lines: []}]}, {}, run);
}
/** Submit a portal search; commit successful history before focusing results.
 * DMV errors are recorded as failed attempts; queued errors consume their position.
 * PDF extraction and optional status analysis continue without blocking the next command. */
async function runSearch(kind, value, ctx, advance) {
  const api = guardedApi(chrome, ctx.run);
  const identifier = {kind: kind === 'address' ? 'license' : kind, value};
  ctx.beforeSubmit = () => authorizeIdentifiers([identifier], ctx.run);
  let captured, advanced = false;
  // Results and portal errors share this commit; either outcome may consume the position only once.
  const advanceQueue = async () => {
    if (advance && !advanced) { await advance(); advanced = true; }
  };
  // Publish attempt state first, then start capture independently of the next command.
  ctx.resultReady = async result => {
    // Commit queue progress before focusing results. An immediate Alt+N must
    // select the following person even while PDF.js is still extracting text.
    await advanceQueue();
    await addHistory(kind, value, ctx.run);
    await track(async () => {
      const {pdfCreated = {}, pdfSources = {}} = await api.storage.session.get(['pdfCreated', 'pdfSources']);
      pdfCreated[result.tabId] = Date.now(); pdfSources[result.tabId] = result.sourceUrl;
      await api.storage.session.set({pdfCreated, pdfSources});
      const key = `pdf:${result.tabId}`, cached = (await api.storage.session.get(key))[key];
      if (cached && (cached.capturedAt || 0) < result.startedAt) await api.storage.session.remove(key);
    });
    const tab = await api.tabs.get(result.tabId);
    ctx.run.check();
    captured = capturePdf(tab, result.portalId).then(() => ({ok: true})).catch(async e => {
      if (!isCancelled(e) && !ctx.run.signal.aborted) await ctx.status(`Results ready. PDF follow-ups unavailable: ${e.message}`);
      return {ok: false, error: e.message};
    });
  };
  let result;
  try { await ctx.beforeSubmit(); result = await search(kind, value, ctx); }
  catch (error) {
    // Record the rejected search with its outcome before displaying the error.
    // Queue advancement and history remain guarded against Stop or replacement.
    if (error instanceof BlacklistedSearchError && !ctx.run.signal.aborted) await advanceQueue();
    if (error instanceof PortalSearchError && !ctx.run.signal.aborted) {
      await advanceQueue();
      await addHistory(kind, value, ctx.run, {outcome: 'error', errorMessage: error.message});
    }
    throw error;
  }
  if (['plate', 'license', 'customer'].includes(kind)) {
    showRecordStatus(kind, value, result.tabId, captured, ctx).catch(error => {
      if (!isCancelled(error) && !ctx.run.signal.aborted) ctx.status(`Status alert unavailable: ${error.message}`);
    });
  }
}
/** Recheck settings after extraction so an alert disabled during parsing stays disabled. */
async function showRecordStatus(kind, value, tabId, captured, ctx) {
  const api = guardedApi(chrome, ctx.run);
  const enabled = settings => settings.alertsEnabled || settings.speechEnabled || settings.suspendedClipEnabled;
  if (!enabled(await api.storage.session.get(['alertsEnabled', 'speechEnabled', 'suspendedClipEnabled']))) return;
  const capture = await ctx.run.step(() => captured);
  try { await api.tabs.get(tabId); } catch (error) { ctx.run.check(); return; }
  const key = `pdf:${tabId}`, data = await api.storage.session.get(['alertsEnabled', 'speechEnabled', 'repeatSpeech', 'suspendedClipEnabled', 'voiceSource', 'voiceGender', 'voiceName', key]);
  if (!enabled(data)) return;
  const alert = capture?.ok && data[key]?.text
    ? recordStatus(kind, data[key].text)
    : unavailableAlert(kind === 'plate' ? 'plate' : 'license', capture?.error || 'The results PDF could not be read.');
  if (!alert) return;
  ctx.run.check();
  if (data.speechEnabled || data.suspendedClipEnabled) audioAlerts.play(alert, data, ctx.run.signal).catch(error => {
    if (!ctx.run.signal.aborted) ctx.status(`Audio alert unavailable: ${error.message}`);
  });
  if (data.alertsEnabled) await createPanel({...alert, subject: `${COMMANDS[kind].label}: ${value}`}, {}, ctx.run);
}
/** Create the queue from one report snapshot for both Collect and an empty Next.
 * index is the one-based position of the last completed attempt (zero before any),
 * which is also the zero-based index to try next. Technical failures do not advance it. */
async function collectQueue(source, run, skipResidenceFirst = false) {
  const origin = await pdfTab(source, run);
  const text = await pdfText(origin, run), values = ownerNumbers(text);
  // Collect retains the source customer but starts with the next residence entry.
  // An empty Next queue and other report types retain their first-entry behavior.
  const residence = isResidenceReport(text);
  const index = skipResidenceFirst && residence && values.length > 1 ? 1 : 0;
  const queue = {values, index, sourceTabId: origin.id};
  await guardedApi(chrome, run).storage.session.set({queue});
  return queue;
}
/** Route a validated command. Queue progress commits on results or a visible DMV search error. */
async function execute(command, value, source, options, run) {
  const ctx = context(run), api = guardedApi(chrome, run);
  try {
    run.check(); await api.storage.session.set({status: 'Starting search'});
    if (['plate', 'license', 'customer'].includes(command)) {
      const normalized = normalize(command, value); if (!normalized) return;
      await runSearch(command, normalized, ctx);
    } else if (command === 'owners') {
      const queue = await collectQueue(source, run, true);
      await runSearch('customer', queue.values[queue.index], ctx, () => api.storage.session.set({queue: {...queue, index: queue.index + 1}}));
    } else if (command === 'next') {
      let {queue} = await api.storage.session.get('queue');
      if (!queue?.values?.length) {
        queue = await collectQueue(source, run);
      }
      if (queue.index >= queue.values.length) {
        const restart = await ask({type: 'restart', message: 'All saved numbers have been run. Start again with the first saved number?'}, run);
        if (!restart) return; queue.index = 0;
      }
      const nextQueue = {...queue, index: queue.index + 1};
      await runSearch('customer', queue.values[queue.index], ctx, () => api.storage.session.set({queue: nextQueue}));
    } else if (command === 'previous') {
      const {queue} = await api.storage.session.get('queue');
      if (!queue?.values?.length) throw new Error('No saved customer queue. Collect customer numbers with Alt+J or Alt+N first.');
      // Moving back from position p targets array index p - 2; never wrap.
      const previousIndex = Math.min(queue.index, queue.values.length) - 2;
      if (!Number.isInteger(previousIndex) || previousIndex < 0) throw new Error('You are already at the first queued customer. There is no previous customer number.');
      await runSearch('customer', queue.values[previousIndex], ctx, () => api.storage.session.set({queue: {...queue, index: previousIndex + 1}}));
    } else if (command === 'barcode') {
      const text = await pdfText(source, run);
      let partyIndex = 0, barcode;
      while (!barcode) {
        run.check();
        try { barcode = reportBarcode(text, {partyIndex}); }
        catch (error) {
          if (!(error instanceof VehiclePartyError)) { barcode = reportBarcodeDraft(text, {partyIndex, error:error.message}); break; }
          const choice = await ask({type: 'barcode-owner-incomplete', hasNext: error.hasNext, message: `${error.message}\nYou can review and correct the parsed data, or generate this barcode with incomplete owner fields left blank.${error.hasNext ? " Another owner/customer/registrant is listed; you can choose Use next owner instead." : ''}`}, run);
          if (choice === 'edit') barcode = reportBarcodeDraft(text, {partyIndex, error:error.message});
          else if (choice === 'blank') {
            try { barcode = reportBarcode(text, {partyIndex, allowIncompleteParty:true}); }
            catch (parseError) { barcode = reportBarcodeDraft(text, {partyIndex, error:parseError.message, allowIncompleteParty:true}); }
          }
          else if (choice === 'next' && error.hasNext) partyIndex = error.nextPartyIndex;
          else { await api.storage.session.set({status: 'Barcode generation cancelled; owner information is incomplete'}); return; }
        }
      }
      await createPanel(barcode, {}, run);
      await api.storage.session.set({status: barcode.draftFields ? 'Review and correct parsed data before generating the barcode' : 'Import barcode ready; verify the scanned fields against the report'});
    } else if (command === 'address') {
      const dl = options.replay ? normalize('license', value) : driverLicense(await pdfText(source, run));
      if (!dl) throw new Error("A driver's license number was not detected. A driver's license number is required to run customers at the same residence.");
      await runSearch('address', dl, ctx);
    } else if (command === 'scutties') {
      const text = options.identity ? null : await pdfText(source, run);
      const identity = options.identity || driverIdentity(text);
      const identifiers = options.identifiers ? validateBlacklist(options.identifiers) : text ? driverIdentifiers(text) : [];
      ctx.beforeSubmit = () => authorizeIdentifiers(identifiers, run, true);
      await ctx.beforeSubmit();
      await scutties(identity, ctx);
      await addHistory('scutties', `${identity.lastName} · ${identity.dob}`, run, {identity, identifiers});
      await api.storage.session.set({status: 'SCUTTIES search submitted; review the results'});
    }
  } catch (e) {
    if (isCancelled(e) || run.signal.aborted) return;
    if (e instanceof BlacklistedSearchError) { await showBlacklistWarning(e, run); return; }
    if (/Invalid User ID Or Password|User ID is required|Password is required/i.test(e.message)) await api.storage.session.remove('credentials');
    await report(e, ctx.tabId, run);
  }
}
/** Common entry point for shortcuts, quick actions, and history replay. Search
 * and report actions replace the previous run, including one awaiting user input.
 * The launcher opens independently until its user selects an action. */
async function dispatch(command, options = {}) {
  if (!COMMANDS[command]) throw new Error('Unknown command.');
  if (resettingUserInfo) await resettingUserInfo;
  if (command === 'help') return openShortcutMenu();
  const run = beginRun();
  try {
    await run.step(() => boot); await run.step(() => run.cleanup);
    const source = await run.step(() => options.sourceId != null ? chrome.tabs.get(options.sourceId).catch(()=>null) : sourceTab());
    if (['plate', 'license', 'customer'].includes(command) && !options.replay) {
      openingPanel = openingPanel.catch(() => {}).then(async () => {
        run.check();
        await createPanel({type: 'input', command, sourceId: source?.id}, {}, run);
      });
      await openingPanel;
    } else await execute(command, options.value || '', source, options, run);
  } catch (error) { await report(error, undefined, run); }
}
// Browser shortcuts and popup buttons share dispatch so both obey cancellation and blacklist gates.
chrome.commands.onCommand.addListener(command => dispatch(command).catch(e => report(e)));
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'panel') return;
  port.onMessage.addListener(() => {}); // Panel heartbeats keep pending interactive flows alive.
});
// Window closure completes pending prompts as cancellation and releases their stored panel data.
chrome.windows.onRemoved.addListener(async windowId => {
  for (const [id, entry] of panels) if (entry.windowId === windowId) {
    if (entry.data.type === 'record-alert') audioAlerts.stop();
    if (entry.data.type === 'shortcut-menu') entry.run?.cancel();
    clearTimeout(entry.timer); panels.delete(id); await chrome.storage.session.remove(`panel:${id}`);
    entry.resolve?.(null);
  }
});
// Tab metadata and cache invalidation must be serialized: Chrome may report a URL
// after creation, or reuse a results tab for a different report at the same URL.
chrome.tabs.onCreated.addListener(async tab => {
  await boot;
  // Creation timestamp is recorded before the attachment URL is populated.
  await track(async () => {
    const {tabCreated = {}} = await chrome.storage.session.get('tabCreated');
    tabCreated[tab.id] = Date.now(); await chrome.storage.session.set({tabCreated});
  });
});
chrome.tabs.onUpdated.addListener(async (id, change, tab) => {
  const sourceUrl = attachmentUrl(tab.pendingUrl) || attachmentUrl(tab.url);
  if (!sourceUrl) return;
  await boot;
  await track(async () => {
    const {pdfCreated = {}, tabCreated = {}, pdfSources = {}} = await chrome.storage.session.get(['pdfCreated', 'tabCreated', 'pdfSources']);
    if (!pdfCreated[id] && tabCreated[id]) { pdfCreated[id] = tabCreated[id]; await chrome.storage.session.set({pdfCreated}); }
    pdfSources[id] = sourceUrl; await chrome.storage.session.set({pdfSources});
    if (change.status === 'loading') {
      const capture = captures.get(id), cached = (await chrome.storage.session.get(`pdf:${id}`))[`pdf:${id}`];
      // A reader can report loading after history.replaceState. Only committed
      // document identity may invalidate/cancel a same-tab reader snapshot.
      const darkDocument = capture?.sameTab || cached?.documentId || darkResultSource(tab.pendingUrl, chrome.runtime.getURL('reader.html')) || darkResultSource(tab.url, chrome.runtime.getURL('reader.html'));
      if (!darkDocument) await chrome.storage.session.remove(`pdf:${id}`);
    }
  });
  const {pdfCreated = {}} = await chrome.storage.session.get('pdfCreated');
  if (change.status === 'complete' && pdfCreated[id] && !darkResultSource(tab.url, chrome.runtime.getURL('reader.html'))) await capturePdf(tab).catch(() => {});
});
// tabs.onUpdated has no document ID: a loading notification can belong to the
// current reader, not a replacement. Invalidate direct snapshots only when a
// different top-level document actually commits. Check the current frame too,
// because a delayed event from an older navigation must not cancel a newer reader.
chrome.webNavigation.onCommitted.addListener(async details => {
  if (details.frameId !== 0) return;
  await boot;
  await track(async () => {
    const id = details.tabId, key = `pdf:${id}`, capture = captures.get(id);
    const cached = (await chrome.storage.session.get(key))[key];
    const direct = darkResultSource(details.url, chrome.runtime.getURL('reader.html'));
    if (!capture?.sameTab && !cached?.documentId && !direct) return;
    if (capture?.documentId === details.documentId || cached?.documentId === details.documentId) return;
    const frame = await chrome.webNavigation.getFrame({tabId:id,frameId:0}).catch(() => null);
    if (!frame || frame.documentId !== details.documentId) return;
    if (capture?.sameTab && capture.documentId) capture.run.cancel();
    await chrome.storage.session.remove(key);
  });
});
// Remove closed-tab snapshots and ownership metadata after cancelling any in-flight capture.
chrome.tabs.onRemoved.addListener(async id => {
  captures.get(id)?.run.cancel();
  await track(async () => {
    const {pdfCreated = {}, tabCreated = {}, pdfSources = {}, pdfViewSources = {}} = await chrome.storage.session.get(['pdfCreated', 'tabCreated', 'pdfSources', 'pdfViewSources']);
    delete pdfViewSources[id];
    delete pdfCreated[id]; delete tabCreated[id]; delete pdfSources[id];
    await chrome.storage.session.set({pdfCreated, tabCreated, pdfSources, pdfViewSources});
    await chrome.storage.session.remove(`pdf:${id}`);
  });
});
// Restore saved preferences without replaying any previous alert or query.
chrome.runtime.onStartup.addListener(async () => { audioAlerts.stop(); await boot; await restoreAlertPreferences(); });
/** Reuse the guide window when possible; installation is the only automatic trigger. */
async function openShortcutSetup() {
  const url = chrome.runtime.getURL('shortcut-setup.html');
  const existing = (await chrome.tabs.query({url})).find(tab => tab.url === url);
  if (existing) { await focusTab(existing.id); return; }
  await chrome.windows.create({url, type: 'popup', width: 900, height: 820, focused: true});
}
chrome.runtime.onInstalled.addListener(async details => {
  await boot;
  // Discard retired companion preferences while preserving browser assignments,
  // credentials, history, and unrelated session data. No host is launched.
  await chrome.storage.local.remove('bindings');
  await chrome.storage.session.remove(['nativeStatus', 'nativeErrors']);
  await refreshDmvThemeTabs();
  if (details?.reason === 'install') await openShortcutSetup();
});
// Only extension-owned views may call this router. Keep the response channel open
// for async work and use one {ok, value/error} envelope for every request.
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.target === 'audio-player' || message.target === 'pdf-reader') return false;
  if(message.type==='dmv-theme-init'&&sender.id===chrome.runtime.id&&sender.tab?.id!=null&&Number.isInteger(sender.frameId)&&isDmvThemePage(sender.url)) {
    (async()=>{await boot;return initDmvTheme(sender);})().then(value=>reply({ok:true,value}),error=>reply({ok:false,error:error.message}));return true;
  }
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
  (async () => {
    await boot;
    switch (message.type) {
      // Reader requests are bound to the extraction job and its tab/document identity.
      case 'reader-start': {
        const reader = readers.get(message.id);
        if (!reader || reader.tabId != null && sender.tab?.id !== reader.tabId || reader.documentId && reader.documentId !== sender.documentId) throw new Error('Unknown PDF reader.');
        reader.tabId = sender.tab.id;
        return {base64: reader.base64, url: reader.url};
      }
      case 'reader-direct-start': return attachPdfViewer(sender);
      case 'pdf-native-print': return openNativePrint(sender,message.url,message.text);
      case 'reader-result': {
        const reader = readers.get(message.id);
        if (!reader || sender.tab?.id !== reader.tabId || reader.documentId && reader.documentId !== sender.documentId) throw new Error('Unknown PDF reader.');
        reader.viewReady = message.viewReady === true; reader.viewerError = message.viewerError;
        if (message.error) reader.reject(new Error(message.error)); else reader.resolve(message.text);
        return true;
      }
      // Panel replies are normalized and authorized again before they can continue a workflow.
      case 'panel-data': {
        return (await chrome.storage.session.get(`panel:${message.id}`))[`panel:${message.id}`];
      }
      case 'panel-submit': {
        const entry = panels.get(message.id);
        if (!entry) throw new Error('This panel has expired.');
        entry.run?.check();
        const data = entry.data;
        let result = message.value;
        if (data.type === 'input') result = normalize(data.command, message.value);
        if (data.type === 'credentials') {
          if (data.encryptedRequired && (message.unlock || !message.save)) throw new Error('Save the encrypted vault to set up the blacklist.');
          if (data.unlockOnly && !message.unlock) await unlockCredentials(message.blacklistPassphrase || '');
          if (message.unlock) result = await unlockCredentials(message.passphrase || '');
          else {
            result = {user: String(message.user || '').trim(), password: String(message.password || '')};
            if (!result.user || !result.password) throw new Error('User ID and password are required.');
            if ((await blacklistState()).hasVault) await replaceCredentials(result);
            else if (message.save) await saveCredentials(result, message.passphrase || '');
            else await chrome.storage.session.set({credentials: result});
            // Different credentials must not reuse the previous login-time hint.
            await chrome.storage.session.set({lastQuery: 0});
          }
        }
        entry.run?.check();
        clearTimeout(entry.timer); panels.delete(message.id); await chrome.storage.session.remove(`panel:${message.id}`);
        entry.resolve?.(result);
        if (data.type === 'input' && result) {
          // Let the input panel finish closing before beginning navigation.
          setTimeout(async () => {
            if (entry.run.signal.aborted) return;
            const source = data.sourceId ? await chrome.tabs.get(data.sourceId).catch(() => null) : null;
            await execute(data.command, result, source, {}, entry.run);
          }, 180);
        }
        return true;
      }
      // Start a command or resolve an existing session history entry before replay; arbitrary saved input is refused.
      case 'run': dispatch(message.command).catch(e => report(e)); return true;
      case 'shortcut-menu-run': {
        const entry = panels.get(message.id);
        if (!entry || entry.data.type !== 'shortcut-menu') throw new Error('This shortcut menu has expired. Open it again.');
        if (message.command === 'help' || !Object.hasOwn(COMMANDS,message.command)) throw new Error('Unknown shortcut menu action.');
        entry.run.check();
        dispatch(message.command,{sourceId:entry.data.sourceId}).catch(error=>report(error));
        return true;
      }
      case 'rerun': {
        const {history = []} = await chrome.storage.session.get('history');
        const requested = message.search;
        const entry = requested && history.find(item => requested.id
          ? item.id === requested.id
          : item.kind === requested.kind && item.value === requested.value && item.at === requested.at);
        if (!entry) throw new Error('This search is no longer in recent history. Reopen the popup and try again.');
        const query = historySearch(entry);
        dispatch(query.kind, {...query, ...(entry.identifiers ? {identifiers: validateBlacklist(entry.identifiers)} : {}), replay: true}).catch(error => report(error));
        return true;
      }
      // These snapshots are restricted to extension-owned pages by the router above.
      case 'state': return {blacklist: await blacklistState(), ...await chrome.storage.local.get(['vault','pdfDarkMode','dmvDarkMode','shortcutMenuNoTimeout','shortcutMenuAlwaysOnTop']), ...await chrome.storage.session.get(['history', 'queue', 'status', 'alertsEnabled', 'speechEnabled', 'repeatSpeech', 'suspendedClipEnabled', 'voiceSource', 'voiceGender', 'voiceName']), voices: await availableVoices().catch(() => []), commands: await chrome.commands.getAll(), extensionId: chrome.runtime.id};
      // Appearance updates persist independently of credentials and query state.
      case 'dmv-display-settings': {
        await chrome.storage.local.set({dmvDarkMode:message.enabled===true});await configureDmvTheme();await refreshDmvThemeTabs();return message.enabled===true;
      }
      case 'shortcut-menu-settings': {
        // Serialize preference edits so enabling pinning always retains no-timeout mode.
        const task = savingShortcutMenuSettings.then(async()=>{
          const saved = await chrome.storage.local.get(['shortcutMenuAlwaysOnTop','shortcutMenuNoTimeout']);
          const alwaysOnTop = Object.hasOwn(message,'alwaysOnTop') ? message.alwaysOnTop === true : saved.shortcutMenuAlwaysOnTop === true;
          const noTimeout = alwaysOnTop || (Object.hasOwn(message,'noTimeout') ? message.noTimeout === true : saved.shortcutMenuNoTimeout === true);
          await chrome.storage.local.set({shortcutMenuAlwaysOnTop:alwaysOnTop,shortcutMenuNoTimeout:noTimeout});
          return {alwaysOnTop,noTimeout};
        });
        savingShortcutMenuSettings = task.catch(()=>{});
        return task;
      }
      case 'pdf-display-settings': await setPdfRouting(message.enabled === true); await chrome.storage.local.set({pdfDarkMode: message.enabled === true}); return message.enabled === true;
      // Reset cancels workflows and drains metadata writes before deleting private session state.
      case 'clear-saved-user-info': {
        if (message.confirmed !== true) throw new Error('Confirm deletion of saved user information and the vault.');
        const reset = (async () => { const run = beginRun(); await run.cleanup; await tracking; const {pdfViewSources = {}} = await chrome.storage.session.get('pdfViewSources'); for (const id of Object.keys(pdfViewSources)) await chrome.tabs.remove(+id).catch(() => {}); await tracking; await clearSavedUserInfo(true); await restoreAlertPreferences(); })();
        resettingUserInfo = reset;
        try { await reset; return true; } finally { if (resettingUserInfo === reset) resettingUserInfo = null; }
      }
      // Vault mutations are serialized inside vault.js and require an unlocked matching session key.
      case 'blacklist-setup': {
        if ((await blacklistState()).hasVault) throw new Error('A vault already exists. Unlock it to manage your blacklist.');
        const run = beginRun(); await run.step(() => run.cleanup);
        await ask({type: 'credentials', hasVault: false, encryptedRequired: true, setupOnly: true}, run);
        return blacklistState();
      }
      case 'blacklist-unlock': await unlockCredentials(message.passphrase || ''); return blacklistState();
      case 'blacklist-add': return addBlacklistEntry(message.kind, message.value);
      case 'blacklist-remove': return removeBlacklistEntry(message.kind, message.value, message.confirmed);
      case 'stop-audio': audioAlerts.stop(); return true;
      case 'stop': {
        const run = beginRun();
        try { await run.step(() => run.cleanup); await guardedApi(chrome, run).storage.session.set({status: 'Stopped'}); }
        catch (error) { if (!isCancelled(error)) throw error; }
        return true;
      }
      case 'shortcut-setup': await openShortcutSetup(); return true;
      // Validate user choices at the message boundary before updating their persistent whitelist.
      case 'audio-settings': {
        const settings = {};
        for (const key of ['speechEnabled', 'repeatSpeech', 'suspendedClipEnabled']) if (key in message) settings[key] = message[key] === true;
        if ('voiceSource' in message) { if (!['recordings', 'microsoft'].includes(message.voiceSource)) throw new Error('Choose bundled recordings or Microsoft speech.'); settings.voiceSource = message.voiceSource; }
        if ('voiceGender' in message) { if (!['male', 'female'].includes(message.voiceGender)) throw new Error('Choose male or female.'); settings.voiceGender = message.voiceGender; }
        if ('voiceName' in message) settings.voiceName = String(message.voiceName || '');
        audioAlerts.stop();
        await saveAlertPreferences(settings); return true;
      }
      case 'alerts': {
        const enabled = message.enabled === true;
        await saveAlertPreferences({alertsEnabled: enabled});
        if (!enabled) for (const [id, entry] of panels) {
          if (entry.data.type !== 'record-alert' || entry.data.blacklist) continue;
          entry.cancelled = true; panels.delete(id); clearTimeout(entry.timer);
          await chrome.storage.session.remove(`panel:${id}`);
          if (entry.windowId != null) await chrome.windows.remove(entry.windowId).catch(() => {});
        }
        return enabled;
      }
      case 'clear-history': await chrome.storage.session.remove('history'); return true;
      case 'clear-queue': await chrome.storage.session.remove('queue'); return true;
      case 'forget-credentials': await forgetCredentials(); return true;
      default: throw new Error('Unknown extension request.');
    }
  })().then(value => reply({ok: true, value}), error => reply({ok: false, error: error.message}));
  return true;
});
