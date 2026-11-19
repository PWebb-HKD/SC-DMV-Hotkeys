/** End-to-end demo routing through the real worker, automation, PDF.js and controllers.
 * Chrome extension APIs are explicit substitutes; no managed install policy is bypassed. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {demoExtension} from './helpers/demo-extension.mjs';
import {LIVE} from '../extension/environment.js';
const f=await demoExtension(),DEMO=f.DEMO,screenshots=fileURLToPath(new URL('../test-results/demo-extension/',import.meta.url));await mkdir(screenshots,{recursive:true});
let passed=0;
const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
const wait=async fn=>{const end=Date.now()+20000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,25));}throw new Error('Demo integration timed out: '+JSON.stringify({status:f.session['demo:status'],panels:Object.values(f.session).filter(v=>v?.type).map(v=>({type:v.type,message:v.message})),operations:f.operations.slice(-10).map(o=>({op:o.op,url:o.url,selector:o.args.selector})),errors:f.errors}));};
const alert=async()=>{const record=await wait(()=>f.panel('record-alert'));await record.page.locator('h2.record-status-title').waitFor();return record;};
const input=async(command,value)=>{await f.send({type:'run',command});const record=await wait(()=>f.panel('input'));await record.page.locator('#value').fill(value);await record.page.locator('#submit').click();};
const number=async(command,value)=>{const previous=f.session['demo:history']?.[0]?.id;await input(command,value);await wait(()=>f.session['demo:history']?.[0]?.id!==previous&&f.session['demo:history']?.[0]?.value===value);return alert();};
const report=async(pattern)=>wait(()=>[...f.pages.values()].filter(r=>(r.tab.url.includes('reader.html')&&r.tab.url.includes('#'+DEMO.origin)||r.tab.url.startsWith(DEMO.pdf))&&f.session['demo:pdf:'+r.tab.id]?.text&&(!pattern||pattern.test(f.session['demo:pdf:'+r.tab.id].text))).sort((a,b)=>(f.session['demo:pdfCreated']?.[b.tab.id]||0)-(f.session['demo:pdfCreated']?.[a.tab.id]||0))[0]);
try{
  const live=structuredClone({history:f.session.history,queue:f.session.queue,credentials:f.session.credentials,vault:f.local.vault});
  await check('Demo Mode defaults off and opens the packaged practice environment without host permission',async()=>{
    await f.page.locator('#settingsTab').click();assert.equal(await f.page.locator('#demoModeToggle').isChecked(),false);
    await f.page.locator('#demoModeToggle').click();await f.page.locator('#demoBanner').waitFor();assert.equal((await f.state()).demoMode,true);assert.equal((await f.state()).vault,undefined);
    await f.send({type:'alerts',enabled:true});await f.send({type:'driver-identity-settings',enabled:true});await f.send({type:'pdf-display-settings',enabled:false});
    await f.page.screenshot({path:join(screenshots,'settings.png'),fullPage:true});
  });
  await check('real quick-input navigation signs in only with demo/demo and captures a driver photo/status',async()=>{
    const at=f.storageReads.length;const status=await number('license','100000101');assert.equal(await status.page.locator('h2.record-status-title').textContent(),'VALID LICENSE');await status.page.locator('.record-driver-photo').waitFor();assert.equal(await status.page.locator('#extensionDemoBanner').textContent(),'DEMO MODE — SYNTHETIC DATA');
    const attempts=f.operations.filter(o=>o.op==='extensionLogin');assert.ok(attempts.length);for(const attempt of attempts){assert.ok(attempt.url.startsWith(DEMO.origin));assert.deepEqual(attempt.args.credentials,{user:'demo',password:'demo'});}
    assert.equal(f.storageReads.slice(at).some(r=>r.scope==='local'&&r.keys.includes('vault')),false);
    await status.page.screenshot({path:join(screenshots,'driver-alert.png'),fullPage:true});assert.ok(f.session['demo:pdfCreated']);assert.equal(f.session.history[0].id,'live-old');
  });
  await check('an existing demo page reconnects on demand after the worker loses its port map',async()=>{
    f.disconnectDemoPorts();const status=await number('license','100000102');
    assert.equal(await status.page.locator('h2.record-status-title').textContent(),'LICENSE EXPIRED');
  });
  await check('a late settings snapshot cannot undo a newer status-alert toggle',async()=>{
    f.holdNextState();await f.chrome.storage.session.set({'demo:status':'Demo settings race fixture'});await wait(()=>f.hasHeldState());
    const delivered=await f.page.evaluate(()=>window.fixtureStateDelivered||0);await f.send({type:'alerts',enabled:false});
    await wait(async()=>!await f.page.locator('#alertsToggle').isChecked());f.releaseState();await wait(async()=>await f.page.evaluate(()=>window.fixtureStateDelivered||0)>delivered);
    assert.equal(await f.page.locator('#alertsToggle').isChecked(),false);assert.equal(await f.page.locator('#statusAlertSettings').isVisible(),false);
    await f.send({type:'alerts',enabled:true});await wait(async()=>await f.page.locator('#alertsToggle').isChecked());
  });
  await check('plate owner follow-up submits the saved customer number through the normal worker path',async()=>{
    const status=await number('plate','DEMO005');await status.page.locator('.record-owner-search').nth(1).click();await wait(()=>f.session['demo:history'][0].kind==='customer'&&f.session['demo:history'][0].value==='10000002');const next=await alert();assert.equal(await next.page.locator('.record-driver-name').textContent(),'EXAMPLE, MORGAN');
  });
  await check('barcode command uses the selected immutable demo PDF and displays its demo label',async()=>{
    const source=await report();await f.activate(source.tab);await f.send({type:'run',command:'barcode'});const barcode=await wait(()=>[...f.pages.values()].find(r=>r.tab.url.includes('barcode.html')&&f.session['panel:'+new URL(r.tab.url).searchParams.get('id')]?.type==='barcode'));
    await barcode.page.locator('#scanArea').waitFor();assert.match(await barcode.page.locator('#extensionDemoBanner').textContent(),/SYNTHETIC/);assert.ok(await barcode.page.locator('#barcode').evaluate(c=>c.width>400));
  });
  await check('same-residence PDF and queue follow-ups retain production collection and previous/next behavior',async()=>{
    await number('license','100000101');let source=await report();await f.activate(source.tab);await f.send({type:'run',command:'address'});await wait(()=>f.session['demo:history'][0].kind==='address');
    source=await report(/Customers at Same Residence/);await f.activate(source.tab);await f.send({type:'run',command:'owners'});await wait(()=>f.session['demo:queue']?.index===2);assert.deepEqual(f.session['demo:queue'].values,['10000001','10000002','10000011']);
    await f.send({type:'run',command:'next'});await wait(()=>f.session['demo:queue'].index===3);assert.equal(f.session['demo:history'][0].value,'10000011');await f.send({type:'run',command:'previous'});await wait(()=>f.session['demo:queue'].index===2);assert.equal(f.session['demo:history'][0].value,'10000002');
  });
  await check('SCUTTIES uses the extracted identity and clicks Search rather than the adjacent saved-citations action',async()=>{
    await number('license','100000101');const source=await report();await f.activate(source.tab);await f.send({type:'run',command:'scutties'});await wait(()=>f.session['demo:history'][0].kind==='scutties');
    const scutties=await wait(()=>[...f.pages.values()].find(r=>r.tab.url.startsWith(DEMO.member+'Transactions/SCUTTIES/Search.html')));await scutties.page.locator('#scutties-rows tr').nth(2).waitFor();assert.equal(await scutties.page.locator('#scutties-last').inputValue(),'EXAMPLE');
    assert.ok(f.operations.some(o=>o.op==='click'&&o.args.selector==='#home button[ng-click="searchCitation()"]'));
  });
  await check('demo blacklist blocks before navigation without unlocking or changing the live vault',async()=>{
    await Promise.all(['DEMO003','DEMO004'].map(value=>f.send({type:'blacklist-add',kind:'plate',value})));assert.equal((await f.state()).blacklist.entries.length,2);
    const before=f.operations.length;await input('plate','DEMO003');const blocked=await alert();assert.match(await blocked.page.locator('h2.record-status-title').textContent(),/blacklisted/);assert.equal(f.operations.length,before);
    assert.equal((await f.state()).blacklist.demo,true);assert.deepEqual(f.local.vault,live.vault);await f.send({type:'blacklist-remove',kind:'plate',value:'DEMO003',confirmed:true});
    await f.send({type:'blacklist-remove',kind:'plate',value:'DEMO004',confirmed:true});await assert.rejects(f.send({type:'clear-saved-user-info',confirmed:true}),/Switch off Demo Mode/);
  });
  await check('a simulated technical timeout preserves the extension queue and history until a normal retry succeeds',async()=>{
    const portal=f.pages.get(f.session['demo:portalId']);await portal.page.goto(DEMO.member+'Transactions/DrvRec/Page1.html');await portal.page.locator('.demo-test-controls summary').click();await portal.page.locator('#demo-scenario').selectOption('timeout');
    const queue=structuredClone(f.session['demo:queue']),history=structuredClone(f.session['demo:history']);await f.send({type:'run',command:'next'});const notice=await wait(()=>f.panel('notice'));await notice.page.locator('#message').filter({hasText:'timed out'}).waitFor();assert.deepEqual(f.session['demo:queue'],queue);assert.deepEqual(f.session['demo:history'],history);
    await f.send({type:'run',command:'next'});await wait(()=>f.session['demo:queue'].index===queue.index+1);await alert();
  });
  await check('background transport reuses its own results tab and captures no-photo alerts without focusing it',async()=>{
    await f.send({type:'background-search-settings',enabled:true});const normal=await f.chrome.tabs.create({url:DEMO.root+'index.html',active:true});await f.activate(normal);
    let status=await number('license','100000117');assert.equal(await status.page.locator('.record-driver-photo').count(),0);assert.match(await status.page.locator('.record-driver-identity').textContent(),/No photo available/);
    const first=await report(),firstId=first.tab.id,firstDocument=first.tab.documentId;assert.equal(first.tab.active,false);assert.match(first.tab.url,/query=1/);status=await number('license','100000101');await status.page.locator('.record-driver-photo').waitFor();const second=await report();assert.equal(second.tab.id,firstId);assert.notEqual(second.tab.documentId,firstDocument);
  });
  await check('switching during pending results cancels the old generation and preserves both histories without cross replay',async()=>{
    await f.send({type:'background-search-settings',enabled:false});const portal=await wait(()=>[...f.pages.values()].find(r=>r.tab.url.startsWith(DEMO.member)&&!r.tab.url.includes('/SCUTTIES/')));
    await portal.page.evaluate(()=>sessionStorage.setItem('scdmv-demo-scenario','slow'));await input('license','100000102');await wait(()=>[...f.pages.values()].find(r=>r.tab.url.includes('scenario=slow')));
    const delayed=await wait(()=>[...f.pages.values()].find(r=>r.tab.url.includes('scenario=slow'))),history=structuredClone(f.session['demo:history']);await f.send({type:'demo-mode',enabled:false});assert.equal((await f.state()).demoMode,false);assert.deepEqual(f.session.history,live.history);assert.deepEqual(f.session.queue,live.queue);assert.deepEqual(f.session.credentials,live.credentials);assert.deepEqual(f.local.vault,live.vault);
    await assert.rejects(f.send({type:'rerun',search:{id:history[0].id}}),/no longer/);
    await f.send({type:'demo-mode',enabled:true});await delayed.page.locator('#result-card:not([hidden])').waitFor();assert.deepEqual((await f.state()).history,history);await assert.rejects(f.send({type:'rerun',search:{id:'live-old'}}),/no longer/);
  });
  await check('focused live reports cannot supply demo follow-ups and all actual requests stay local or in the fixture',async()=>{
    const record=await f.chrome.tabs.create({url:'about:blank',active:true});const current=f.pages.get(record.id);current.tab.url=LIVE.pdf;await f.activate(current.tab);await f.send({type:'run',command:'barcode'});const notice=await wait(()=>f.panel('notice'));await notice.page.locator('#message').filter({hasText:'different environment'}).waitFor();
    assert.equal(f.requests.some(url=>url.startsWith(LIVE.origin)),false);assert.ok(f.requests.filter(url=>/^https?:/.test(url)).every(url=>url.startsWith(DEMO.origin)||url.startsWith(f.base)));assert.deepEqual(f.errors,[]);
  });
  await check('a reader held across a mode switch cannot publish its text, identity or alert into live state',async()=>{
    await f.send({type:'background-search-settings',enabled:true});f.holdNextReader();const previous=f.session['demo:history'][0].id;
    await input('license','100000101');await wait(()=>f.hasHeldReader());await wait(()=>f.session['demo:history'][0].id!==previous);
    await f.send({type:'demo-mode',enabled:false});f.releaseReader();await wait(()=>!f.panel('record-alert'));assert.deepEqual(f.session.history,live.history);assert.deepEqual(f.session.credentials,live.credentials);assert.deepEqual(f.local.vault,live.vault);
    await f.send({type:'demo-mode',enabled:true});
  });
  await check('no localhost or live service request is needed and no demo content script is registered',async()=>{
    assert.equal((await f.chrome.scripting.getRegisteredContentScripts()).some(s=>s.id==='demo-background-report'),false);
    assert.ok(f.requests.filter(url=>/^https?:/.test(url)).every(url=>url.startsWith(f.base)));assert.deepEqual(f.errors,[]);
  });
  console.log(`${passed} extension/demo integration browser checks passed with explicit Chrome API substitutes.`);
}finally{await f.close();}
