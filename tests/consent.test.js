/** Acceptance is explicit, document-bound, local and independent of future update policy. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptance,acceptEula,requireAcceptance,openEula} from '../extension/consent.js';
import {EULA_DIGEST,EULA_TEXT} from '../extension/eula-content.js';
import {configureDmvTheme,initDmvTheme} from '../extension/dmv-theme-settings.js';
function fixture(){
  const local={},tabs=[],calls=[],id='a'.repeat(32),url=path=>'chrome-extension://'+id+'/'+path;
  return {local,tabs,calls,api:{runtime:{id,getURL:url},storage:{local:{get:async key=>({[key]:local[key]}),set:async values=>Object.assign(local,values)}},tabs:{query:async()=>tabs,create:async options=>{const tab={id:1,windowId:1,...options};tabs.push(tab);calls.push('created');return tab;},update:async(id,options)=>calls.push({id,...options})},windows:{get:async()=>({state:'normal'}),update:async()=>{}}}};
}
test('missing or malformed acceptance never authorizes features',async()=>{
  const f=fixture();for(const value of [undefined,true,{accepted:true},{accepted:true,acceptedAt:0},{accepted:false,acceptedAt:1}]){f.local.eulaAcceptance=value;assert.equal(await acceptance(f.api),null);}
  await assert.rejects(requireAcceptance(f.api),/Review and accept/);assert.equal(f.tabs[0].url,f.api.runtime.getURL('eula.html'));
});
test('only an affirmative acknowledgment from the displayed EULA can save consent',async()=>{
  const f=fixture(),sender={id:f.api.runtime.id,url:f.api.runtime.getURL('eula.html'),frameId:0},message={agreed:true,digest:EULA_DIGEST};
  for(const invalid of [{...sender,url:f.api.runtime.getURL('popup.html')},{...sender,id:'foreign'},{...sender,frameId:1}])await assert.rejects(acceptEula(message,invalid,f.api),/Accept the displayed EULA/);
  await assert.rejects(acceptEula({...message,agreed:false},sender,f.api));await assert.rejects(acceptEula({...message,digest:'wrong'},sender,f.api));assert.equal(f.local.eulaAcceptance,undefined);
  const saved=await acceptEula(message,sender,f.api);assert.equal(saved.accepted,true);assert.equal(saved.documentDigest,EULA_DIGEST);assert.ok(saved.acceptedAt>0);
  assert.deepEqual(await acceptance(f.api),saved);await requireAcceptance(f.api);assert.equal(f.tabs.length,0);
});
test('repeat review reuses its tab and acceptance survives session loss without version-based reprompting',async()=>{
  const f=fixture();await Promise.all([openEula(f.api),openEula(f.api)]);assert.equal(f.tabs.length,1);await openEula(f.api);assert.equal(f.tabs.length,1);
  f.local.eulaAcceptance={accepted:true,acceptedAt:1,documentDigest:'an-earlier-accepted-document'};
  assert.equal((await acceptance(f.api)).accepted,true);await requireAcceptance(f.api);
  assert.ok(EULA_TEXT.includes('## 10. Limitation of liability'));assert.ok(EULA_TEXT.includes('Misuse and failure to verify'));assert.ok(!EULA_TEXT.includes('## Publisher decisions'));
});
test('DMV appearance registration and content-script initialization remain disabled before acceptance',async()=>{
  const previous=globalThis.chrome,f=fixture();let scripts=[{id:'scdmv-native-dark-start'}],inserted=0,removed=0;
  f.api.scripting={getRegisteredContentScripts:async()=>scripts,unregisterContentScripts:async()=>{scripts=[];},registerContentScripts:async values=>{scripts=values;},updateContentScripts:async values=>{scripts=values;},insertCSS:async()=>{inserted++;},removeCSS:async()=>{removed++;}};
  globalThis.chrome=f.api;
  try{
    assert.equal(await configureDmvTheme(),false);assert.equal(scripts.length,0);
    assert.deepEqual(await initDmvTheme({tab:{id:1},frameId:0}),{enabled:false});assert.equal(inserted,0);assert.equal(removed,1);
    f.local.eulaAcceptance={accepted:true,acceptedAt:1};assert.equal(await configureDmvTheme(),true);assert.equal(scripts.length,1);
    assert.deepEqual(await initDmvTheme({tab:{id:1},frameId:0}),{enabled:true});assert.equal(inserted,1);
  }finally{globalThis.chrome=previous;}
});
