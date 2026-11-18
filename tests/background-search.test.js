import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {backgroundSearch,backgroundMethod,resultWindow} from '../extension/background-search.js';
import {SearchRun} from '../extension/run.js';
import {LOGIN,MEMBER,PDF_URL} from '../extension/core.js';
import {AudioAlerts} from '../extension/audio-alerts.js';

function fixture({failure=false,moved=false,method='window'}={}) {
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
    scripting:{executeScript:async({args:[op,args]})=>[{result:operation(op,args)}]},
    runtime:{sendMessage:async message=>{
      assert.equal(message.target,'query-host');
      if(message.op==='init')return {ok:true,value:true};
      if(message.op==='state')return {ok:true,value:{url:tab.url,status:'complete'}};
      if(message.op==='navigate'){tab.url=message.args.url;return {ok:true,value:true};}
      return {ok:true,value:operation(message.args.op,message.args.args)};
    }}
  };
  globalThis.chrome=api;
  const ctx={run,status:()=>{},credentials:async()=>({user:'fixture',password:'fixture'}),beforeSubmit:async()=>calls.push('authorize'),resultReady:async result=>calls.push(['ready',result.tabId])};
  const options={method,api,sourceId:1,audio:{useQueryDocument:async action=>{calls.push('offscreen');return action();}},
    publish:async data=>{calls.push(['publish',data]);return {...data.report,tabId:20};}};
  return {calls,ctx,options,api,get submitted(){return submitted;}};
}

test('background methods require popup opt-in and only apply to plate/license/customer',()=>{
  for(const method of ['window','offscreen']) {
    const prefs={alertsEnabled:true,backgroundStatusSearch:true,backgroundSearchMethod:method};
    for(const kind of ['plate','license','customer'])assert.equal(backgroundMethod(kind,prefs),method);
    for(const kind of ['address','scutties','barcode','help'])assert.equal(backgroundMethod(kind,prefs),null);
    assert.equal(backgroundMethod('license',{...prefs,alertsEnabled:false}),null);
    assert.equal(backgroundMethod('license',{...prefs,backgroundStatusSearch:false}),null);
  }
});
for(const method of ['window','offscreen'])test(`${method} submits once, checks blacklist, captures bytes and publishes without window focus`,async()=>{
  const f=fixture({method});
  const result=await backgroundSearch('license','12345678',f.ctx,f.options);
  assert.equal(result.tabId,20);assert.equal(f.submitted,1);
  assert.equal(f.calls.filter(call=>call==='authorize').length,2);
  const publish=f.calls.find(call=>call[0]==='publish')[1];
  assert.equal(publish.bytes,'JVBERi1zeW50aGV0aWM=');assert.equal(publish.windowId,1);
  assert.ok(f.calls.indexOf('fetchPdf')<f.calls.findIndex(call=>call[0]==='publish'));
  if(method==='window') {
    assert.equal(f.calls.find(call=>call[0]==='window')[1].focused,false);
    assert.deepEqual(f.calls.filter(call=>call[0]==='remove'),[['remove',9]]);
  } else assert.equal(f.calls.some(call=>call[0]==='window'),false);
});
for(const method of ['window','offscreen'])test(`${method} failures do not submit through an alternate method`,async()=>{
  const f=fixture({method,failure:true});
  await assert.rejects(backgroundSearch('customer','12345678',f.ctx,f.options),/no retry/);
  assert.equal(f.submitted,1);assert.equal(f.calls.some(call=>call[0]==='publish'),false);
  assert.equal(f.calls.filter(call=>call==='offscreen').length,method==='offscreen'?1:0);
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
test('offscreen host binds operations to its iframe origin, job and current navigation',async()=>{
  const events={},posts=[],listeners=[],frame={contentWindow:{postMessage:(...args)=>posts.push(args)},addEventListener:(type,fn)=>events['frame-'+type]=fn};
  const origin='chrome-extension://'+'a'.repeat(32),runtime={id:'a'.repeat(32),getURL:path=>origin+'/'+path,connect:()=>({postMessage(){}}),onMessage:{addListener:fn=>listeners.push(fn)}};
  const sandbox={document:{getElementById:()=>frame},window:{addEventListener:(type,fn)=>events[type]=fn},chrome:{runtime},URL,crypto,setInterval:()=>0,setTimeout,clearTimeout,Map};
  vm.runInNewContext(readFileSync(new URL('../extension/offscreen-query.js',import.meta.url),'utf8'),sandbox);
  const sender={id:runtime.id,url:origin+'/background.js'};
  const request=(op,args={},job='job')=>new Promise(resolve=>listeners[0]({target:'query-host',op,args,job},sender,resolve));
  assert.equal(listeners[0]({target:'query-host'}, {...sender,url:LOGIN,tab:{id:8}},()=>{}),false);
  assert.equal((await request('init',{url:LOGIN})).ok,true);
  assert.equal((await request('state',{},'other')).ok,false);
  events['frame-load']();const token=posts.at(-1)[0].token;
  const message=data=>events.message({source:frame.contentWindow,origin:'https://www.scdmvonline.com',data});
  message({target:'scdmv-host',type:'ready',token:'stale',url:LOGIN});
  assert.equal((await request('state')).value.status,'loading');
  message({target:'scdmv-host',type:'ready',token,url:LOGIN});
  assert.equal((await request('state')).value.status,'complete');
  const operation=request('evaluate',{op:'state',args:{}});const command=posts.at(-1)[0];
  message({target:'scdmv-host',type:'reply',token,id:command.id,value:{present:true}});
  assert.equal((await operation).value.present,true);
  assert.equal((await request('navigate',{url:'https://other.test/'})).ok,false);
  const pending=request('evaluate',{op:'click',args:{}});
  message({target:'scdmv-host',type:'unloading',token});
  assert.match((await pending).error,/unloaded/);
  assert.equal((await request('state')).value.status,'loading');
});
test('background destination never creates/focuses a normal window',async()=>{
  const f=fixture();f.api.windows.getAll=async()=>[];
  await assert.rejects(resultWindow(f.api,null),/normal browser window/);
});
test('single offscreen document is leased until query finishes, including stop/audio requests',async()=>{
  let exists=false;const calls=[],gate=Promise.withResolvers();
  const api={tts:{stop(){}},offscreen:{hasDocument:async()=>exists,createDocument:async opts=>{assert.equal(exists,false);exists=true;calls.push(opts.url);},closeDocument:async()=>{exists=false;calls.push('close');}}};
  const audio=new AudioAlerts(api);
  const query=audio.useQueryDocument(async()=>{calls.push('query');await gate.promise;});
  await new Promise(resolve=>setTimeout(resolve,10));audio.stop();
  assert.equal(exists,true);assert.deepEqual(calls,['offscreen-query.html','query']);
  gate.resolve();await query;await audio.offscreenTask;
  assert.equal(exists,false);assert.deepEqual(calls,['offscreen-query.html','query','close']);
});
test('MAIN iframe bridge rejects other parents, origins and expired tokens',async()=>{
  const callbacks={},sent=[],parent={},window={addEventListener:(name,fn)=>callbacks[name]=fn};
  parent.postMessage=(message,origin)=>sent.push({message,origin});
  const sandbox={window,top:{},parent,location:{href:LOGIN},document:{readyState:'complete'},URL};
  vm.runInNewContext(readFileSync(new URL('../extension/offscreen-main.js',import.meta.url),'utf8'),sandbox);
  const dispatch=(source,origin,data)=>callbacks.message({source,origin,data});
  const owner='chrome-extension://'+'a'.repeat(32);
  await dispatch(window,'https://www.scdmvonline.com',{target:'scdmv-bridge-origin',origin:owner});
  assert.equal(sent.pop().message.type,'available');
  await dispatch({},owner,{target:'scdmv-query',type:'init',token:'wrong'});
  await dispatch(parent,'https://other.test',{target:'scdmv-query',type:'init',token:'wrong'});
  assert.equal(sent.length,0);
  await dispatch(parent,owner,{target:'scdmv-query',type:'init',token:'current'});assert.equal(sent.length,1);
  await dispatch(parent,owner,{target:'scdmv-query',type:'operation',token:'old',op:'invalid'});assert.equal(sent.length,1);
  await dispatch(parent,owner,{target:'scdmv-query',type:'operation',token:'current',id:4,op:'invalid'});
  assert.match(sent.at(-1).message.error,/Unknown page operation/);
});
