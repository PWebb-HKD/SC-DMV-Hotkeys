// Exercise the real worker router, transport, reader ownership and popup pipeline.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LOGIN,MEMBER,PDF_URL} from '../extension/core.js';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(){}});
const session={},local={},calls=[],tabs=new Map([[1,{id:1,windowId:1,url:'https://example.test/',active:true}]]);
let nextTab=2,nextWindow=10,offscreen=false,frame,reportArmed=false;
const area=data=>({setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys||Object.keys(data)).map(key=>[key,data[key]])),set:async values=>Object.assign(data,values),remove:async keys=>{for(const key of typeof keys==='string'?[keys]:keys)delete data[key];}});
const runtime={id:'a'.repeat(32),getURL:path=>'chrome-extension://'+'a'.repeat(32)+'/'+path,onMessage:event(),onConnect:event(),onStartup:event(),onInstalled:event(),sendMessage:async message=>{
  calls.push(message);
  if(message.target!=='query-host')return;
  if(message.op==='init'){frame={id:-1,url:LOGIN,status:'complete'};return {ok:true,value:true};}
  if(message.op==='state')return {ok:true,value:frame};
  if(message.op==='navigate'){frame.url=message.args.url;return {ok:true,value:true};}
  return {ok:true,value:operation(frame,message.args.op,message.args.args)};
}};
function operation(tab,op,args) {
  if(op==='state')return {url:tab.url,errors:[],present:true,enabled:true,presentSelectors:args.selectors?.map(()=>true)||[]};
  if(op==='extensionLogin'&&args.submit)tab.url=MEMBER+'Disclaimer.aspx';
  if(op==='click'&&args.selector==='#btnFooterNavNext'){calls.push('submitted');tab.url=tab.url.replace('Page1','Page2');}
  if(op==='startBackgroundReport')reportArmed=true;
  if(op==='click'&&args.selector==='#downloadButton')assert.equal(reportArmed,true);
  if(op==='backgroundReport')return {url:PDF_URL};
  if(op==='fetchPdf')return 'JVBERi1zeW50aGV0aWM=';
  return true;
}
globalThis.chrome={runtime,storage:{local:area(local),session:area(session)},
  tabs:{onCreated:event(),onUpdated:event(),onRemoved:event(),
    get:async id=>{if(!tabs.has(id))throw new Error('Missing tab');return {...tabs.get(id)};},
    query:async options=>[...tabs.values()].filter(tab=>(!options.active||tab.active)&&(options.windowId==null||tab.windowId===options.windowId)),
    create:async options=>{calls.push(['tab',options]);const tab={id:nextTab++,windowId:options.windowId||1,status:'complete',...options};tabs.set(tab.id,tab);return {...tab};},
    update:async(id,options)=>{calls.push(['update-tab',id,options]);Object.assign(tabs.get(id),options);return {...tabs.get(id)};},
    remove:async id=>{calls.push(['remove-tab',id]);tabs.delete(id);},sendMessage:async()=>{}},
  windows:{onRemoved:event(),get:async id=>({id,type:'normal',state:'minimized'}),getAll:async()=>[{id:1,type:'normal',state:'minimized'}],
    create:async options=>{const id=nextWindow++;calls.push(['window',id,options]);if(options.url===LOGIN){const tab={id:nextTab++,windowId:id,url:LOGIN,status:'complete',active:true};tabs.set(tab.id,tab);return {id,tabs:[tab]};}return {id};},
    update:async()=>{throw new Error('Background transport must not focus/restore/minimize a window');},remove:async()=>{}},
  scripting:{executeScript:async({target,args:[op,args]})=>[{result:operation(tabs.get(target.tabId),op,args)}],getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},updateContentScripts:async()=>{},insertCSS:async()=>{}},
  offscreen:{hasDocument:async()=>offscreen,createDocument:async options=>{assert.equal(offscreen,false);calls.push(['offscreen',options]);offscreen=true;},closeDocument:async()=>{calls.push('close-offscreen');offscreen=false;}},
  webNavigation:{onCommitted:event(),getFrame:async()=>null},commands:{onCommand:event(),getAll:async()=>[]},declarativeNetRequest:{updateDynamicRules:async()=>{}}
};
await import('../extension/background.js');
const send=(message,sender={})=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,{id:runtime.id,url:runtime.getURL('popup.html'),...sender},reply=>reply.ok?resolve(reply.value):reject(new Error(reply.error))));
async function wait(predicate){for(let attempt=0;attempt<400;attempt++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('Worker expectation timed out: '+session.status);}
const latestReport=()=>[...tabs.values()].findLast(tab=>tab.url.includes('query=1'));
const readerSend=(tab,message,changes={})=>send(message,{url:tab.url,tab:{id:tab.id},frameId:0,documentId:'document-'+tab.id,...changes});
const hasPanel=type=>Object.values(session).some(value=>value?.type===type);

test('background preferences persist and reject unknown methods',async()=>{
  await send({type:'state'});
  await send({type:'background-search-settings',enabled:true,method:'offscreen'});
  assert.equal((await send({type:'state'})).backgroundSearchMethod,'offscreen');
  assert.equal(local.alertPreferences.backgroundStatusSearch,true);
  await assert.rejects(send({type:'background-search-settings',enabled:true,method:'unknown'}),/available/);
});
for(const method of ['window','offscreen'])test(`worker ${method} result remains inactive, owns captured bytes and triggers status after parsing`,async()=>{
  await send({type:'stop'});
  session.credentials={user:'synthetic',password:'synthetic'};
  await send({type:'alerts',enabled:true});await send({type:'background-search-settings',enabled:true,method});
  session.queue={values:['12345678'],index:0};
  const previous=latestReport()?.id,from=calls.length;
  await send({type:'run',command:'next'});
  await wait(()=>latestReport()?.id!==previous&&session.queue.index===1);
  const tab=latestReport(),id=new URL(tab.url).searchParams.get('id');
  assert.equal(tab.active,false);assert.equal(tab.windowId,1);assert.equal(tabs.get(1).active,true);
  assert.equal(calls.slice(from).filter(call=>call==='submitted').length,1);
  assert.equal(hasPanel('record-alert'),false);
  await assert.rejects(readerSend(tab,{type:'reader-start',id},{tab:{id:1}}),/Unknown PDF/);
  const bytes=await readerSend(tab,{type:'reader-start',id});assert.equal(bytes.base64,'JVBERi1zeW50aGV0aWM=');
  await assert.rejects(readerSend(tab,{type:'reader-start',id}),/again/);
  await assert.rejects(readerSend(tab,{type:'reader-result',id,text:'stale'},{documentId:'other'}),/Unknown PDF/);
  await readerSend(tab,{type:'reader-result',id,text:'Status - DL: SUSPENDED\nDriver License No: 12345678 Name: SYNTHETIC, PERSON',viewReady:true});
  await wait(()=>hasPanel('record-alert'));
  assert.match(session[`pdf:${tab.id}`].text,/SUSPENDED/);
  const alert=Object.values(session).find(value=>value?.type==='record-alert');assert.equal(alert.sections[0].title,'LICENSE SUSPENDED');
  if(method==='offscreen')assert.equal(offscreen,false);
  await assert.rejects(readerSend(tab,{type:'reader-start',id}),/Unknown PDF/);
  assert.equal(JSON.stringify(local).includes('SYNTHETIC, PERSON'),false);
});
test('Stop cancels an outstanding background reader and keeps its bytes unavailable to reload',async()=>{
  await send({type:'stop'});session.credentials={user:'synthetic',password:'synthetic'};
  session.queue={values:['23456789'],index:0};const previous=latestReport().id;
  await send({type:'run',command:'next'});await wait(()=>latestReport().id!==previous&&session.queue.index===1);
  const tab=latestReport(),id=new URL(tab.url).searchParams.get('id');
  await send({type:'stop'});await wait(()=>calls.some(call=>call?.type==='reader-cancel'&&call.id===id));
  await assert.rejects(readerSend(tab,{type:'reader-start',id}),/Unknown PDF/);
  assert.equal(hasPanel('record-alert'),false);
});
