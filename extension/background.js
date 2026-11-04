/**
 * Service-worker coordinator. Browser commands enter dispatch(), which creates one
 * cancellable SearchRun. This module owns panels, PDF snapshots, history, queue state,
 * credentials requests, and message authorization; DOM work belongs to page.js.
 * See DEVELOPMENT.md for the lifecycle and storage/message contracts.
 */
import {COMMANDS, ROOT, PDF_URL, attachmentUrl, isPdf, isPortal, normalize, ownerNumbers, driverLicense, driverIdentity, historySearch} from './core.js';
import {search, scutties, evaluate, focusTab} from './automation.js';
import {saveCredentials, unlockCredentials} from './vault.js';
import {SearchRun, guardedApi, isCancelled} from './run.js';
import {recordStatus, unavailableAlert} from './status-alerts.js';
import {AudioAlerts, availableVoices} from './audio-alerts.js';
import {reportBarcode} from './barcode-data.js';
const audioAlerts = new AudioAlerts();

// In-memory Maps hold live callbacks. Session storage holds view/report data, not
// resumable jobs. openingPanel and tracking serialize two independent mutation streams.
let activeRun = null, openingPanel = Promise.resolve(), tracking = Promise.resolve();
const panels = new Map(), readers = new Map(), captures = new Map();
const boot = Promise.all([
  chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'}),
  chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'}),
  // Delete legacy disk history without importing it; preserve current session history.
  // Worker startup also covers unpacked-extension reloads.
  chrome.storage.local.remove('history'),
  // Retire the removed shortcut-pause preference on update or worker startup.
  chrome.storage.session.remove('shortcutsPaused')
]);
/** Replace the active command and cancel its readers, audio, and panels. Callers await
 * run.cleanup before opening new UI; late-created windows also check this run. */
function beginRun() {
  audioAlerts.stop();
  activeRun?.cancel();
  for (const capture of captures.values()) capture.run.cancel();
  const run = new SearchRun(); activeRun = run;
  const cleanup = [];
  for (const [id, entry] of panels) {
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
  if (data.type === 'record-alert' && !(await chrome.storage.session.get('alertsEnabled')).alertsEnabled) entry.cancelled = true;
  if (entry.cancelled || run?.signal.aborted) {
    panels.delete(id); await chrome.storage.session.remove(`panel:${id}`); run?.check(); return null;
  }
  let win;
  try { run?.check(); win = await chrome.windows.create({url: chrome.runtime.getURL(`${data.type === 'barcode' ? 'barcode' : 'panel'}.html?id=${id}`), type: 'popup', width: data.type === 'barcode' ? 1020 : data.type === 'record-alert' ? 580 : 460, height: data.type === 'barcode' ? 800 : data.type === 'credentials' ? 720 : data.type === 'record-alert' ? 620 : 430, focused: true}); }
  catch (e) { panels.delete(id); await chrome.storage.session.remove(`panel:${id}`); throw e; }
  entry.windowId = win.id;
  if (run?.signal.aborted || entry.cancelled) {
    panels.delete(id); await chrome.storage.session.remove(`panel:${id}`);
    await chrome.windows.remove(win.id).catch(() => {}); run?.check(); return null;
  }
  return {id, entry};
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
async function sourceTab() {
  const active = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  return active[0];
}
/** Prefer the focused report; otherwise select the newest tracked results tab. */
async function pdfTab(source, run) {
  run?.check();
  if (source && (isPdf(source.url) || isPdf(source.pendingUrl))) return source;
  const api = guardedApi(chrome, run);
  const tabs = (await api.tabs.query({})).filter(t => isPdf(t.url) || isPdf(t.pendingUrl));
  if (!tabs.length) throw new Error('No open SCDMV PDF results tab was found.');
  const {pdfCreated = {}} = await api.storage.session.get('pdfCreated');
  // Chromium tab IDs are used only as a fallback for tabs predating installation.
  return tabs.sort((a,b) => (pdfCreated[b.id] || b.id) - (pdfCreated[a.id] || a.id))[0];
}
/** Capture one report snapshot per tab. The fixed attachment URL is session-dependent;
 * never refetch an untracked historical report and assume it is the same person. */
async function capturePdf(tab, portalId) {
  const existing = captures.get(tab.id);
  if (existing && !existing.run.signal.aborted) return existing.promise;
  const run = new SearchRun(), api = guardedApi(chrome, run);
  const task = Promise.resolve().then(async () => {
    const cacheKey = `pdf:${tab.id}`;
    if ((await api.storage.session.get(cacheKey))[cacheKey]?.text) return;
    const {pdfCreated = {}, pdfSources = {}} = await api.storage.session.get(['pdfCreated', 'pdfSources']);
    if (!pdfCreated[tab.id]) {
      // A fixed session URL cannot safely be fetched for historical tabs.
      throw new Error('This PDF predates extension tracking. Run its search again so the extension can capture the correct report.');
    }
    const portal = portalId ? await api.tabs.get(portalId).catch(() => null) : null;
    const candidates = portal ? [portal] : (await api.tabs.query({url: `${ROOT}/*`})).filter(t => isPortal(t.url));
    const parent = candidates.find(t => t.id === tab.openerTabId) || candidates[0];
    let base64 = null;
    const sourceUrl = attachmentUrl(tab.pendingUrl) || attachmentUrl(tab.url) || pdfSources[tab.id] || PDF_URL;
    if (parent) {
      try { base64 = await evaluate(parent.id, 'fetchPdf', {url: sourceUrl}, {run}); } catch { run.check(); /* Authenticated reader fetch is the fallback. */ }
    }
    const id = crypto.randomUUID();
    const promise = new Promise((resolve, reject) => {
      readers.set(id, {resolve, reject, base64, url: sourceUrl, pdfId: tab.id});
    });
    let readerTab, timer;
    try {
      run.check();
      readerTab = await chrome.tabs.create({url: chrome.runtime.getURL(`reader.html?id=${id}`), active: false});
      const reader = readers.get(id); reader.tabId = readerTab.id;
      timer = setTimeout(() => reader.reject(new Error('PDF text extraction timed out.')), 45000);
      const text = await run.step(() => promise);
      if (!text.trim()) throw new Error('This PDF has no extractable text. Scanned PDFs require OCR; enter a number manually.');
      await api.storage.session.set({[cacheKey]: {text, capturedAt: Date.now()}});
    } finally {
      clearTimeout(timer); readers.delete(id);
      if (readerTab) await chrome.tabs.remove(readerTab.id).catch(() => {});
    }
  });
  const capture = {run, promise: task}; captures.set(tab.id, capture);
  try { await task; } finally { if (captures.get(tab.id) === capture) captures.delete(tab.id); }
}
/** Return the selected report snapshot, capturing only when it is safe to refetch. */
async function pdfText(source, run) {
  const api = guardedApi(chrome, run);
  const tab = await pdfTab(source, run), cacheKey = `pdf:${tab.id}`;
  let cached = (await api.storage.session.get(cacheKey))[cacheKey];
  if (!cached) {
    // If a newer report exists, re-fetching the fixed URL could silently select the wrong person.
    const {pdfCreated = {}} = await api.storage.session.get('pdfCreated');
    const newest = Math.max(...Object.values(pdfCreated), 0);
    if (!pdfCreated[tab.id] || pdfCreated[tab.id] < newest) throw new Error('The original text for this PDF is unavailable. Run its search again before using a PDF command.');
    await run.step(() => capturePdf(tab));
    cached = (await api.storage.session.get(cacheKey))[cacheKey];
  }
  return cached.text;
}
/** Keep at most twenty successful searches in this session; identity supports replay. */
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
    credentials: tabId => credentials(tabId, run),
    permission: async origin => {
      if (!await ask({type: 'permission', origin, message: `Allow access to ${origin} so the extension can enter the SCUTTIES search?`}, run)) throw new Error('SCUTTIES site access cancelled.');
    }
  };
}
/** Submit a portal search and commit queue/history at result discovery, before focus.
 * PDF extraction and optional status analysis continue without blocking the next command. */
async function runSearch(kind, value, ctx, advance) {
  const api = guardedApi(chrome, ctx.run);
  let captured;
  ctx.resultReady = async result => {
    // Commit queue progress before focusing results. An immediate Alt+N must
    // select the following person even while PDF.js is still extracting text.
    if (advance) await advance();
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
  const result = await search(kind, value, ctx);
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
 * index is the one-based position of the last displayed result (zero before any),
 * which is also the zero-based index to try next. Failed searches do not advance it. */
async function collectQueue(source, run, skipResidenceFirst = false) {
  const origin = await pdfTab(source, run);
  const text = await pdfText(origin, run), values = ownerNumbers(text);
  // Collect retains the source customer but starts with the next residence entry.
  // An empty Next queue and other report types retain their first-entry behavior.
  const residence = /^\s*Customers\s+at\s+Same\s+Residence\b/i.test(text);
  const index = skipResidenceFirst && residence && values.length > 1 ? 1 : 0;
  const queue = {values, index, sourceTabId: origin.id};
  await guardedApi(chrome, run).storage.session.set({queue});
  return queue;
}
/** Route a validated command. Queue progress commits only when its results are found. */
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
      await createPanel(reportBarcode(text), {}, run);
      await api.storage.session.set({status: 'Import barcode ready; verify the scanned fields against the report'});
    } else if (command === 'address') {
      const dl = options.replay ? normalize('license', value) : driverLicense(await pdfText(source, run));
      if (!dl) throw new Error("A driver's license number was not detected. A driver's license number is required to run customers at the same residence.");
      await runSearch('address', dl, ctx);
    } else if (command === 'scutties') {
      const identity = options.identity || driverIdentity(await pdfText(source, run));
      await scutties(identity, ctx);
      await addHistory('scutties', `${identity.lastName} · ${identity.dob}`, run, {identity});
      await api.storage.session.set({status: 'SCUTTIES search submitted; review the results'});
    }
  } catch (e) {
    if (isCancelled(e) || run.signal.aborted) return;
    if (/Invalid User ID Or Password|User ID is required|Password is required/i.test(e.message)) await api.storage.session.remove('credentials');
    await report(e, ctx.tabId, run);
  }
}
/** Common entry point for shortcuts, quick actions, and history replay. A new command
 * always replaces the previous run, including one waiting for user input. */
async function dispatch(command, options = {}) {
  if (!COMMANDS[command]) throw new Error('Unknown command.');
  const run = beginRun();
  try {
    await run.step(() => boot); await run.step(() => run.cleanup);
    const source = await run.step(() => sourceTab());
    if (['plate', 'license', 'customer'].includes(command) && !options.replay) {
      openingPanel = openingPanel.catch(() => {}).then(async () => {
        run.check();
        await createPanel({type: 'input', command, sourceId: source?.id}, {}, run);
      });
      await openingPanel;
    } else await execute(command, options.value || '', source, options, run);
  } catch (error) { await report(error, undefined, run); }
}
chrome.commands.onCommand.addListener(command => dispatch(command).catch(e => report(e)));
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'panel') return;
  port.onMessage.addListener(() => {}); // Panel heartbeats keep pending interactive flows alive.
});
chrome.windows.onRemoved.addListener(async windowId => {
  for (const [id, entry] of panels) if (entry.windowId === windowId) {
    if (entry.data.type === 'record-alert') audioAlerts.stop();
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
    if (change.status === 'loading') await chrome.storage.session.remove(`pdf:${id}`);
  });
  const {pdfCreated = {}} = await chrome.storage.session.get('pdfCreated');
  if (change.status === 'complete' && pdfCreated[id]) await capturePdf(tab).catch(() => {});
});
chrome.tabs.onRemoved.addListener(async id => {
  await track(async () => {
    const {pdfCreated = {}, tabCreated = {}, pdfSources = {}} = await chrome.storage.session.get(['pdfCreated', 'tabCreated', 'pdfSources']);
    delete pdfCreated[id]; delete tabCreated[id]; delete pdfSources[id];
    await chrome.storage.session.set({pdfCreated, tabCreated, pdfSources});
    await chrome.storage.session.remove(`pdf:${id}`);
  });
});
// Alert consent is session-scoped; do not turn it on automatically after restart.
chrome.runtime.onStartup.addListener(() => { audioAlerts.stop(); chrome.storage.session.set({alertsEnabled: false, speechEnabled: false, repeatSpeech: false, suspendedClipEnabled: false}); });
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
  if (details?.reason === 'install') await openShortcutSetup();
});
// Only extension-owned views may call this router. Keep the response channel open
// for async work and use one {ok, value/error} envelope for every request.
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.target === 'audio-player') return false;
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
  (async () => {
    await boot;
    switch (message.type) {
      case 'reader-start': {
        const reader = readers.get(message.id);
        if (!reader || reader.tabId != null && sender.tab?.id !== reader.tabId) throw new Error('Unknown PDF reader.');
        reader.tabId = sender.tab.id;
        return {base64: reader.base64, url: reader.url};
      }
      case 'reader-result': {
        const reader = readers.get(message.id);
        if (!reader || sender.tab?.id !== reader.tabId) throw new Error('Unknown PDF reader.');
        if (message.error) reader.reject(new Error(message.error)); else reader.resolve(message.text);
        return true;
      }
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
          if (message.unlock) result = await unlockCredentials(message.passphrase || '');
          else {
            result = {user: String(message.user || '').trim(), password: String(message.password || '')};
            if (!result.user || !result.password) throw new Error('User ID and password are required.');
            if (message.save) await saveCredentials(result, message.passphrase || '');
            else await chrome.storage.session.set({credentials: result});
          }
        }
        if (data.type === 'permission') {
          if (!await chrome.permissions.contains({origins: [data.origin]})) throw new Error('Website access has not been granted.');
          result = true;
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
      case 'run': dispatch(message.command).catch(e => report(e)); return true;
      case 'rerun': {
        const {history = []} = await chrome.storage.session.get('history');
        const requested = message.search;
        const entry = requested && history.find(item => requested.id
          ? item.id === requested.id
          : item.kind === requested.kind && item.value === requested.value && item.at === requested.at);
        if (!entry) throw new Error('This search is no longer in recent history. Reopen the popup and try again.');
        const query = historySearch(entry);
        dispatch(query.kind, {...query, replay: true}).catch(error => report(error));
        return true;
      }
      case 'state': return {...await chrome.storage.local.get(['vault']), ...await chrome.storage.session.get(['history', 'queue', 'status', 'alertsEnabled', 'speechEnabled', 'repeatSpeech', 'suspendedClipEnabled', 'voiceSource', 'voiceGender', 'voiceName']), voices: await availableVoices().catch(() => []), commands: await chrome.commands.getAll(), extensionId: chrome.runtime.id};
      case 'stop-audio': audioAlerts.stop(); return true;
      case 'stop': {
        const run = beginRun();
        try { await run.step(() => run.cleanup); await guardedApi(chrome, run).storage.session.set({status: 'Stopped'}); }
        catch (error) { if (!isCancelled(error)) throw error; }
        return true;
      }
      case 'shortcut-setup': await openShortcutSetup(); return true;
      case 'audio-settings': {
        const settings = {};
        for (const key of ['speechEnabled', 'repeatSpeech', 'suspendedClipEnabled']) if (key in message) settings[key] = message[key] === true;
        if ('voiceSource' in message) { if (!['recordings', 'microsoft'].includes(message.voiceSource)) throw new Error('Choose bundled recordings or Microsoft speech.'); settings.voiceSource = message.voiceSource; }
        if ('voiceGender' in message) { if (!['male', 'female'].includes(message.voiceGender)) throw new Error('Choose male or female.'); settings.voiceGender = message.voiceGender; }
        if ('voiceName' in message) settings.voiceName = String(message.voiceName || '');
        audioAlerts.stop();
        await chrome.storage.session.set(settings); return true;
      }
      case 'alerts': {
        const enabled = message.enabled === true;
        await chrome.storage.session.set({alertsEnabled: enabled});
        if (!enabled) for (const [id, entry] of panels) {
          if (entry.data.type !== 'record-alert') continue;
          entry.cancelled = true; panels.delete(id); clearTimeout(entry.timer);
          await chrome.storage.session.remove(`panel:${id}`);
          if (entry.windowId != null) await chrome.windows.remove(entry.windowId).catch(() => {});
        }
        return enabled;
      }
      case 'clear-history': await chrome.storage.session.remove('history'); return true;
      case 'clear-queue': await chrome.storage.session.remove('queue'); return true;
      case 'forget-credentials': await chrome.storage.local.remove('vault'); await chrome.storage.session.remove('credentials'); return true;
      default: throw new Error('Unknown extension request.');
    }
  })().then(value => reply({ok: true, value}), error => reply({ok: false, error: error.message}));
  return true;
});
