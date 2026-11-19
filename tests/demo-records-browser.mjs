// Real local PDFs and production views; no installed-extension or live-portal requests.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {dependency} from './runtime.mjs';
import {startDemoServer} from '../demo/server.mjs';
import {DEMO_PATHS as P} from '../demo/cases.mjs';
import {DRIVER_CASES,driverText} from '../demo/driver-cases.mjs';
import {licenseStatus} from '../extension/status-alerts.js';
import {reportBarcode} from '../extension/barcode-data.js';
const {chromium}=dependency('playwright');
const site=await startDemoServer(),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true});
const screenshots=fileURLToPath(new URL('../test-results/demo-records/',import.meta.url));await mkdir(screenshots,{recursive:true});
let passed=0;const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
try {
  const context=await browser.newContext({viewport:{width:1180,height:900}}),requests=[],errors=[];
  context.on('request',request=>requests.push({url:request.url(),method:request.method()}));
  context.on('page',page=>page.on('pageerror',problem=>errors.push(problem.message)));
  const page=await context.newPage();await page.goto(site.url+P.login);
  await page.locator('#ContentPlaceHolder1_userNameText').fill('demo');await page.locator('#ContentPlaceHolder1_passwordText').fill('demo');
  await page.locator('#ContentPlaceHolder1_loginButton').click();await page.waitForURL(site.url+P.disclaimer);
  await page.locator('#ContentPlaceHolder1_submitButton').click();await page.waitForURL(site.url+P.menu);
  await check('DL and customer inputs share one form, reject ambiguity and normalize C0/leading zeroes',async()=>{
    await page.goto(site.url+P.driverSearch);
    await page.locator('#ContentPlaceHolder1_dlNumberTextBox').fill('100000101');await page.locator('#ContentPlaceHolder1_idNumberTextBox').fill('10000001');
    await page.locator('#btnFooterNavNext').click();await page.locator('#demo-error').filter({hasText:'not both'}).waitFor();
    assert.equal(new URL(page.url()).pathname,P.driverSearch);
    await page.locator('#ContentPlaceHolder1_dlNumberTextBox').fill('');await page.locator('#ContentPlaceHolder1_idNumberTextBox').fill('C0 0010000001');
    await page.locator('#btnFooterNavNext').click();await page.waitForURL(url=>url.pathname===P.driverResult&&url.searchParams.get('case')==='DRIVER001');
    await page.locator('#result-plate').filter({hasText:'100000101'}).waitFor();
    await page.goto(site.url+P.driverSearch);await page.locator('#ContentPlaceHolder1_dlNumberTextBox').fill('999999999');await page.locator('#btnFooterNavNext').click();
    await page.locator('#demo-error').filter({hasText:'No demonstration record'}).waitFor();assert.equal(new URL(page.url()).pathname,P.driverSearch);
    await page.screenshot({path:join(screenshots,'driver-search.png'),fullPage:true});
  });
  for(const record of DRIVER_CASES)await check(record.id+' extracts all PDF pages and renders the correct status/barcode',async()=>{
    const mode=record.license?'license':'customer',number=record.license||record.customer;
    await page.goto(site.url+P.driverSearch+'?mode='+mode+'&number='+number);await page.locator('#btnFooterNavNext').click();
    await page.waitForURL(url=>url.pathname===P.driverResult&&url.searchParams.get('case')===record.id);
    await page.locator('#result-kind').filter({hasText:record.title}).waitFor();
    const extracted=await page.evaluate(async id=>(await import('/demo/report-tools.js')).extractDemoPdf(id),record.id);
    const expected=licenseStatus(driverText(record.id));assert.deepEqual(licenseStatus(extracted.text),expected);
    if(record.kind==='suspended')assert.ok(extracted.pages>=2,'The suspension example must span genuine PDF pages');
    const opened=context.waitForEvent('page');await page.locator('#preview-status').click();const status=await opened;
    await status.locator('h2.record-status-title').first().waitFor();assert.equal(await status.locator('h2.record-status-title').first().textContent(),expected.sections[0].title);
    if(record.kind==='suspended'){
      assert.match((await status.locator('.record-status-line').allTextContents()).join(' '),/6 active suspensions · 2 pending reinstatement/);
      const active=status.locator('.record-suspension-column').first();assert.equal(await active.locator('summary').first().textContent(),'Habitual Offender × 1');
      await active.locator('summary').first().click();await active.locator('.record-suspension-occurrence p').first().waitFor();
      assert.match(await active.locator('.record-suspension-occurrence p').first().textContent(),/Suspension End: INDEFINITE/);
    }
    if(record.kind==='revocation'){
      await status.locator('summary').click();assert.match(await status.locator('.record-suspension-occurrence p').textContent(),/Revocation Begin:.*Revocation End: INDEFINITE/);
    }
    if(record.kind==='pending')assert.deepEqual(await status.locator('.record-suspension-column h4').allTextContents(),['Active Suspensions','Pending Reinstatement']);
    if(record.kind==='tal')assert.equal(await status.locator('.record-status-qualifier').textContent(),'TEMPORARY ALCOHOL LICENSE');
    if(record.kind==='privilege')assert.match(await status.locator('.record-status-qualifier').textContent(),/DEMONSTRATION RESTRICTED PRIVILEGE/);
    if(record.kind==='iid'){assert.equal(await status.locator('.record-status-warning').textContent(),'IGNITION INTERLOCK DEVICE REQUIRED');assert.match(await status.locator('#alertCountdown').textContent(),/90 seconds/);}
    await status.screenshot({path:join(screenshots,record.id+'-status.png'),fullPage:true});await status.close();
    const openedCode=context.waitForEvent('page');await page.locator('#preview-barcode').click();const code=await openedCode;
    await code.locator('#scanArea').waitFor();assert.ok(await code.locator('#barcode').evaluate(canvas=>canvas.width>400));
    await code.locator('#barcode').screenshot({path:join(screenshots,record.id+'-barcode.png')});
    await writeFile(join(screenshots,record.id+'-payload.txt'),reportBarcode(extracted.text).payload);await code.close();
  });
  await check('residence PDF collection starts with the second customer and supports bounded previous/next',async()=>{
    await page.goto(site.url+P.addressSearch+'?number=100000101');await page.locator('#btnFooterNavNext').click();
    await page.waitForURL(url=>url.pathname===P.addressResult);await page.locator('#residence-customers li').nth(2).waitFor();
    assert.match((await page.locator('#residence-customers button').allTextContents())[0],/AVERY.*10000001/);
    await page.screenshot({path:join(screenshots,'residence.png'),fullPage:true});
    await page.locator('#collect-customers').click();await page.waitForURL(url=>url.searchParams.get('case')==='DRIVER002');
    await page.locator('#queue-position').filter({hasText:'Customer 2 of 3'}).waitFor();
    await page.locator('#queue-previous').click();await page.waitForURL(url=>url.searchParams.get('case')==='DRIVER001');
    await page.locator('#queue-position').filter({hasText:'Customer 1 of 3'}).waitFor();assert.equal(await page.locator('#queue-previous').isDisabled(),true);
    await page.locator('#queue-next').click();await page.waitForURL(url=>url.searchParams.get('case')==='DRIVER002');
    await page.locator('#queue-next').click();await page.waitForURL(url=>url.searchParams.get('case')==='DRIVER003');
    await page.locator('#queue-position').filter({hasText:'Customer 3 of 3'}).waitFor();assert.equal(await page.locator('#queue-next').isDisabled(),true);
    await page.locator('#queue-clear').click();assert.equal(await page.locator('#queue-controls').isVisible(),false);
  });
  await check('owner follow-up uses the saved second owner and leaves an undefined business customer explicit',async()=>{
    await page.goto(site.url+P.result+'?case=DEMO005');await page.locator('#result-kind').filter({hasText:'Shared-address owners'}).waitFor();
    let opened=context.waitForEvent('page');await page.locator('#preview-status').click();let status=await opened;await status.locator('.record-owner-search').nth(1).waitFor();
    const followed=context.waitForEvent('page');await status.locator('.record-owner-search').nth(1).click();const customer=await followed;
    await customer.waitForURL(url=>url.pathname===P.driverResult&&url.searchParams.get('case')==='DRIVER002');await customer.locator('#result-plate').filter({hasText:'100000102'}).waitFor();await customer.close();if(!status.isClosed())await status.close();
    await page.goto(site.url+P.result+'?case=DEMO006');opened=context.waitForEvent('page');await page.locator('#preview-status').click();status=await opened;
    await status.locator('.record-owner-search').nth(1).click();await status.locator('#error').filter({hasText:'No fictional driver profile'}).waitFor();await status.close();
  });
  await check('invalid result selection cannot reuse an old record and reset clears only demo state',async()=>{
    await page.goto(site.url+P.addressResult+'?case=ADDRESS001');await page.locator('#residence-customers li').nth(2).waitFor();
    await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:join(screenshots,'residence-mobile.png'),fullPage:true});
    await page.goto(site.url+P.driverResult+'?case=DEMO001');await page.locator('#demo-error').filter({hasText:'No valid demonstration result'}).waitFor();
    assert.equal(await page.locator('#preview-status').isVisible(),false);
    await page.evaluate(()=>sessionStorage.setItem('unrelated-site-note','keep'));
    await page.locator('#reset-demo').click();await page.waitForURL(site.url+P.login);assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),['unrelated-site-note']);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('unrelated-site-note')),'keep');
    assert.deepEqual(requests.filter(request=>/^https?:/.test(request.url)&&new URL(request.url).origin!==site.url),[]);assert.ok(requests.every(request=>request.method==='GET'));assert.deepEqual(errors,[]);
  });
  await context.close();console.log(`${passed} driver/customer/residence browser checks passed; no live DMV requests were made.`);
} finally {await browser.close();await site.close();}
