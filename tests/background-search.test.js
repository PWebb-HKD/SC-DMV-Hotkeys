import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backgroundSearch,backgroundMethod,resultWindow} from '../extension/background-search.js';
import {SearchRun} from '../extension/run.js';
import {LOGIN,MEMBER,PDF_URL} from '../extension/core.js';

function fixture({failure=false,moved=false}={}) {
  const calls=[],run=new SearchRun(),tabs=new Map([[1,{id:1,windowId:1}]]);
  let tab={id:9,windowId:2,url:LOGIN,status:'complete'},armed=false,submitted=0;
  tabs.set(9,tab);
  const operation=(op,args)=>{
    calls.push(op);
    if(op==='state')return {url:tab.url,present:true,enabled:true,presentSelectors:args.selectors?.map(()=>true)||[],errors:[]};
    if(op==='extensionLogin'&&args.submit)tab.url=MEMBER+'Disclaimer.aspx';
    if(op==='click'&&args.selector==='#btnFooterNavNext'){submitted++;tab.url=tab.url.replace('Page1','Page2');}
    if(op==='startBackgroundReport')armed=true;
    if(op==='backgroundReport')return failure?{error:'Unsupported report flow; no retry.'}:{url:PDF_URL};
    if(op==='click'&&args.selector==='#downloadButton')assert.equal(armed,true);
    if(op==='fetchPdf'){assert.equal(args.url,PDF_URL);return 'JVBERi1zeW50aGV0aWM=';}
    return true;
  };
  const api={
    storage:{session:{get:async()=>({lastQuery:0}),set:async()=>{}}},
    tabs:{get:async id=>{if(id===9&&moved)return {...tab,windowId:3};return tabs.get(id);},
      update:async(id,changes)=>{assert.equal(changes.active,undefined);Object.assign(tab,changes);return {...tab};},
      remove:async id=>{calls.push(['remove',id]);tabs.delete(id);},query:async()=>[...tabs.values()]},
    windows:{get:async()=>({id:1,type:'normal',state:'minimized'}),getAll:async()=>[{id:1,type:'normal'}],
      create:async options=>{calls.push(['window',options]);return {id:2,tabs:[tab]};},
      update:async()=>{throw new Error('Must not focus/restore/minimize windows');}},
    scripting:{executeScript:async({args:[op,args]})=>[{result:operation(op,args)}]}
  };
  globalThis.chrome=api;
  const ctx={run,status:()=>{},credentials:async()=>({user:'fixture',password:'fixture'}),beforeSubmit:async()=>calls.push('authorize'),resultReady:async result=>calls.push(['ready',result.tabId])};
  const options={api,sourceId:1,
    publish:async data=>{calls.push(['publish',data]);return {...data.report,tabId:20};}};
  return {calls,ctx,options,api,get submitted(){return submitted;}};
}

test('background queries require popup opt-in and only apply to plate/license/customer',()=>{
  const prefs={alertsEnabled:true,backgroundStatusSearch:true};
  for(const kind of ['plate','license','customer'])assert.equal(backgroundMethod(kind,prefs),'window');
  for(const kind of ['address','scutties','barcode','help'])assert.equal(backgroundMethod(kind,prefs),null);
  assert.equal(backgroundMethod('license',{...prefs,alertsEnabled:false}),null);
  assert.equal(backgroundMethod('license',{...prefs,backgroundStatusSearch:false}),null);
  // A stale saved method can never enable the removed iframe transport.
  assert.equal(backgroundMethod('license',{...prefs,backgroundSearchMethod:'offscreen'}),'window');
});
test('query submits once, checks blacklist, captures bytes and publishes without window focus',async()=>{
  const f=fixture();
  const result=await backgroundSearch('license','12345678',f.ctx,f.options);
  assert.equal(result.tabId,20);assert.equal(f.submitted,1);
  assert.equal(f.calls.filter(call=>call==='authorize').length,2);
  const publish=f.calls.find(call=>call[0]==='publish')[1];
  assert.equal(publish.bytes,'JVBERi1zeW50aGV0aWM=');assert.equal(publish.windowId,1);
  assert.ok(f.calls.indexOf('fetchPdf')<f.calls.findIndex(call=>call[0]==='publish'));
  const options=f.calls.find(call=>call[0]==='window')[1];
  assert.equal(options.focused,false);assert.equal(options.state,'minimized');
  assert.equal(options.width,undefined);assert.equal(options.height,undefined);
  assert.deepEqual(f.calls.filter(call=>call[0]==='remove'),[['remove',9]]);
});
test('query failures never resubmit the transaction',async()=>{
  const f=fixture({failure:true});
  await assert.rejects(backgroundSearch('customer','12345678',f.ctx,f.options),/no retry/);
  assert.equal(f.submitted,1);assert.equal(f.calls.some(call=>call[0]==='publish'),false);
});
test('helper cleanup leaves a user-moved tab in its new window',async()=>{
  const f=fixture({moved:true});await backgroundSearch('customer','12345678',f.ctx,f.options);
  assert.equal(f.calls.some(call=>call[0]==='remove'),false);
});
test('cancellation while window creation is pending removes the late owned tab without navigation',async()=>{
  const f=fixture(),created=Promise.withResolvers();
  f.api.windows.create=()=>created.promise;
  const task=backgroundSearch('customer','12345678',f.ctx,f.options);
  await new Promise(resolve=>setTimeout(resolve,10));f.ctx.run.cancel();
  await assert.rejects(task,{name:'AbortError'});
  created.resolve({id:2,tabs:[{id:9}]});await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(f.calls.filter(call=>call[0]==='remove'),[['remove',9]]);assert.equal(f.submitted,0);
});
test('background destination never creates/focuses a normal window',async()=>{
  const f=fixture();f.api.windows.getAll=async()=>[];
  await assert.rejects(resultWindow(f.api,null),/normal browser window/);
});
