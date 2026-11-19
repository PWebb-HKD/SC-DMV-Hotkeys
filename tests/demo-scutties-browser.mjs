// Real browser checks for the synthetic SCUTTIES handoff, query and read-only citation display.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {dependency} from './runtime.mjs';
import {startDemoServer} from '../demo/server.mjs';
import {DEMO_PATHS as P} from '../demo/cases.mjs';
import {SCUTTIES_CASES} from '../demo/scutties-cases.mjs';
const {chromium}=dependency('playwright'),site=await startDemoServer();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true});
const screenshots=fileURLToPath(new URL('../test-results/demo-scutties/',import.meta.url));await mkdir(screenshots,{recursive:true});
let passed=0;const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
try {
  const context=await browser.newContext({viewport:{width:1180,height:900}}),requests=[],errors=[];
  context.on('request',r=>requests.push({url:r.url(),method:r.method()}));context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const portal=await context.newPage();let page;
  await check('SCUTTIES requires the demo login and cannot submit with JavaScript disabled',async()=>{
    await portal.goto(site.url+P.scuttiesSearch);await portal.waitForURL(site.url+P.login);
    const noScript=await browser.newContext({javaScriptEnabled:false}),disabled=await noScript.newPage();await disabled.goto(site.url+P.scuttiesSearch);
    for(const id of ['scutties-last','scutties-dob','scutties-search'])assert.equal(await disabled.locator('#'+id).isDisabled(),true);await noScript.close();
    await portal.locator('#ContentPlaceHolder1_userNameText').fill('demo');await portal.locator('#ContentPlaceHolder1_passwordText').fill('demo');await portal.locator('#ContentPlaceHolder1_loginButton').click();
    await portal.waitForURL(site.url+P.disclaimer);await portal.locator('#ContentPlaceHolder1_submitButton').click();await portal.waitForURL(site.url+P.menu);
  });
  await check('transaction handoff opens a child tab, simulates sign-in and keeps the parent menu',async()=>{
    const opened=context.waitForEvent('page');await portal.locator(`a[href="${P.scuttiesHandoff}"]`).click();page=await opened;
    await page.waitForURL(site.url+P.scuttiesSearch);await page.locator('#scutties-clear:enabled').waitFor();
    assert.equal(await page.opener(),portal);assert.equal(new URL(portal.url()).pathname,P.menu);
    assert.equal(await page.locator('#scutties-search').isDisabled(),true);assert.match(await page.locator('.demo-banner').textContent(),/SYNTHETIC DATA/);
    const base='#home > div > div.col-xs-12.row > div:nth-child(3) > div.panel-body > div:nth-child(1)';
    assert.equal(await page.locator(base+' > div:nth-child(1) > input').getAttribute('ng-model'),'searchData.violatorLastName');
    assert.equal(await page.locator(base+' > div:nth-child(2) > input').getAttribute('ng-model'),'searchData.violatorBirthDate');
    // Preserve the actual capture's action order and record the production second-button mismatch.
    assert.equal(await page.locator(base+' > div.col-xs-8 > button:nth-child(2)').getAttribute('ng-click'),'searchCitationSaved()');
  });
  await check('local search validates calendar dates and normalizes surname case/spacing',async()=>{
    await page.locator('#scutties-last').fill('  example  ');await page.locator('#scutties-dob').fill('02/30/2000');await page.locator('#scutties-search').click();
    await page.locator('#demo-error').filter({hasText:'invalid date'}).waitFor();assert.equal(await page.locator('#scutties-results').isVisible(),false);
    await page.locator('#scutties-dob').fill('01/02/2000');await page.locator('#scutties-search').click();await page.locator('#scutties-rows tr').nth(2).waitFor();
    assert.equal(await page.locator('#scutties-rows tr').count(),3);assert.match(await page.locator('#scutties-result-count').textContent(),/3 fictional citations/);
    for(const [index,c] of SCUTTIES_CASES[0].citations.entries())assert.deepEqual((await page.locator('#scutties-rows tr').nth(index).locator('td').allTextContents()).slice(1),[c.number,`${c.lastName}, ${c.first}`,c.dob,c.license,c.state,c.date,c.statute,c.disposition]);
    assert.equal(page.url(),site.url+P.scuttiesSearch);await page.screenshot({path:join(screenshots,'results.png'),fullPage:true});
  });
  await check('every View opens its own read-only details and returns to the original results',async()=>{
    for(const c of SCUTTIES_CASES[0].citations){
      await page.getByRole('button',{name:'View '+c.number,exact:true}).click();await page.locator('#display').waitFor();
      assert.equal(await page.locator('#home').isVisible(),false);assert.equal(await page.locator('#scutties-detail-heading').textContent(),'Citation '+c.number);
      const fields=await page.locator('#scutties-details dd').allTextContents();for(const value of [c.number,c.offense,c.disposition,c.license,c.address+', '+c.city+', '+c.state+' '+c.zip])assert.ok(fields.includes(value));
      assert.equal(await page.locator('#display input,#display textarea').count(),0);
      await page.locator('#scutties-home').click();assert.equal(await page.locator('#scutties-rows tr').count(),3);
      assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'View '+c.number);
    }
    await page.getByRole('button',{name:'View DEMO-CIT-002',exact:true}).click();await page.reload();await page.locator('#display').waitFor();
    assert.equal(await page.locator('#scutties-detail-heading').textContent(),'Citation DEMO-CIT-002');await page.screenshot({path:join(screenshots,'detail.png'),fullPage:true});
    await page.evaluate(()=>{window.print=()=>{window.demoPrintCalled=true;};});await page.locator('#scutties-print').click();assert.equal(await page.evaluate(()=>window.demoPrintCalled),true);
    await page.emulateMedia({media:'print'});assert.equal(await page.locator('.demo-banner').isVisible(),true);assert.equal(await page.locator('#scutties-print').isVisible(),false);await page.emulateMedia({media:'screen'});
    await page.locator('#scutties-home').click();
  });
  await check('compound surname/leap-day and empty searches do not retain previous citation details',async()=>{
    await page.locator('[data-scutties-sample="SCUTTIES002"]').click();await page.locator('#scutties-last').fill(' de   la cruz ');await page.locator('#scutties-search').click();
    await page.locator('#scutties-rows tr').waitFor();assert.equal(await page.locator('#scutties-rows tr').count(),1);assert.match(await page.locator('#scutties-rows').textContent(),/DE LA CRUZ, TAYLOR/);
    await page.locator('[data-scutties-sample="SCUTTIES003"]').click();await page.locator('#scutties-search').click();await page.locator('#scutties-result-count').filter({hasText:'No fictional citations'}).waitFor();
    assert.equal(await page.locator('#scutties-rows tr').count(),0);assert.equal(await page.locator('#scutties-details').textContent(),'');
    await page.locator('#scutties-last').fill('EXAMPLE');await page.locator('#scutties-dob').fill('01/03/2000');await page.locator('#scutties-search').click();
    assert.equal(await page.locator('#scutties-rows tr').count(),0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('scdmv-demo-scutties')),null);
    await page.screenshot({path:join(screenshots,'no-results.png'),fullPage:true});
  });
  await check('tampered saved selections and unknown sample IDs fail without borrowing a previous record',async()=>{
    await page.evaluate(()=>sessionStorage.setItem('scdmv-demo-scutties',JSON.stringify({caseId:'SCUTTIES001',entry:'DEMO-CIT-004'})));
    await page.reload();await page.locator('#demo-error').filter({hasText:'saved demonstration citation'}).waitFor();assert.equal(await page.locator('#display').isVisible(),false);
    await page.goto(site.url+P.scuttiesSearch+'?sample=UNKNOWN');await page.locator('#demo-error').filter({hasText:'Unknown SCUTTIES'}).waitFor();assert.equal(await page.locator('#scutties-results').isVisible(),false);
    await page.goto(site.url+P.scuttiesSearch+'?sample=SCUTTIES002');await page.locator('#scutties-search:enabled').waitFor();assert.equal(await page.locator('#scutties-last').inputValue(),'DE LA CRUZ');
  });
  await check('mobile pages contain the results table and details without overflowing the screen',async()=>{
    await page.setViewportSize({width:375,height:812});await page.locator('#scutties-search').click();await page.locator('#scutties-rows tr').waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(screenshots,'results-mobile.png'),fullPage:true});
    await page.getByRole('button',{name:'View DEMO-CIT-004',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:join(screenshots,'detail-mobile.png'),fullPage:true});await page.locator('#scutties-home').click();
  });
  await check('Clear and Reset remove demo selections; all browser requests remain local GETs',async()=>{
    await page.locator('#scutties-clear').click();assert.equal(await page.locator('#scutties-last').inputValue(),'');assert.equal(await page.locator('#scutties-dob').inputValue(),'');assert.equal(await page.locator('#scutties-search').isDisabled(),true);assert.equal(await page.locator('#scutties-results').isVisible(),false);
    await page.evaluate(()=>sessionStorage.setItem('unrelated-site-note','keep'));await page.locator('#reset-demo').click();await page.waitForURL(site.url+P.login);
    assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),['unrelated-site-note']);
    assert.deepEqual(requests.filter(r=>/^https?:/.test(r.url)&&new URL(r.url).origin!==site.url),[]);assert.ok(requests.every(r=>r.method==='GET'));
    assert.ok(requests.every(r=>!/[?&](?:lastName|dob|name|birthDate)=/i.test(r.url)));assert.deepEqual(errors,[]);
  });
  await context.close();console.log(`${passed} SCUTTIES demo browser checks passed; no live requests were made.`);
}finally{await browser.close();await site.close();}
