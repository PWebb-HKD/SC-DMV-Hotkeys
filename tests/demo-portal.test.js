import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {startDemoServer} from '../demo/server.mjs';
import {DEMO_CASES,ADDRESS_CASES,ALL_DEMO_CASES,DEMO_PATHS,vehicleText,recordText} from '../demo/cases.mjs';
import {DRIVER_CASES,driverText} from '../demo/driver-cases.mjs';
import {plateStatus,licenseStatus} from '../extension/status-alerts.js';
import {reportBarcode} from '../extension/barcode-data.js';
import {isPortal,attachmentUrl,ownerNumbers,isResidenceReport} from '../extension/core.js';
const site=await startDemoServer();after(()=>site.close());
test('demo serves all five selector-compatible pages with visible synthetic labels and no captured scripts',async()=>{
  const selectors=['ContentPlaceHolder1_loginButton','ContentPlaceHolder1_submitButton','ContentPlaceHolder1_menuContainer','ContentPlaceHolder1_txtPlateNbr','downloadButton'];
  for(const [index,path] of Object.values(DEMO_PATHS).slice(0,5).entries()){
    const response=await fetch(site.url+path),html=await response.text();
    assert.equal(response.status,200);assert.match(html,/DEMONSTRATION — SYNTHETIC DATA/);assert.ok(html.includes(selectors[index]));
    assert.doesNotMatch(html,/__VIEWSTATE|__EVENTVALIDATION|WebResource\.axd|ScriptResource\.axd|shadowrootmode|internalid/);
    assert.doesNotMatch(html,/<(?:script|iframe|img)[^>]+(?:src|href)=["']https?:/i);
    assert.match(response.headers.get('content-security-policy'),/connect-src 'self'/);
  }
});
test('demo scenarios exercise production status, shared-address, lessee and barcode mapping rules',()=>{
  const titles=['TAG VALID','EXPIRED','TAG SUSPENDED','TAG VALID','TAG VALID','TAG VALID'];
  for(const [index,record] of DEMO_CASES.entries()){
    const text=vehicleText(record.plate),alert=plateStatus(text),code=reportBarcode(text);
    assert.equal(alert.sections[0].title,titles[index]);assert.equal(code.kind,'vehicle');assert.ok(code.payload.includes(record.plate));
    if(record.kind==='shared'){assert.equal(alert.owners.length,2);assert.equal(alert.owners[1].address,alert.owners[0].address);}
    if(record.kind==='lessee'){assert.equal(alert.owners[1].name,'DEMONSTRATION SERVICES LLC');assert.notEqual(alert.owners[0].address,alert.owners[1].address);}
    if(record.kind==='temporary')assert.doesNotMatch(code.payload,/DEMO004 2026/);
  }
});
test('every demo PDF is served inline with explicit synthetic labeling and no cache',async()=>{
  for(const record of DEMO_CASES){
    const response=await fetch(site.url+DEMO_PATHS.pdf+'?case='+record.plate),bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'no-store');
    assert.match(response.headers.get('content-disposition'),/^inline; filename="DEMONSTRATION-/);
    assert.ok(bytes.subarray(0,8).toString().startsWith('%PDF-'));assert.ok(bytes.includes(Buffer.from('DEMONSTRATION - SYNTHETIC DATA')));
    assert.ok(bytes.includes(Buffer.from('NOT A GOVERNMENT RECORD')));
  }
  assert.equal((await fetch(site.url+DEMO_PATHS.pdf+'?case=UNKNOWN')).status,404);
});
test('local server rejects credentials, hostile origins/hosts, and private or traversed file paths',async()=>{
  assert.equal((await fetch(site.url+DEMO_PATHS.login,{method:'POST',body:'user=never-retain-this&password=never-retain-this'})).status,405);
  for(const origin of ['https://example.test','null','not a URL'])assert.equal((await fetch(site.url+'/api/cases',{headers:{Origin:origin}})).status,403);
  assert.equal((await fetch(site.url+'/api/cases',{headers:{Origin:site.url}})).status,200);
  const badHost=await new Promise((accept,reject)=>{const req=request(site.url+'/api/cases',{headers:{Host:'example.test'}},res=>{res.resume();accept(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(badHost,403);
  for(const path of ['/extension/%2e%2e%2fpackage.json','/extension/extension.pem','/.git/config','/demo/../package.json','/api/proxy?url=https://www.scdmvonline.com'])assert.equal((await fetch(site.url+path)).status,404);
});
test('preview views reuse production controllers through an explicit local-only message adapter',async()=>{
  for(const view of ['panel','barcode']){
    assert.equal((await fetch(site.url+`/extension/${view}.html`)).status,400);
    const html=await (await fetch(site.url+`/extension/${view}.html?demo=DEMO001`)).text();
    assert.match(html,/Local preview of production rendering code/);assert.match(html,/\/demo\/preview-bridge\.js/);assert.ok(html.includes(`src="${view}.js"`));
  }
});
test('standalone demo does not weaken production origin recognition',()=>{
  assert.equal(isPortal(site.url+DEMO_PATHS.login),false);assert.equal(attachmentUrl(site.url+DEMO_PATHS.pdf),null);
});
test('shared driver/customer form and residence pages preserve supplied control IDs without captured tokens',async()=>{
  const controls=new Map([
    [DEMO_PATHS.driverSearch,['ContentPlaceHolder1_dlNumberTextBox','ContentPlaceHolder1_idNumberTextBox','ContentPlaceHolder1_nameSearchButton']],
    [DEMO_PATHS.addressSearch,['ContentPlaceHolder1_txtDLNumber']],
    [DEMO_PATHS.driverResult,['downloadButton','ContentPlaceHolder1_btnPrint','ContentPlaceHolder1_dlNbrBox_DisplayOnly']],
    [DEMO_PATHS.addressResult,['downloadButton','collect-customers']]
  ]);
  for(const [path,ids] of controls){const html=await (await fetch(site.url+path)).text();for(const id of ids)assert.ok(html.includes(id));assert.doesNotMatch(html,/__VIEWSTATE|__EVENTVALIDATION|WebResource\.axd/);}
});
test('driver scenarios use real status/barcode rules including mixed periods, revocations, TAL and IID',()=>{
  const titles=['VALID LICENSE','LICENSE EXPIRED','LICENSE SUSPENDED','LICENSE SUSPENDED','LICENSE SUSPENDED','VALID LICENSE','VALID LICENSE','VALID LICENSE','NOT LICENSED ID ONLY','NOT LICENSED','STATUS UNAVAILABLE'];
  for(const [index,record] of DRIVER_CASES.entries()){
    const text=driverText(record.id),alert=licenseStatus(text);assert.equal(alert.sections[0].title,titles[index]);assert.equal(reportBarcode(text).kind,'driver');
    if(record.kind==='suspended'){assert.equal(alert.activeSuspensions,6);assert.equal(alert.pendingReinstatement,2);assert.equal(alert.priorDuiDuac,2);assert.equal(alert.sections[0].columns[0].groups[0].reason,'Habitual Offender');}
    if(record.kind==='revocation')assert.equal(alert.sections[0].columns[0].groups[0].occurrences[0].revocation,true);
    if(record.kind==='tal')assert.ok(alert.sections[0].lines.includes('TEMPORARY ALCOHOL LICENSE'));
    if(record.kind==='iid'){assert.equal(alert.autoCloseMs,90000);assert.equal(alert.iidRequired,true);}
  }
});
test('residence records retain the queried customer first and classify ahead of repeated driver headings',()=>{
  for(const record of ADDRESS_CASES){
    const text=recordText(record.id);assert.equal(isResidenceReport(text),true);
    const expected=record.members.map(id=>DRIVER_CASES.find(profile=>profile.id===id).customer);
    assert.deepEqual(ownerNumbers(text),expected);assert.equal(expected.length,3);
    assert.equal(DRIVER_CASES.find(profile=>profile.id===record.members[0]).license,record.license);
  }
});
test('catalog and PDF endpoints allow only the defined synthetic records',async()=>{
  const catalog=await (await fetch(site.url+'/api/cases')).json();assert.equal(catalog.length,ALL_DEMO_CASES.length);
  for(const record of ALL_DEMO_CASES){const response=await fetch(site.url+DEMO_PATHS.pdf+'?case='+record.id);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');}
  assert.equal((await fetch(site.url+'/extension/panel.html?demo=ADDRESS001')).status,400);
  assert.equal((await fetch(site.url+'/extension/barcode.html?demo=UNDEFINED')).status,400);
});
