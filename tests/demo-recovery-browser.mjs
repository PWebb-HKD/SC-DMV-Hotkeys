// Exercise real synthetic-PDF images and controlled failures without installed-extension privileges.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {dependency} from './runtime.mjs';
import {startDemoServer} from '../demo/server.mjs';
import {DEMO_PATHS as P} from '../demo/cases.mjs';
import {ERROR_SELECTOR} from '../extension/core.js';
const {chromium}=dependency('playwright'),site=await startDemoServer();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true});
const screenshots=fileURLToPath(new URL('../test-results/demo-recovery/',import.meta.url));await mkdir(screenshots,{recursive:true});
let passed=0;const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
try{
  const context=await browser.newContext({viewport:{width:1180,height:900}}),requests=[],errors=[];
  context.on('request',r=>requests.push({url:r.url(),method:r.method()}));context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const page=await context.newPage();
  const login=async()=>{await page.locator('#ContentPlaceHolder1_userNameText').fill('demo');await page.locator('#ContentPlaceHolder1_passwordText').fill('demo');await page.locator('#ContentPlaceHolder1_loginButton').click();await page.waitForURL(site.url+P.disclaimer);await page.locator('#ContentPlaceHolder1_submitButton').click();await page.waitForURL(site.url+P.menu);};
  const result=async id=>{await page.goto(site.url+P.driverResult+'?case='+id);await page.locator('#result-card:not([hidden])').waitFor();};
  const preview=async action=>{const opened=context.waitForEvent('page');await page.locator('#preview-'+action).click();return await opened;};
  const choose=async(kind,scenario)=>{await page.goto(site.url+(kind==='plate'?P.search:kind==='address'?P.addressSearch:P.driverSearch));await page.locator('.demo-test-controls summary').click();await page.locator('#demo-scenario').selectOption(scenario);const field=kind==='plate'?'ContentPlaceHolder1_txtPlateNbr':kind==='address'?'ContentPlaceHolder1_txtDLNumber':kind==='customer'?'ContentPlaceHolder1_idNumberTextBox':'ContentPlaceHolder1_dlNumberTextBox';await page.locator('#'+field).fill(kind==='plate'?'DEMO001':kind==='customer'?'10000001':'100000101');};
  await page.goto(site.url+P.login);await login();
  await check('photo preview defaults off and the PDF contains an actual extractable synthetic portrait',async()=>{
    await result('DRIVER001');assert.equal(await page.locator('#demo-show-identity').isChecked(),false);
    const disabled=await page.evaluate(async()=>await(await import('/demo/report-tools.js')).extractDemoPdf('DRIVER001'));assert.equal(disabled.driverIdentity,undefined);
    const extracted=await page.evaluate(async()=>await(await import('/demo/report-tools.js')).extractDemoPdf('DRIVER001',{includeIdentity:true}));
    assert.equal(extracted.driverIdentity.name,'EXAMPLE, AVERY');assert.match(extracted.driverIdentity.photo,/^data:image\/png;base64,/);assert.equal(extracted.driverIdentity.noPhoto,undefined);
    await writeFile(join(screenshots,'synthetic-portrait.png'),Buffer.from(extracted.driverIdentity.photo.split(',')[1],'base64'));
    const alert=await preview('status');await alert.locator('.record-status-title').waitFor();assert.equal(await alert.locator('.record-driver-identity').count(),0);await alert.close();
  });
  await check('opt-in renders the actual PDF portrait and driver name below the status',async()=>{
    await page.locator('#demo-show-identity').check();const alert=await preview('status');await alert.locator('.record-driver-photo').waitFor();
    assert.equal(await alert.locator('.record-driver-name').textContent(),'EXAMPLE, AVERY');assert.equal(await alert.locator('.record-driver-identity').evaluate(el=>el.previousElementSibling.tagName),'H2');
    await alert.waitForFunction(()=>document.querySelector('.record-driver-photo').naturalWidth===288);
    await alert.screenshot({path:join(screenshots,'portrait-alert.png'),fullPage:true});await alert.close();
  });
  await check('both no-photo PDFs pass real placeholder detection and omit the image from alerts',async()=>{
    for(const id of ['DRIVER009','DRIVER010']){
      await result(id);assert.equal(await page.locator('#demo-show-identity').isChecked(),true);
      const extracted=await page.evaluate(async id=>await(await import('/demo/report-tools.js')).extractDemoPdf(id,{includeIdentity:true}),id);
      assert.equal(extracted.driverIdentity.noPhoto,true);assert.equal(extracted.driverIdentity.photo,'');
      const alert=await preview('status');await alert.locator('.record-driver-name').waitFor();assert.equal(await alert.locator('.record-driver-photo').count(),0);assert.match(await alert.locator('.record-driver-identity').textContent(),/No photo available/);
      await alert.screenshot({path:join(screenshots,id+'-no-photo.png'),fullPage:true});await alert.close();
    }
  });
  await check('an absent image retains the name, and switching identity off removes the whole card',async()=>{
    await result('DRIVER002');let alert=await preview('status');await alert.locator('.record-driver-name').waitFor();assert.equal(await alert.locator('.record-driver-name').textContent(),'EXAMPLE, MORGAN');assert.match(await alert.locator('.record-driver-identity').textContent(),/Photo unavailable/);assert.equal(await alert.locator('img.record-driver-photo').count(),0);await alert.close();
    await page.locator('#demo-show-identity').uncheck();alert=await preview('status');await alert.locator('.record-status-title').waitFor();assert.equal(await alert.locator('.record-driver-identity').count(),0);await alert.close();
  });
  await check('session expiration before submission or during results requires fresh login and clears old records',async()=>{
    for(const [kind,mode] of [['plate','expire-before'],['license','expire-results']]){
      await choose(kind,mode);await page.evaluate(()=>{sessionStorage.setItem('scdmv-demo-queue',JSON.stringify({customers:['10000001'],index:0}));sessionStorage.setItem('scdmv-demo-scutties','old');});
      await page.locator('#btnFooterNavNext').click();await page.waitForURL(site.url+P.login+'?expired=1');await page.locator('#demo-error').filter({hasText:'session has expired'}).waitFor();
      assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>/^scdmv-demo-(auth|plate|driver|address|queue|scutties|scenario)$/.test(k))),[]);
      await login();
    }
  });
  await check('failed customer transactions show a real HTTP 503 portal error and allow a normal retry',async()=>{
    await choose('customer','error');const response=page.waitForResponse(r=>r.url()===site.url+P.error);await page.locator('#btnFooterNavNext').click();assert.equal((await response).status(),503);
    await page.waitForURL(site.url+P.error);await page.locator(ERROR_SELECTOR).filter({hasText:'could not complete'}).waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('scdmv-demo-driver')),null);assert.equal(await page.locator('#downloadButton').count(),0);
    await page.screenshot({path:join(screenshots,'transaction-error.png'),fullPage:true});
    await choose('customer','normal');await page.locator('#btnFooterNavNext').click();await page.locator('#result-card:not([hidden])').waitFor();assert.equal(await page.locator('#result-plate').textContent(),'100000101');
  });
  await check('delayed results hide premature actions and a cancelled delay cannot publish a record',async()=>{
    await choose('plate','slow');await page.locator('#btnFooterNavNext').click();await page.locator('#result-pending:not([hidden])').waitFor();assert.equal(await page.locator('#downloadButton').isVisible(),false);assert.equal(await page.locator('#preview-status').isVisible(),false);assert.equal(await page.evaluate(()=>sessionStorage.getItem('scdmv-demo-plate')),null);
    await page.locator('#result-card:not([hidden])').waitFor();assert.equal(await page.locator('#result-plate').textContent(),'DEMO001');
    await choose('license','slow');await page.locator('#btnFooterNavNext').click();await page.locator('#result-pending-back').click();await page.waitForURL(site.url+P.driverSearch);assert.equal(await page.evaluate(()=>sessionStorage.getItem('scdmv-demo-driver')),null);
    await page.locator('#ContentPlaceHolder1_dlNumberTextBox').fill('100000102');await page.locator('#btnFooterNavNext').click();await page.locator('#result-card:not([hidden])').waitFor();assert.equal(await page.locator('#result-plate').textContent(),'100000102');
  });
  await check('a timed-out residence search creates no PDF or queue and the next attempt succeeds',async()=>{
    await choose('address','timeout');const existingQueue={customers:['10000001','10000002'],index:1};await page.evaluate(queue=>sessionStorage.setItem('scdmv-demo-queue',JSON.stringify(queue)),existingQueue);
    const before=requests.filter(r=>r.url.includes(P.pdf)).length;await page.locator('#btnFooterNavNext').click();await page.locator('#result-pending:not([hidden])').waitFor();
    await page.locator('#demo-error').filter({hasText:'search timed out'}).waitFor();assert.equal(await page.locator('#downloadButton').isVisible(),false);assert.equal(await page.locator('#collect-customers').isVisible(),false);assert.equal(await page.evaluate(()=>sessionStorage.getItem('scdmv-demo-address')),null);assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('scdmv-demo-queue'))),existingQueue);assert.equal(requests.filter(r=>r.url.includes(P.pdf)).length,before);
    await page.screenshot({path:join(screenshots,'timeout.png'),fullPage:true});await page.locator('#result-pending-back').click();await page.waitForURL(site.url+P.addressSearch);
    await page.locator('.demo-test-controls summary').click();assert.equal(await page.locator('#demo-scenario').inputValue(),'normal');await page.locator('#ContentPlaceHolder1_txtDLNumber').fill('100000101');await page.locator('#btnFooterNavNext').click();await page.locator('#residence-customers li').nth(2).waitFor();
  });
  await check('unavailable PDFs fail status/barcode previews without falling back to a previous alert',async()=>{
    await choose('license','report-failure');await page.locator('#btnFooterNavNext').click();await page.locator('#result-card:not([hidden])').waitFor();await page.locator('#demo-show-identity').check();
    for(const action of ['status','barcode']){const failed=await preview(action);await failed.locator('#error').filter({hasText:'PDF is unavailable'}).waitFor();assert.equal(await failed.locator('.record-status-title').count(),0);assert.equal(await failed.locator('.record-driver-identity').count(),0);await failed.close();}
    const response=await page.request.get(site.url+P.pdf+'?case=DRIVER001&failure=unavailable');assert.equal(response.status(),503);assert.match(await response.text(),/report service is unavailable/);
    await choose('license','normal');await page.locator('#btnFooterNavNext').click();await page.locator('#result-card:not([hidden])').waitFor();const alert=await preview('status');await alert.locator('.record-driver-photo').waitFor();await alert.close();
  });
  await check('invalid searches retain the one-shot scenario and manual expiration also clears SCUTTIES state',async()=>{
    await choose('plate','error');await page.locator('#ContentPlaceHolder1_txtPlateNbr').fill('DEMO404');await page.locator('#btnFooterNavNext').click();await page.locator('#demo-error').filter({hasText:'No demonstration record'}).waitFor();assert.equal(await page.locator('#demo-scenario').inputValue(),'error');
    await page.locator('#demo-scenario').selectOption('normal');await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(screenshots,'controls-mobile.png'),fullPage:true});
    await page.goto(site.url+P.scuttiesSearch+'?sample=SCUTTIES001');await page.locator('#scutties-search:enabled').waitFor();await page.locator('#scutties-search').click();await page.locator('#scutties-rows tr').nth(2).waitFor();await page.locator('#expire-demo').click();await page.waitForURL(site.url+P.login+'?expired=1');assert.equal(await page.evaluate(()=>sessionStorage.getItem('scdmv-demo-scutties')),null);await login();
    await page.goto(site.url+P.driverSearch);await page.evaluate(()=>sessionStorage.setItem('scdmv-demo-scenario','UNKNOWN'));await page.locator('#ContentPlaceHolder1_dlNumberTextBox').fill('100000101');await page.locator('#btnFooterNavNext').click();await page.locator('#result-card:not([hidden])').waitFor();assert.equal(new URL(page.url()).searchParams.has('scenario'),false);
  });
  await check('reset removes demo preferences and failures while preserving unrelated data and local-only requests',async()=>{
    await page.evaluate(()=>sessionStorage.setItem('unrelated-site-note','keep'));await page.locator('#reset-demo').click();await page.waitForURL(site.url+P.login);assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),['unrelated-site-note']);
    assert.deepEqual(requests.filter(r=>/^https?:/.test(r.url)&&new URL(r.url).origin!==site.url),[]);assert.ok(requests.every(r=>r.method==='GET'));assert.deepEqual(errors,[]);
  });
  await context.close();console.log(`${passed} demo photo/recovery browser checks passed; no live requests were made.`);
}finally{await browser.close();await site.close();}
