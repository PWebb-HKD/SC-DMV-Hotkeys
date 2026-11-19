/** Unfocused query windows reuse the guarded workflow and blacklist callbacks.
 * Navigation leaves existing windows alone; completed same-address results are revealed. */
import {attachmentUrl, isPortal, samePage} from './core.js';
import {search, evaluate, focusTab, delay} from './automation.js';
import {guardedApi} from './run.js';
import {darkResultSource} from './pdf-routing.js';
import {LIVE,environmentOf} from './environment.js';

/** Reuse only tracked query viewers in this destination window. A user-navigated
 * tab, native print tab or different window must never be replaced or moved. */
export function reusableBackgroundResult(tabs,windowId,readerUrl,{pdfCreated={},pdfSources={}}={},sourceId,environment=LIVE) {
  return tabs.filter(tab=>{
    if(tab.windowId!==windowId||tab.pendingUrl&&tab.pendingUrl!==tab.url)return false;
    const source=darkResultSource(tab.url,readerUrl,environment);
    if(!source||source!==pdfSources[tab.id]||!Number.isFinite(pdfCreated[tab.id]))return false;
    const params=new URL(tab.url).searchParams;
    return params.get('query')==='1'&&/^[a-f0-9-]{36}$/i.test(params.get('id')||'');
  }).sort((a,b)=>pdfCreated[b.id]-pdfCreated[a.id]||Number(b.id===sourceId)-Number(a.id===sourceId)||b.id-a.id)[0];
}

export function backgroundMethod(kind, settings) {
  return settings.alertsEnabled === true && settings.backgroundStatusSearch === true && ['plate','license','customer','address'].includes(kind)
    ? 'window' : null;
}

/** Arm before Download and capture its attachment handoff inside the owned page. */
export async function watchBackgroundReport(tabId, ctx) {
  let startedAt;
  return {
    async arm() {startedAt = Date.now();await evaluate(tabId,'startBackgroundReport',{persistent:true},ctx);},
    async find() {
      const tab=await guardedApi(ctx.browserApi||chrome,ctx.run).tabs.get(tabId);
      if(tab.status!=='complete')return null;
      const result = await evaluate(tabId,'backgroundReport',{},ctx);
      if(result.error)throw new Error(result.error);
      if(!result.url)return null;
      const sourceUrl = attachmentUrl(result.url,0,environmentOf(ctx));
      if(!sourceUrl)throw new Error('The background report destination was not a DMV PDF.');
      return {tab:{id:tabId}, sourceUrl, reused:false, startedAt};
    },
    dispose() { evaluate(tabId,'stopBackgroundReport',{},ctx).catch(()=>{}); }
  };
}

/** Pick an existing normal browser window, including one currently minimized. */
export async function resultWindow(api, sourceId) {
  const source = sourceId == null ? null : await api.tabs.get(sourceId).catch(()=>null);
  if(source) {
    const window = await api.windows.get(source.windowId).catch(()=>null);
    if(window?.type === 'normal')return window.id;
  }
  const windows = await api.windows.getAll({windowTypes:['normal']});
  const window = windows.find(win=>win.focused) || windows[0];
  if(!window)throw new Error('Keep a normal browser window open for the background report.');
  return window.id;
}

/** Clean only the owned portal tab; retain moved tabs and unrelated user pages. */
async function closeHelper(api, windowId, tabId, ctx) {
  const environment=environmentOf(ctx);
  const tab=await api.tabs.get(tabId).catch(()=>null);
  const url=tab?.pendingUrl||tab?.url;
  if(isPortal(url,environment))await evaluate(tabId,'stopBackgroundReport',{},{browserApi:api,environment:environmentOf(ctx),demoOperation:ctx?.demoOperation}).catch(()=>{});
  if(tab?.windowId===windowId&&(url==='about:blank'||isPortal(url,environment)))await api.tabs.remove(tabId).catch(()=>{});
}

/** Serialize the new blank document and the initial login load. tabs.update
 * returns before its URL commits; shared login must not start a competing load. */
async function openHelperLogin(api, windowId, tabId, ctx) {
  const environment=environmentOf(ctx),LOGIN=environment.login;
  const waitForPage = async login => {
    const deadline=Date.now()+(login?60000:10000);
    while(Date.now()<deadline) {
      const tab=await api.tabs.get(tabId),target=tab.pendingUrl||tab.url;
      if(tab.windowId!==windowId||target&&target!=='about:blank'&&(!login||!isPortal(target,environment)))throw new Error('The hidden query tab was moved or navigated elsewhere. Search stopped.');
      if(tab.status==='complete'&&!tab.pendingUrl&&(login?isPortal(tab.url,environment):tab.url==='about:blank'))return tab;
      await delay(100,ctx);
    }
    throw new Error(`Timed out ${login?'loading the hidden query login page':'preparing the hidden query window'}. Run the search again.`);
  };
  await waitForPage(false);
  try {
    try {await api.tabs.update(tabId,{url:LOGIN});}
    catch(error) {
      ctx.run.check();
      if(!/^Navigation rejected\.?$/i.test(error.message))throw error;
      const tab=await api.tabs.get(tabId);
      if(tab.windowId!==windowId)throw error;
      // A pending/committed login is already underway; never start it twice.
      if(!samePage(tab.pendingUrl||tab.url,LOGIN)) {
        // Retry only this initial GET, once, while the same owned tab is blank.
        // No credentials or query have been submitted at this stage.
        await delay(350,ctx);await waitForPage(false);
        await api.tabs.update(tabId,{url:LOGIN});
      }
    }
  } catch(error) {
    ctx.run.check();
    if(/^Navigation rejected\.?$/i.test(error.message))throw new Error('Chrome rejected navigation while opening the hidden query login page. No search was submitted. Try again, or turn off background searches to use the normal DMV tab.',{cause:error});
    throw error;
  }
  await waitForPage(true);
}

export async function backgroundSearch(kind, value, ctx, {publish, sourceId, api = ctx.browserApi||chrome}) {
  const guarded = guardedApi(api,ctx.run);
  // Resolve the destination before creating a helper (which must not become it).
  const windowId = await resultWindow(guarded,sourceId);
  const perform = async transport => {
    const task = {...ctx, ...transport, queryTask:{tabId:transport.tabId}, watchResults:watchBackgroundReport};
    let bytes, report;
    task.resultReady = async result => {
      bytes = await evaluate(result.portalId,'fetchPdf',{url:result.sourceUrl},task);
      report = result;
    };
    await search(kind,value,task);
    ctx.run.check();
    if(!bytes || !report)throw new Error('The background query did not capture a report. It was not resubmitted.');
    return {bytes, report};
  };
  let captured;
  let helper;
  try {
    // Record ownership before the guarded continuation: cancellation can race create.
    await ctx.run.step(async()=>{
      // Start blank so no portal page can appear before minimization is verified.
      // Use a regular browser window for the minimized startup path.
      // Chrome forbids width/height together with a minimized initial state.
      helper = await api.windows.create({url:'about:blank',type:'normal',focused:false,state:'minimized'});
      if(ctx.run.signal.aborted)await closeHelper(api,helper.id,helper.tabs?.[0]?.id,ctx);
    });
    const tab = helper.tabs?.[0] || (await guarded.tabs.query({windowId:helper.id}))[0];
    if(!tab)throw new Error('The background query window could not be created.');
    helper.tabId=tab.id;
    let initial=await guarded.windows.get(helper.id);
    if(initial.state!=='minimized') {
      // One initialization correction on this owned blank window only. Never
      // observe or re-minimize it once DMV navigation/manual interaction begins.
      await guarded.windows.update(helper.id,{state:'minimized',focused:false});
      initial=await guarded.windows.get(helper.id);
    }
    if(initial.state!=='minimized')throw new Error('Chrome could not minimize the query window. No DMV page was opened.');
    await openHelperLogin(guarded,helper.id,tab.id,ctx);
    captured = await perform({tabId:tab.id,browserApi:api});
  } finally {if(helper)await closeHelper(api,helper.id,helper.tabId ?? helper.tabs?.[0]?.id,ctx);}
  ctx.run.check();
  const result = await publish({...captured,windowId},ctx);
  await ctx.resultReady(result);
  // Same-address reports have no status popup. Reveal only their completed result,
  // after helper cleanup, immutable capture and the normal history/queue commit.
  if(kind==='address')await focusTab(result.tabId,{run:ctx.run,browserApi:api});
  ctx.status('Results ready');
  return result;
}
