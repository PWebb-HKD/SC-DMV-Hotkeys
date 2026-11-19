import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LIVE,demoEnvironment,reportUrlFor,environmentApi,reportEnvironment} from '../extension/environment.js';
import {attachmentUrl,isPdf,isPortal,loginSucceeded,isPortalErrorPage} from '../extension/core.js';
import {pdfDarkRule,darkResultSource} from '../extension/pdf-routing.js';
import {pageOperation} from '../extension/page.js';
const DEMO=demoEnvironment('chrome-extension://'+'a'.repeat(32)+'/'),PDF=reportUrlFor(DEMO,'DRIVER001');
test('local demo recognition is explicit and cannot loosen default live URL boundaries',()=>{
  assert.equal(attachmentUrl(PDF),null);assert.equal(isPortal(DEMO.login),false);
  assert.equal(attachmentUrl(PDF,0,DEMO),PDF);assert.equal(isPdf(LIVE.pdf,DEMO),false);assert.equal(isPortal(LIVE.login,DEMO),false);
  assert.equal(loginSucceeded(DEMO.member+'Disclaimer.html',DEMO),true);assert.equal(loginSucceeded(DEMO.login,DEMO),false);
  assert.equal(isPortalErrorPage(DEMO.member+'ErrorPage.html',DEMO),true);
  for(const url of [PDF.replace('a'.repeat(32),'b'.repeat(32)),PDF.replace('DRIVER001','PRIVATE'),PDF.replace('demo/reports/','private/'),PDF.replace('chrome-extension:','https:')])assert.equal(attachmentUrl(url,0,DEMO),null);
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
test('bundled report recognition binds the owning extension ID and generated report allowlist',()=>{
  const reader='chrome-extension://'+'a'.repeat(32)+'/reader.html',url=reader+'?pdf=1#'+PDF;
  assert.equal(darkResultSource(url,reader),null);assert.equal(darkResultSource(url,reader,DEMO),PDF);assert.equal(reportEnvironment(url,0,DEMO).root,DEMO.root);
  assert.equal(reportEnvironment('https://example.test/report.pdf',0,DEMO),undefined);
});
test('serialized page operations reject cross-environment pages and non-demo credentials',()=>{
  globalThis.location={origin:'null',href:DEMO.login,pathname:new URL(DEMO.login).pathname};
  globalThis.chrome={runtime:{getURL:path=>'chrome-extension://'+'a'.repeat(32)+'/'+path}};
  assert.throws(()=>pageOperation('fill',{selector:'input',value:'live'}),/different search environment/);
  assert.throws(()=>pageOperation('extensionLogin',{demo:true,demoRoot:DEMO.root,credentials:{user:'live-user',password:'live-secret'}}),/fixed demonstration credentials/);
  globalThis.location={origin:LIVE.origin,href:LIVE.login,pathname:'/SCTRNS/Member/logon.aspx'};
  assert.throws(()=>pageOperation('extensionLogin',{demo:true,credentials:{user:'demo',password:'demo'}}),/different search environment/);
  delete globalThis.location;delete globalThis.chrome;
});
test('packaged demo requires no optional hosts and production host access stays unchanged',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url),'utf8'));
  assert.deepEqual(manifest.host_permissions,['https://www.scdmvonline.com/*']);assert.deepEqual(manifest.optional_host_permissions||[],[]);
});
