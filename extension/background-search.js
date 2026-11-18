/** Unfocused query windows reuse the guarded workflow and blacklist callbacks.
 * Navigation leaves existing windows alone; completed same-address results are revealed. */
import {LOGIN, ROOT, attachmentUrl} from './core.js';
import {search, evaluate, focusTab} from './automation.js';
import {guardedApi} from './run.js';

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
      const sourceUrl = attachmentUrl(result.url);
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
async function closeHelper(api, windowId, tabId) {
  const tab=await api.tabs.get(tabId).catch(()=>null);
  const url=tab?.pendingUrl||tab?.url;
  if(url?.startsWith(`${ROOT}/SCTRNS/`))await evaluate(tabId,'stopBackgroundReport',{},{browserApi:api}).catch(()=>{});
  if(tab?.windowId===windowId&&(url==='about:blank'||url?.startsWith(`${ROOT}/SCTRNS/`)))await api.tabs.remove(tabId).catch(()=>{});
}

export async function backgroundSearch(kind, value, ctx, {publish, sourceId, api = chrome}) {
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
      if(ctx.run.signal.aborted)await closeHelper(api,helper.id,helper.tabs?.[0]?.id);
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
    await guarded.tabs.update(tab.id,{url:LOGIN});
    captured = await perform({tabId:tab.id,browserApi:api});
  } finally {if(helper)await closeHelper(api,helper.id,helper.tabId ?? helper.tabs?.[0]?.id);}
  ctx.run.check();
  const result = await publish({...captured,windowId},ctx);
  await ctx.resultReady(result);
  // Same-address reports have no status popup. Reveal only their completed result,
  // after helper cleanup, immutable capture and the normal history/queue commit.
  if(kind==='address')await focusTab(result.tabId,{run:ctx.run,browserApi:api});
  ctx.status('Results ready');
  return result;
}
