import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LIVE,DEMO,environmentApi,reportEnvironment} from '../extension/environment.js';
import {attachmentUrl,isPdf,isPortal,loginSucceeded,isPortalErrorPage} from '../extension/core.js';
import {pdfDarkRule,darkResultSource} from '../extension/pdf-routing.js';
import {pageOperation} from '../extension/page.js';
test('local demo recognition is explicit and cannot loosen default live URL boundaries',()=>{
  assert.equal(attachmentUrl(DEMO.pdf),null);assert.equal(isPortal(DEMO.login),false);
  assert.equal(attachmentUrl(DEMO.pdf,0,DEMO),DEMO.pdf);assert.equal(isPdf(LIVE.pdf,DEMO),false);assert.equal(isPortal(LIVE.login,DEMO),false);
  assert.equal(loginSucceeded(DEMO.member+'Disclaimer.aspx',DEMO),true);assert.equal(loginSucceeded(DEMO.login,DEMO),false);
  assert.equal(isPortalErrorPage(DEMO.member+'ErrorPage.aspx',DEMO),true);
  for(const url of [DEMO.pdf.replace(':4173',':4174'),DEMO.pdf.replace('127.0.0.1','localhost'),DEMO.pdf.replace('127.0.0.1','127.0.0.1.example.org'),DEMO.pdf.replace('http:','https:')])assert.equal(attachmentUrl(url,0,DEMO),null);
});
test('demo storage namespaces private state and old facades keep writing to their original environment',async()=>{
  const values={credentials:{user:'live'},history:[{value:'LIVE'}],queue:{index:1},vaultKey:'private-key',unlockedVault:'private-vault',alertsEnabled:true,'demo:history':[{value:'DEMO'}]};
  const api={storage:{session:{get:async keys=>keys==null?structuredClone(values):Object.fromEntries(keys.map(key=>[key,structuredClone(values[key])])),set:async v=>Object.assign(values,structuredClone(v)),remove:async keys=>keys.forEach(key=>delete values[key])}}};
  const demo=environmentApi(api,DEMO),live=environmentApi(api,LIVE);
  assert.equal(live,api);assert.deepEqual((await demo.storage.session.get(['history','credentials','alertsEnabled'])),{history:[{value:'DEMO'}],credentials:undefined,alertsEnabled:true});
  const all=await demo.storage.session.get(null);assert.equal(all.credentials,undefined);assert.equal(all.vaultKey,undefined);assert.equal(all.unlockedVault,undefined);
  await demo.storage.session.set({queue:{index:2},'pdf:9':{text:'DEMO'},lastQuery:17});
  assert.equal(values.queue.index,1);assert.equal(values['demo:queue'].index,2);assert.equal(values['pdf:9'],undefined);assert.equal(values['demo:pdf:9'].text,'DEMO');
  await demo.storage.session.remove(['history','queue']);assert.deepEqual(values.history,[{value:'LIVE'}]);assert.equal(values['demo:history'],undefined);
});
test('dark routing and report classification retain the exact selected origin and endpoint',()=>{
  const reader='chrome-extension://'+'a'.repeat(32)+'/reader.html',rule=pdfDarkRule(reader,DEMO),pattern=new RegExp(rule.condition.regexFilter,'i');
  assert.equal(pattern.test(DEMO.pdf+'?case=DRIVER001'),true);assert.equal(pattern.test(LIVE.pdf),false);assert.equal(pattern.test(DEMO.pdf.replace(':4173',':4174')),false);
  const url=reader+'?pdf=1#'+DEMO.pdf;assert.equal(darkResultSource(url,reader),null);assert.equal(darkResultSource(url,reader,DEMO),DEMO.pdf);assert.equal(reportEnvironment(url),DEMO);
  assert.equal(reportEnvironment('https://example.test/report.pdf'),undefined);
});
test('serialized page operations reject cross-environment pages and live credentials on loopback',()=>{
  globalThis.location={origin:DEMO.origin,pathname:'/SCTRNS/Member/logon.aspx'};
  assert.throws(()=>pageOperation('fill',{selector:'input',value:'live'}),/different search environment/);
  assert.throws(()=>pageOperation('extensionLogin',{demo:true,credentials:{user:'live-user',password:'live-secret'}}),/fixed demonstration credentials/);
  globalThis.location={origin:LIVE.origin,pathname:'/SCTRNS/Member/logon.aspx'};
  assert.throws(()=>pageOperation('extensionLogin',{demo:true,credentials:{user:'demo',password:'demo'}}),/different search environment/);
  delete globalThis.location;
});
test('demo access is optional and narrow while production host access stays unchanged',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url),'utf8'));
  assert.deepEqual(manifest.host_permissions,['https://www.scdmvonline.com/*']);assert.deepEqual(manifest.optional_host_permissions,['http://127.0.0.1/*']);
});
