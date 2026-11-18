// Exercise the real worker router, transport, reader ownership and popup pipeline.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LOGIN,MEMBER,PDF_URL} from '../extension/core.js';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(){}});
const session={},local={},calls=[],tabs=new Map([[1,{id:1,windowId:1,url:'https://example.test/',active:true}]]);
let nextTab=2,nextWindow=10,reportArmed=false,allowCompletedFocus=false,reportBase64='JVBERi1zeW50aGV0aWM=';
const area=data=>({setAccessLevel:async()=>{},get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys||Object.keys(data)).map(key=>[key,data[key]])),set:async values=>Object.assign(data,values),remove:async keys=>{for(const key of typeof keys==='string'?[keys]:keys)delete data[key];}});
const runtime={id:'a'.repeat(32),getURL:path=>'chrome-extension://'+'a'.repeat(32)+'/'+path,onMessage:event(),onConnect:event(),onStartup:event(),onInstalled:event(),sendMessage:async message=>{
  calls.push(message);
}};
function operation(tab,op,args) {
  if(op==='state')return {url:tab.url,errors:[],present:true,enabled:true,presentSelectors:args.selectors?.map(()=>true)||[]};
  if(op==='extensionLogin'&&args.submit)tab.url=MEMBER+'Disclaimer.aspx';
  if(op==='click'&&args.selector==='#btnFooterNavNext'){calls.push('submitted');tab.url=tab.url.replace('Page1','Page2');}
  if(op==='startBackgroundReport')reportArmed=true;
  if(op==='click'&&args.selector==='#downloadButton')assert.equal(reportArmed,true);
  if(op==='backgroundReport')return {url:PDF_URL};
  if(op==='fetchPdf')return reportBase64;
  return true;
}
globalThis.chrome={runtime,storage:{local:area(local),session:area(session)},
  tabs:{onCreated:event(),onUpdated:event(),onRemoved:event(),
    get:async id=>{if(!tabs.has(id))throw new Error('Missing tab');return {...tabs.get(id)};},
    query:async options=>[...tabs.values()].filter(tab=>(!options.active||tab.active)&&(options.windowId==null||tab.windowId===options.windowId)),
    create:async options=>{calls.push(['tab',options]);const tab={id:nextTab++,windowId:options.windowId||1,status:'complete',...options};tabs.set(tab.id,tab);return {...tab};},
    update:async(id,options)=>{calls.push(['update-tab',id,options]);Object.assign(tabs.get(id),options);if(options.url)tabs.get(id).documentId=crypto.randomUUID();if(options.active)for(const tab of tabs.values())if(tab.id!==id&&tab.windowId===tabs.get(id).windowId)tab.active=false;return {...tabs.get(id)};},
    remove:async id=>{calls.push(['remove-tab',id]);tabs.delete(id);},sendMessage:async()=>{}},
  windows:{onRemoved:event(),get:async id=>({id,type:'normal',state:'minimized'}),getAll:async()=>[{id:1,type:'normal',state:'minimized'}],
    create:async options=>{const id=nextWindow++;calls.push(['window',id,options]);if(options.url==='about:blank'){assert.equal(options.type,'normal');assert.equal(options.state,'minimized');assert.equal(options.focused,false);assert.equal(options.width,undefined);const tab={id:nextTab++,windowId:id,url:options.url,status:'complete',active:true};tabs.set(tab.id,tab);return {id,tabs:[tab]};}return {id};},
    update:async(id,changes)=>{
      assert.equal(allowCompletedFocus,true,'Alert-backed searches must never focus a browser window');
      assert.equal(id,1);assert.equal(session.history[0].kind,'address');
      assert.notEqual(session.history[0].id,'address-fixture','Commit a new history entry before revealing results');
      assert.equal(latestReport().active,true);
      assert.deepEqual(changes,changes.state?{state:'normal'}:{focused:true});
      calls.push(['focus-result',id,changes]);return {id,type:'normal',state:'normal'};
    },remove:async()=>{}},
  scripting:{executeScript:async({target,args:[op,args]})=>[{result:operation(tabs.get(target.tabId),op,args)}],getRegisteredContentScripts:async()=>[],registerContentScripts:async()=>{},updateContentScripts:async()=>{},insertCSS:async()=>{}},
  webNavigation:{onCommitted:event(),getFrame:async()=>null},commands:{onCommand:event(),getAll:async()=>[]},declarativeNetRequest:{updateDynamicRules:async()=>{}}
};
await import('../extension/background.js');
const send=(message,sender={})=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,{id:runtime.id,url:runtime.getURL('popup.html'),...sender},reply=>reply.ok?resolve(reply.value):reject(new Error(reply.error))));
async function wait(predicate){for(let attempt=0;attempt<400;attempt++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('Worker expectation timed out: '+session.status);}
const latestReport=()=>[...tabs.values()].findLast(tab=>tab.url.includes('query=1'));
const readerSend=(tab,message,changes={})=>send(message,{url:tab.url,tab:{id:tab.id},frameId:0,documentId:tab.documentId||'document-'+tab.id,...changes});
const hasPanel=type=>Object.values(session).some(value=>value?.type===type);

test('background preference persists without the retired method selector',async()=>{
  await send({type:'state'});
  await send({type:'background-search-settings',enabled:true});
  assert.equal((await send({type:'state'})).backgroundStatusSearch,true);
  assert.equal((await send({type:'state'})).backgroundSearchMethod,undefined);
  assert.equal(local.alertPreferences.backgroundStatusSearch,true);
});
test('worker result remains inactive and triggers status on parsed text before viewer paint',async()=>{
  await send({type:'stop'});
  session.credentials={user:'synthetic',password:'synthetic'};
  await send({type:'alerts',enabled:true});await send({type:'background-search-settings',enabled:true});
  session.queue={values:['12345678'],index:0};
  const previous=latestReport()?.url,from=calls.length;
  await send({type:'run',command:'next'});
  await wait(()=>latestReport()?.url!==previous&&session.queue.index===1);
  const tab=latestReport(),id=new URL(tab.url).searchParams.get('id');
  assert.equal(tab.active,false);assert.equal(tab.windowId,1);assert.equal(tabs.get(1).active,true);
  assert.equal(calls.slice(from).filter(call=>call==='submitted').length,1);
  assert.equal(hasPanel('record-alert'),false);
  await assert.rejects(readerSend(tab,{type:'reader-start',id},{tab:{id:1}}),/Unknown PDF/);
  const bytes=await readerSend(tab,{type:'reader-start',id});assert.equal(bytes.base64,'JVBERi1zeW50aGV0aWM=');
  await assert.rejects(readerSend(tab,{type:'reader-start',id}),/again/);
  await assert.rejects(readerSend(tab,{type:'reader-result',id,text:'stale'},{documentId:'other'}),/Unknown PDF/);
  await readerSend(tab,{type:'reader-result',id,text:'Status - DL: SUSPENDED\nDriver License No: 12345678 Name: SYNTHETIC, PERSON'});
  await wait(()=>hasPanel('record-alert'));
  assert.match(session[`pdf:${tab.id}`].text,/SUSPENDED/);
  const alert=Object.values(session).find(value=>value?.type==='record-alert');assert.equal(alert.sections[0].title,'LICENSE SUSPENDED');
  await assert.rejects(readerSend(tab,{type:'reader-start',id}),/Unknown PDF/);
  assert.equal(JSON.stringify(local).includes('SYNTHETIC, PERSON'),false);
});
test('Stop cancels an outstanding background reader and keeps its bytes unavailable to reload',async()=>{
  await send({type:'stop'});session.credentials={user:'synthetic',password:'synthetic'};
  session.queue={values:['23456789'],index:0};const previous=latestReport().url;
  await send({type:'run',command:'next'});await wait(()=>latestReport().url!==previous&&session.queue.index===1);
  const tab=latestReport(),id=new URL(tab.url).searchParams.get('id');
  await send({type:'stop'});await wait(()=>calls.some(call=>call?.type==='reader-cancel'&&call.id===id));
  await assert.rejects(readerSend(tab,{type:'reader-start',id}),/Unknown PDF/);
  assert.equal(hasPanel('record-alert'),false);
});
test('same-address replay runs hidden and focuses results after history commit without a status popup',async()=>{
  await send({type:'stop'});session.credentials={user:'synthetic',password:'synthetic'};
  await send({type:'alerts',enabled:true});await send({type:'background-search-settings',enabled:true});
  session.history=[{id:'address-fixture',kind:'address',value:'12345678',at:Date.now()}];
  const previous=latestReport().url,from=calls.length;allowCompletedFocus=true;
  try {
    await send({type:'rerun',search:{id:'address-fixture'}});
    await wait(()=>latestReport().url!==previous&&calls.slice(from).filter(call=>call[0]==='focus-result').length===2);
    const tab=latestReport(),id=new URL(tab.url).searchParams.get('id');
    assert.equal(tab.active,true);assert.equal(tab.windowId,1);assert.equal(tabs.get(1).active,false);
    assert.equal(calls.slice(from).filter(call=>call==='submitted').length,1);
    assert.ok(calls.slice(from).some(call=>call[0]==='update-tab'&&call[2].url?.includes('/DrvSameRes/Page1.aspx')));
    const helperTab=calls.slice(from).find(call=>call[0]==='remove-tab')[1];
    assert.equal(tabs.has(helperTab),false);
    await readerSend(tab,{type:'reader-start',id});
    await readerSend(tab,{type:'reader-result',id,text:'Customers at Same Residence\nCustomer Number: 12345678'});
    await wait(()=>session[`pdf:${tab.id}`]?.text);
    assert.equal(hasPanel('record-alert'),false);assert.equal(session.history[0].kind,'address');
  } finally {allowCompletedFocus=false;await send({type:'stop'});}
});
async function nextReport(value='34567890') {
  await send({type:'stop'});session.credentials={user:'synthetic',password:'synthetic'};
  session.queue={values:[value],index:0};
  const previous=latestReport()?.url,from=calls.length;
  await send({type:'run',command:'next'});
  await wait(()=>latestReport()?.url!==previous&&session.queue.index===1);
  return {tab:{...latestReport()},from};
}
test('reuses one results tab with fresh bytes, cleared identity and a new document-bound job',async()=>{
  const old={...latestReport()},oldId=new URL(old.url).searchParams.get('id');
  session[`pdf:${old.id}`].driverIdentity={name:'OLD SYNTHETIC IDENTITY',photo:'data:image/png;base64,AAAA'};
  reportBase64=Buffer.from('%PDF-FRESH SYNTHETIC REPORT').toString('base64');
  const {tab,from}=await nextReport(),id=new URL(tab.url).searchParams.get('id');
  assert.equal(tab.id,old.id);assert.notEqual(id,oldId);assert.notEqual(tab.documentId,old.documentId);
  assert.equal([...tabs.values()].filter(tab=>tab.url.includes('query=1')).length,1);
  assert.equal(calls.slice(from).filter(call=>call[0]==='tab').length,0);
  assert.equal(session[`pdf:${tab.id}`],undefined);
  await assert.rejects(readerSend(old,{type:'reader-start',id}),/Unknown PDF/);
  await assert.rejects(readerSend(old,{type:'reader-result',id,text:'OLD DATA'}),/Unknown PDF/);
  await assert.rejects(readerSend(tab,{type:'reader-result',id,text:'Before handshake'}),/Unknown PDF/);
  const job=await readerSend(tab,{type:'reader-start',id});assert.equal(job.base64,reportBase64);
  await assert.rejects(readerSend(tab,{type:'reader-result',id,text:'OLD DATA'},{documentId:old.documentId}),/Unknown PDF/);
  await assert.rejects(readerSend(old,{type:'reader-result',id:oldId,text:'OLD DATA'}),/Unknown PDF/);
  await readerSend(tab,{type:'reader-result',id,text:'Status - DL: SUSPENDED\nDriver License No: 34567890 Name: NEW, SYNTHETIC'});
  await wait(()=>hasPanel('record-alert'));
  assert.match(session[`pdf:${tab.id}`].text,/34567890/);assert.equal(session[`pdf:${tab.id}`].driverIdentity,undefined);
  assert.equal(session[`pdf:${tab.id}`].documentId,tab.documentId);
  assert.equal(calls.slice(from).filter(call=>call[0]==='focus-result').length,0);
});
test('a user navigating the candidate during selection is preserved and a new result tab is created',async()=>{
  const old={...latestReport()},query=chrome.tabs.query;
  let changed=false;
  chrome.tabs.query=async options=>{
    const found=(await query(options)).map(tab=>({...tab}));
    if(options.windowId===1&&!changed){changed=true;tabs.get(old.id).url='https://example.test/user-page';}
    return found;
  };
  try {
    const {tab}=await nextReport();assert.equal(changed,true);assert.notEqual(tab.id,old.id);
    assert.equal(tabs.get(old.id).url,'https://example.test/user-page');
  } finally {chrome.tabs.query=query;}
});
test('closing the previous report creates one replacement result tab',async()=>{
  const old={...latestReport()};tabs.delete(old.id);
  for(const listener of chrome.tabs.onRemoved.listeners)await listener(old.id);
  const {tab,from}=await nextReport();assert.notEqual(tab.id,old.id);
  assert.equal(calls.slice(from).filter(call=>call[0]==='tab').length,1);
});
test('failed reuse navigation never closes the existing results tab',async()=>{
  await send({type:'stop'});const old={...latestReport()},update=chrome.tabs.update,from=calls.length;
  chrome.tabs.update=async(id,options)=>{
    if(id===old.id&&options.url?.includes('query=1'))throw new Error('Synthetic navigation failure');
    return update(id,options);
  };
  try {
    session.queue={values:['45678901'],index:0};await send({type:'run',command:'next'});
    await wait(()=>hasPanel('notice'));
    assert.equal(tabs.get(old.id).url,old.url);
    assert.equal(calls.slice(from).some(call=>call[0]==='remove-tab'&&call[1]===old.id),false);
  } finally {chrome.tabs.update=update;await send({type:'stop'});}
});
test('a late old snapshot write is cleared before the replacement report is published',async()=>{
  const {tab:old}=await nextReport('56789012'),oldId=new URL(old.url).searchParams.get('id');
  await readerSend(old,{type:'reader-start',id:oldId});
  const write=chrome.storage.session.set,entered=Promise.withResolvers(),release=Promise.withResolvers();
  chrome.storage.session.set=async values=>{
    if(values[`pdf:${old.id}`]?.text==='LATE OLD SNAPSHOT'){entered.resolve();await release.promise;}
    return write(values);
  };
  try {
    await readerSend(old,{type:'reader-result',id:oldId,text:'LATE OLD SNAPSHOT'});await entered.promise;
    const from=calls.length,next=nextReport('67890123');next.catch(()=>{});
    await wait(()=>calls.slice(from).some(call=>call==='submitted'));
    assert.equal(latestReport().url,old.url);
    release.resolve();const {tab}=await next;
    assert.equal(tab.id,old.id);assert.notEqual(tab.url,old.url);assert.equal(session[`pdf:${tab.id}`],undefined);
    const id=new URL(tab.url).searchParams.get('id');await readerSend(tab,{type:'reader-start',id});
    await readerSend(tab,{type:'reader-result',id,text:'NEW SNAPSHOT 67890123'});
    await wait(()=>session[`pdf:${tab.id}`]?.text==='NEW SNAPSHOT 67890123');
  } finally {release.resolve();chrome.storage.session.set=write;await send({type:'stop'});}
});
