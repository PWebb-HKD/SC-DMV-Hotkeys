import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backgroundSearch,backgroundMethod,resultWindow} from '../extension/background-search.js';
import {SearchRun} from '../extension/run.js';
import {LOGIN,MEMBER,PDF_URL} from '../extension/core.js';

function fixture({failure=false,moved=false,ignoredCreation=false,minimizeFails=false,manualRestore=false}={}) {
  const calls=[],run=new SearchRun(),tabs=new Map([[1,{id:1,windowId:1}]]);
  let tab={id:9,windowId:2,url:'about:blank',status:'complete'},armed=false,submitted=0;
  let helperState=ignoredCreation?'normal':'minimized',mainState='minimized';
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
    if(op==='fill')calls.push(['fill',args.selector,args.value]);
    return true;
  };
  const api={
    storage:{session:{get:async()=>({lastQuery:0}),set:async()=>{}}},
    tabs:{get:async id=>{if(id===9&&moved)return {...tab,windowId:3};return tabs.get(id);},
      update:async(id,changes)=>{calls.push(['navigate',id,changes]);if(id===9)assert.equal(changes.active,undefined);else {assert.equal(id,20);assert.ok(calls.some(call=>call[0]==='ready'));}Object.assign(tabs.get(id),changes);if(id===9&&manualRestore&&changes.url===LOGIN)helperState='normal';return {...tabs.get(id)};},
      remove:async id=>{calls.push(['remove',id]);tabs.delete(id);},query:async()=>[...tabs.values()]},
    windows:{get:async id=>{calls.push(['get-window',id]);return {id,type:'normal',state:id===2?helperState:mainState};},getAll:async()=>[{id:1,type:'normal'}],
      create:async options=>{calls.push(['window',options]);return {id:2,tabs:[tab]};},
      update:async(id,changes)=>{
        if(id===1) {
          assert.ok(calls.some(call=>call[0]==='ready'),'Only reveal completed results');
          assert.ok(calls.some(call=>call[0]==='remove'&&call[1]===9),'Clean helper before revealing results');
          assert.deepEqual(changes,changes.state?{state:'normal'}:{focused:true});
          if(changes.state)mainState=changes.state;
          calls.push(['reveal-result',id,changes]);return {id,state:mainState};
        }
        assert.equal(id,2,'Only the owned helper may be initialized');
        assert.equal(tab.url,'about:blank','Minimize only before DMV navigation');
        assert.deepEqual(changes,{state:'minimized',focused:false});
        calls.push(['initialize-window',id,changes]);if(!minimizeFails)helperState='minimized';
        return {id,state:helperState};
      }},
    scripting:{executeScript:async({args:[op,args]})=>[{result:operation(op,args)}]}
  };
  globalThis.chrome=api;
  const ctx={run,status:()=>{},credentials:async()=>({user:'fixture',password:'fixture'}),beforeSubmit:async()=>calls.push('authorize'),resultReady:async result=>calls.push(['ready',result.tabId])};
  const options={api,sourceId:1,
    publish:async data=>{calls.push(['publish',data]);tabs.set(20,{id:20,windowId:1,active:false,url:PDF_URL});return {...data.report,tabId:20};}};
  return {calls,ctx,options,api,get submitted(){return submitted;},get helperState(){return helperState;}};
}

test('background queries include same-address but exclude SCUTTIES and local commands',()=>{
  const prefs={alertsEnabled:true,backgroundStatusSearch:true};
  for(const kind of ['plate','license','customer','address'])assert.equal(backgroundMethod(kind,prefs),'window');
  for(const kind of ['scutties','barcode','help'])assert.equal(backgroundMethod(kind,prefs),null);
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
  assert.equal(options.type,'normal');assert.equal(options.url,'about:blank');
  assert.equal(options.width,undefined);assert.equal(options.height,undefined);
  assert.equal(f.calls.some(call=>call[0]==='initialize-window'),false);
  assert.ok(f.calls.findIndex(call=>call[0]==='get-window'&&call[1]===2)<f.calls.findIndex(call=>call[0]==='navigate'));
  assert.deepEqual(f.calls.filter(call=>call[0]==='remove'),[['remove',9]]);
  assert.equal(f.calls.some(call=>call[0]==='reveal-result'),false);
});
test('same-address navigates hidden, then reveals only its completed immutable report',async()=>{
  const f=fixture();await backgroundSearch('address','12345678',f.ctx,f.options);
  assert.equal(f.submitted,1);
  assert.deepEqual(f.calls.find(call=>call[0]==='fill'),['fill','#ContentPlaceHolder1_txtDLNumber','12345678']);
  assert.ok(f.calls.some(call=>call[0]==='navigate'&&call[2].url?.includes('/DrvSameRes/Page1.aspx')));
  const ready=f.calls.findIndex(call=>call[0]==='ready');
  assert.ok(f.calls.indexOf('fetchPdf')<ready);
  const activate=f.calls.findIndex(call=>call[0]==='navigate'&&call[1]===20);
  assert.ok(activate>ready);assert.deepEqual(f.calls[activate][2],{active:true});
  assert.deepEqual(f.calls.filter(call=>call[0]==='reveal-result'),[['reveal-result',1,{state:'normal'}],['reveal-result',1,{focused:true}]]);
});
test('replacement after same-address history commit prevents stale result focus',async()=>{
  const f=fixture();f.ctx.resultReady=async()=>f.ctx.run.cancel();
  await assert.rejects(backgroundSearch('address','12345678',f.ctx,f.options),{name:'AbortError'});
  assert.equal(f.calls.some(call=>call[0]==='navigate'&&call[1]===20),false);
  assert.equal(f.calls.some(call=>call[0]==='reveal-result'),false);
});
test('ignored minimized creation is corrected once before opening any DMV page',async()=>{
  const f=fixture({ignoredCreation:true});await backgroundSearch('license','12345678',f.ctx,f.options);
  const updates=f.calls.filter(call=>call[0]==='initialize-window');assert.equal(updates.length,1);
  assert.equal(updates[0][1],2);
  const correction=f.calls.indexOf(updates[0]),navigation=f.calls.findIndex(call=>call[0]==='navigate');
  assert.ok(correction<navigation);assert.equal(f.submitted,1);
  assert.equal(f.calls.filter(call=>call[0]==='get-window'&&call[1]===2).length,2);
});
test('failed minimization stops before DMV navigation and closes the owned blank tab',async()=>{
  const f=fixture({ignoredCreation:true,minimizeFails:true});
  await assert.rejects(backgroundSearch('license','12345678',f.ctx,f.options),/No DMV page was opened/);
  assert.equal(f.calls.some(call=>call[0]==='navigate'),false);assert.equal(f.submitted,0);
  assert.deepEqual(f.calls.filter(call=>call[0]==='remove'),[['remove',9]]);
  assert.equal(f.calls.some(call=>call[0]==='publish'),false);
});
test('manually restoring the helper during navigation never triggers another minimize',async()=>{
  const f=fixture({ignoredCreation:true,manualRestore:true});await backgroundSearch('license','12345678',f.ctx,f.options);
  assert.equal(f.helperState,'normal');assert.equal(f.submitted,1);
  assert.equal(f.calls.filter(call=>call[0]==='initialize-window').length,1);
});
test('Stop while initial minimization is pending prevents any DMV page from opening',async()=>{
  const f=fixture({ignoredCreation:true}),gate=Promise.withResolvers(),started=Promise.withResolvers();
  f.api.windows.update=async()=>{started.resolve();return gate.promise;};
  const task=backgroundSearch('license','12345678',f.ctx,f.options);
  await started.promise;f.ctx.run.cancel();await assert.rejects(task,{name:'AbortError'});
  gate.resolve({id:2,state:'minimized'});
  assert.equal(f.calls.some(call=>call[0]==='navigate'),false);assert.equal(f.submitted,0);
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
