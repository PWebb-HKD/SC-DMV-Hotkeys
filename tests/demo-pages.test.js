/** A port must own the current packaged top-level document, including same-URL reloads. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectDemoPage,demoOperation} from '../extension/demo-pages.js';
import {demoEnvironment} from '../extension/environment.js';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);}});
test('packaged bridge rejects foreign senders and cannot target a replaced same-URL document',async()=>{
  const previous=globalThis.chrome,root='chrome-extension://'+'a'.repeat(32)+'/',url=root+'demo/SCTRNS/Member/logon.html';
  let documentId='old-document',sent=0;
  globalThis.chrome={runtime:{id:'a'.repeat(32),getURL:path=>root+path},tabs:{get:async()=>({id:875,url})},webNavigation:{getFrame:async()=>({documentId})}};
  const make=sender=>{
    const port={name:'demo-page',sender,onMessage:event(),onDisconnect:event(),disconnected:false,
      disconnect(){this.disconnected=true;for(const fn of this.onDisconnect.listeners)fn();},
      postMessage(message){sent++;for(const fn of this.onMessage.listeners)fn({id:message.id,ok:true,value:'owned response'});}};
    return port;
  };
  const sender={id:'a'.repeat(32),tab:{id:875},frameId:0,url,documentId};
  try{
    for(const invalid of [{...sender,id:'b'.repeat(32)},{...sender,frameId:1},{...sender,url:root+'popup.html'},{...sender,documentId:undefined}]){
      const port=make(invalid);assert.equal(connectDemoPage(port),true);assert.equal(port.disconnected,true);
    }
    const port=make(sender);connectDemoPage(port);
    assert.equal(await demoOperation(875,'state'), 'owned response');assert.equal(sent,1);
    documentId='replacement-document';let checks=0;
    const run={environment:demoEnvironment(),check(){if(++checks>2)throw new DOMException('Stopped stale document','AbortError');}};
    await assert.rejects(demoOperation(875,'click',{},run),/Stopped stale document/);assert.equal(sent,1);
    const next=make({...sender,documentId});connectDemoPage(next);assert.equal(port.disconnected,true);
    assert.equal(await demoOperation(875,'state'),'owned response');assert.equal(sent,2);
    await assert.rejects(demoOperation(875,'arbitraryScript'),/Unsupported demo operation/);next.disconnect();
  }finally{globalThis.chrome=previous;}
});
