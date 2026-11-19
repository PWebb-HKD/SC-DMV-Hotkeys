/** Real browser pages and worker/controllers, with explicit Chrome API substitutes.
 * This does not install an extension or establish native Windows focus behavior. */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {dependency} from '../runtime.mjs';
import {startDemoServer} from '../../demo/server.mjs';
import {LIVE,DEMO,DEMO_PERMISSION} from '../../extension/environment.js';
const {chromium}=dependency('playwright'),base='http://extension.fixture.test/';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(fn){this.listeners=this.listeners.filter(f=>f!==fn);}});
export async function demoExtension(){
  const site=await startDemoServer(4173),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true});
  const context=await browser.newContext({viewport:{width:1100,height:850}}),pages=new Map(),byPage=new WeakMap(),windows=new Map([[1,{id:1,type:'normal',state:'normal',focused:true}]]);
  const session={history:[{id:'live-old',kind:'plate',value:'LIVE123',at:1}],queue:{values:['87654321'],index:1},credentials:{user:'LIVE-ONLY-USER',password:'LIVE-ONLY-PASSWORD'}},local={vault:{salt:'LIVE-VAULT',iv:'LIVE-IV',ciphertext:'LIVE-CIPHERTEXT'}};
  const requests=[],errors=[],operations=[],storageReads=[];let sequence=1,windowSequence=2,focusedWindow=1,permission=false,permitRequest=true,rules=[],registered=[],holdReader=false,pendingReader=null,holdState=false,pendingState=null;
  const emit=(e,...args)=>{for(const fn of [...e.listeners])Promise.resolve(fn(...args)).catch(error=>errors.push(error.message));};
  const storageChanged=event(),runtime={id:'a'.repeat(32),getURL:path=>base+path,onMessage:event(),onConnect:event(),onInstalled:event(),onStartup:event(),sendMessage:async message=>{
    for(const record of pages.values())if(record.tab.url.startsWith(base))await record.page.evaluate(message=>window.chrome?.runtime.onMessage.listeners.forEach(fn=>fn(message)),message).catch(()=>{});
  }};
  const area=(data,scope)=>({setAccessLevel:async()=>{},clear:async()=>{for(const k of Object.keys(data))delete data[k];},get:async keys=>{
    const list=keys==null?Object.keys(data):typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys);storageReads.push({scope,keys:list});return Object.fromEntries(list.map(k=>[k,structuredClone(data[k])]));
  },set:async values=>{
    const changes={};for(const [key,value] of Object.entries(values)){changes[key]={oldValue:data[key],newValue:structuredClone(value)};data[key]=structuredClone(value);}
    for(const record of pages.values())if(record.tab.url.startsWith(base))record.page.evaluate(({changes,scope})=>window.chrome?.storage.onChanged.listeners.forEach(fn=>fn(changes,scope)),{changes,scope}).catch(()=>{});
    emit(storageChanged,changes,scope);
  },remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete data[k];}});
  const chrome={runtime,storage:{local:area(local,'local'),session:area(session,'session'),onChanged:storageChanged},
    commands:{onCommand:event(),getAll:async()=>[]},permissions:{contains:async()=>permission,request:async()=>{if(permitRequest)permission=true;return permitRequest;},onRemoved:event()},
    declarativeNetRequest:{updateDynamicRules:async({addRules=[]})=>{rules=addRules;}},
    webNavigation:{onCommitted:event(),getFrame:async({tabId})=>({documentId:pages.get(tabId)?.tab.documentId})},
    scripting:{getRegisteredContentScripts:async()=>registered,registerContentScripts:async scripts=>{registered.push(...scripts);},unregisterContentScripts:async({ids})=>{registered=registered.filter(s=>!ids.includes(s.id));},updateContentScripts:async()=>{},insertCSS:async()=>{},removeCSS:async()=>{},executeScript:async request=>{
      if(request.files)return [];
      const record=pages.get(request.target.tabId);if(!record)throw new Error('Missing fixture tab');
      operations.push({op:request.args[0],url:record.tab.url,args:request.args[1]});
      // DevTools evaluation serializes the same self-contained function used by Chrome scripting.
      try{const result=await record.page.evaluate('('+request.func.toString()+')('+request.args.map(arg=>JSON.stringify(arg)).join(',')+')');return [{result}];}
      catch(error){if(/Execution context was destroyed|Cannot find context with specified id/i.test(error.message))throw new Error('Document was unloaded.');throw error;}
    }},
    tabs:{onCreated:event(),onUpdated:event(),onRemoved:event(),query:async options=>[...pages.values()].map(r=>({...r.tab})).filter(t=>{
      if(options.active&&!t.active||options.lastFocusedWindow&&t.windowId!==focusedWindow||options.windowId!=null&&t.windowId!==options.windowId)return false;
      if(options.url){const patterns=Array.isArray(options.url)?options.url:[options.url];if(!patterns.some(p=>new RegExp('^'+p.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*')+'$').test(t.url)))return false;}
      return true;
    }),get:async id=>{if(!pages.has(id))throw new Error('Missing fixture tab');return {...pages.get(id).tab};},create:async options=>{
      const page=await context.newPage(),record=register(page);record.tab.windowId=options.windowId||1;record.tab.active=options.active===true;
      if(options.openerTabId)record.tab.openerTabId=options.openerTabId;
      await page.goto(options.url,{waitUntil:'domcontentloaded'});return {...record.tab};
    },update:async(id,changes)=>{
      const record=pages.get(id);if(!record)throw new Error('Missing fixture tab');
      if(changes.active){for(const r of pages.values())if(r.tab.windowId===record.tab.windowId)r.tab.active=false;record.tab.active=true;}
      if(changes.url){record.tab.pendingUrl=changes.url;record.tab.status='loading';emit(chrome.tabs.onUpdated,id,{status:'loading',pendingUrl:changes.url},{...record.tab});await record.page.goto(changes.url,{waitUntil:'domcontentloaded'});}
      return {...record.tab};
    },remove:async id=>{const record=pages.get(id);if(record)await record.page.close();},sendMessage:async()=>{}},
    windows:{onRemoved:event(),onBoundsChanged:event(),get:async id=>({...windows.get(id)}),getAll:async options=>[...windows.values()].filter(w=>!options?.windowTypes||options.windowTypes.includes(w.type)),update:async(id,changes)=>{
      Object.assign(windows.get(id),changes);if(changes.focused)focusedWindow=id;
      const record=[...pages.values()].find(r=>r.tab.windowId===id);
      if(record&&changes.height&&record.tab.url.startsWith(base))await record.page.setViewportSize({width:changes.width||record.page.viewportSize().width,height:Math.min(1000,changes.height)}).catch(()=>{});
      return {...windows.get(id)};
    },create:async options=>{
      const id=windowSequence++;windows.set(id,{id,type:options.type||'normal',state:options.state||'normal',focused:options.focused!==false,width:options.width||1100,height:options.height||850});
      const page=await context.newPage(),record=register(page);record.tab.windowId=id;record.tab.active=true;
      if(options.focused)focusedWindow=id;await page.setViewportSize({width:options.width||1100,height:options.height||850});await page.goto(options.url,{waitUntil:'domcontentloaded'});return {...windows.get(id),tabs:[{...record.tab}]};
    },remove:async id=>{for(const r of [...pages.values()])if(r.tab.windowId===id)await r.page.close();windows.delete(id);emit(chrome.windows.onRemoved,id);}}
  };
  function register(page){
    if(byPage.has(page))return byPage.get(page);
    const record={page,tab:{id:sequence++,windowId:1,url:page.url(),status:'complete',active:false,documentId:crypto.randomUUID()}};pages.set(record.tab.id,record);byPage.set(page,record);emit(chrome.tabs.onCreated,{...record.tab});
    page.opener().then(opener=>{if(opener)record.tab.openerTabId=register(opener).tab.id;});
    page.on('pageerror',error=>errors.push(error.message));page.on('close',()=>{pages.delete(record.tab.id);emit(chrome.tabs.onRemoved,record.tab.id);if(![...pages.values()].some(r=>r.tab.windowId===record.tab.windowId)){windows.delete(record.tab.windowId);emit(chrome.windows.onRemoved,record.tab.windowId);}});
    page.on('framenavigated',frame=>{
      if(frame!==page.mainFrame())return;record.tab.url=frame.url();delete record.tab.pendingUrl;record.tab.documentId=crypto.randomUUID();record.tab.status='loading';emit(chrome.webNavigation.onCommitted,{tabId:record.tab.id,frameId:0,url:frame.url(),documentId:record.tab.documentId});emit(chrome.tabs.onUpdated,record.tab.id,{url:frame.url(),status:'loading'},{...record.tab});
    });
    page.on('domcontentloaded',()=>{record.tab.status='complete';emit(chrome.tabs.onUpdated,record.tab.id,{status:'complete'},{...record.tab});});return record;
  }
  context.on('page',register);context.on('request',r=>requests.push(r.url()));
  const send=(message,sender={})=>new Promise((accept,reject)=>{const kept=runtime.onMessage.listeners[0](message,{id:runtime.id,url:base+'popup.html',...sender},reply=>reply.ok?accept(reply.value):reject(new Error(reply.error)));if(!kept)reject(new Error('Message was refused'));});
  await context.exposeBinding('fixtureSend',async({page},message)=>{
    const record=register(page),sender={url:page.url(),tab:{id:record.tab.id},frameId:0,documentId:record.tab.documentId};
    if(message.type==='reader-result'&&holdReader){holdReader=false;const gate=Promise.withResolvers();pendingReader=gate;await gate.promise;}
    const response=await send(message,sender).then(value=>({ok:true,value}),error=>({ok:false,error:error.message}));
    if(message.type==='state'&&holdState){holdState=false;const gate=Promise.withResolvers();pendingState=gate;await gate.promise;}
    return response;
  });
  await context.exposeBinding('fixturePermission',()=>chrome.permissions.request());
  await context.exposeBinding('fixtureCurrentWindow',({page})=>({...windows.get(register(page).tab.windowId)}));
  await context.exposeBinding('fixtureWindowUpdate',(_,args)=>chrome.windows.update(...args));
  await context.exposeBinding('fixtureCreateTab',(_,args)=>chrome.tabs.create(args));
  await context.exposeBinding('fixtureClose',({page})=>{setTimeout(()=>page.close().catch(()=>{}),0);return true;});
  await context.addInitScript(({base})=>{
    if(!location.href.startsWith(base))return;
    const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(fn){this.listeners=this.listeners.filter(f=>f!==fn);}});
    window.chrome={runtime:{getURL:path=>base+path,sendMessage:message=>window.fixtureSend(message),connect:()=>({postMessage(){}}),onMessage:event()},storage:{onChanged:event()},permissions:{request:()=>window.fixturePermission()},tabs:{create:args=>window.fixtureCreateTab(args)},windows:{getCurrent:()=>window.fixtureCurrentWindow(),update:(...args)=>window.fixtureWindowUpdate(args),onBoundsChanged:event()}};
    window.close=()=>{window.fixtureClose();};
    const send=window.chrome.runtime.sendMessage;window.chrome.runtime.sendMessage=message=>send(message).then(response=>{if(message.type==='state')window.fixtureStateDelivered=(window.fixtureStateDelivered||0)+1;return response;});
  },{base});
  const root=fileURLToPath(new URL('../../extension/',import.meta.url));
  await context.route(base+'**',async route=>{
    const path=decodeURIComponent(new URL(route.request().url()).pathname).slice(1),file=resolve(root,path);if(!file.startsWith(root)||path.includes('..'))return route.abort();
    const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.wasm':'application/wasm'};
    try{await route.fulfill({body:await readFile(file),contentType:types[extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:'Fixture resource unavailable'});}
  });
  await context.route('**/*',async route=>{
    const request=route.request(),url=request.url();
    if(!/^https?:/.test(url))return route.continue();
    if(url.startsWith(base))return route.fallback();
    if(url.startsWith(DEMO.origin)){
      const rule=rules.find(r=>new RegExp(r.condition.regexFilter,'i').test(url));
      let main=true;try{main=request.frame()===request.frame().page().mainFrame();}catch{/* Initial popup navigation precedes its frame. */}
      if(rule&&request.isNavigationRequest()&&main)return route.fulfill({status:302,headers:{location:rule.action.redirect.regexSubstitution.replace('\\0',url)},body:''});
      return route.continue();
    }
    errors.push('Unexpected external request: '+new URL(url).origin);return route.abort();
  });
  globalThis.chrome=chrome;await import('../../extension/background.js');await send({type:'state'});
  const page=await context.newPage(),record=register(page);record.tab.active=true;await page.goto(base+'popup.html');
  return {site,browser,context,page,pages,session,local,requests,errors,operations,storageReads,send,chrome,base,
    holdNextReader:()=>{holdReader=true;pendingReader=null;},hasHeldReader:()=>!!pendingReader,releaseReader:()=>pendingReader?.resolve(),
    holdNextState:()=>{holdState=true;pendingState=null;},hasHeldState:()=>!!pendingState,releaseState:()=>pendingState?.resolve(),
    revokePermission:async()=>{permission=false;for(const fn of chrome.permissions.onRemoved.listeners)await fn({origins:[DEMO_PERMISSION]});},
    setPermission:allowed=>{permitRequest=allowed;},activate:async tab=>{focusedWindow=tab.windowId;await chrome.tabs.update(tab.id,{active:true});},
    panel:type=>[...pages.values()].findLast(r=>r.tab.url.startsWith(base+'panel.html')&&session['panel:'+new URL(r.tab.url).searchParams.get('id')]?.type===type),
    state:()=>send({type:'state'}),
    async close(){await send({type:'stop'}).catch(()=>{});await context.close();await browser.close();await site.close();}
  };
}
