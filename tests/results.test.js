// Results-tab selection across creation, navigation, wrappers, and reuse.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {watchResults} from '../extension/results.js';
import {attachmentUrl, PDF_URL, MEMBER} from '../extension/core.js';
import {SearchRun} from '../extension/run.js';
function event() { const listeners=new Set();return {addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),emit:(...args)=>{for(const fn of listeners)fn(...args);},get count(){return listeners.size;}}; }
function fixture() {
  const tabs=new Map([[1,{id:1,url:`${MEMBER}Transactions/DrvRec/Page2.aspx`,status:'complete'}],[2,{id:2,url:PDF_URL,status:'complete',openerTabId:1}]]);
  const onCreated=event(),onUpdated=event();
  globalThis.chrome={tabs:{query:async()=>[...tabs.values()].map(t=>({...t})),onCreated,onUpdated}};
  return {tabs,onCreated,onUpdated};
}
test('PDF source recognition accepts viewer wrappers and rejects arbitrary websites',()=>{
  assert.equal(attachmentUrl(PDF_URL+'#page=1'),PDF_URL);
  assert.equal(attachmentUrl(`chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html?src=${encodeURIComponent(PDF_URL)}`),PDF_URL);
  assert.equal(attachmentUrl(`https://unrelated.test/?src=${encodeURIComponent(PDF_URL)}`),null);
});
test('results are recognized from pendingUrl while the PDF viewer remains loading',async()=>{
  const {tabs,onCreated}=fixture(),watcher=await watchResults(1);watcher.arm();
  assert.equal(await watcher.find(),undefined);
  const tab={id:3,url:'about:blank',pendingUrl:PDF_URL,status:'loading',openerTabId:1};tabs.set(3,tab);onCreated.emit(tab);
  assert.equal((await watcher.find()).tab.id,3);watcher.dispose();assert.equal(onCreated.count,0);
});
test('a previously existing named PDF tab can be reused without a new tab ID',async()=>{
  const {tabs,onUpdated}=fixture(),watcher=await watchResults(1);watcher.arm();
  const reused=tabs.get(2);reused.status='loading';onUpdated.emit(2,{status:'loading'},reused);reused.status='complete';
  const result=await watcher.find();assert.equal(result.tab.id,2);assert.equal(result.reused,true);
  watcher.dispose();assert.equal(onUpdated.count,0);
});
test('same-tab PDFs and built-in viewer URLs are matched without host-filtered queries',async()=>{
  const {tabs,onUpdated}=fixture(),watcher=await watchResults(1);watcher.arm();
  const tab=tabs.get(1);tab.url=`chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html?src=${encodeURIComponent(PDF_URL)}`;tab.status='loading';
  onUpdated.emit(1,{url:tab.url,status:'loading'},tab);
  assert.equal((await watcher.find()).tab.id,1);watcher.dispose();
});
test('an unchanged old PDF or a new PDF opened by another portal is not selected',async()=>{
  const {tabs,onCreated}=fixture(),watcher=await watchResults(1);watcher.arm();
  tabs.set(4,{id:4,url:PDF_URL,status:'complete',openerTabId:999});onCreated.emit(tabs.get(4));
  assert.equal(await watcher.find(),undefined);watcher.dispose();
});
test('cancelled results watchers stop immediately',async()=>{
  fixture();const run=new SearchRun(),watcher=await watchResults(1,{run});watcher.arm();run.cancel();
  await assert.rejects(watcher.find(),{name:'AbortError'});watcher.dispose();
});
