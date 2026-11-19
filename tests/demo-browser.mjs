// Local prototype checks: real browser, generated PDFs and actual production views.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {dependency} from './runtime.mjs';
import {startDemoServer} from '../demo/server.mjs';
import {DEMO_CASES,DEMO_PATHS as P} from '../demo/cases.mjs';
import {plateStatus} from '../extension/status-alerts.js';
import {reportBarcode} from '../extension/barcode-data.js';
const {chromium}=dependency('playwright');
const site=await startDemoServer(),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true});
const screenshots=fileURLToPath(new URL('../test-results/demo/',import.meta.url));await mkdir(screenshots,{recursive:true});
let passed=0;const check=async(name,fn)=>{await fn();console.log('PASS '+name);passed++;};
try {
  const context=await browser.newContext({viewport:{width:1180,height:900}}),requests=[],errors=[];
  context.on('request',request=>requests.push({url:request.url(),method:request.method(),body:request.postData()}));
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  const page=await context.newPage();
  await check('credential inputs remain disabled when local JavaScript is unavailable',async()=>{
    const noScript=await browser.newContext({javaScriptEnabled:false}),blank=await noScript.newPage();
    await blank.goto(site.url+P.login);
    for(const id of ['ContentPlaceHolder1_userNameText','ContentPlaceHolder1_passwordText','ContentPlaceHolder1_loginButton'])assert.equal(await blank.locator('#'+id).isDisabled(),true);
    await noScript.close();
  });
  await check('record inputs stay disabled until catalog loading installs the local submit handler',async()=>{
    const waiting=await browser.newContext(),gate=Promise.withResolvers();
    await waiting.addInitScript(()=>sessionStorage.setItem('scdmv-demo-auth','true'));
    await waiting.route('**/api/cases',async route=>{await gate.promise;await route.continue();});
    const delayed=await waiting.newPage();
    try{
      await delayed.goto(site.url+P.search,{waitUntil:'domcontentloaded'});
      assert.equal(await delayed.locator('#ContentPlaceHolder1_txtPlateNbr').isDisabled(),true);assert.equal(await delayed.locator('#btnFooterNavNext').isDisabled(),true);
      gate.resolve();await delayed.locator('#ContentPlaceHolder1_txtPlateNbr').fill('DEMO001');await delayed.locator('#btnFooterNavNext').click();
      await delayed.waitForURL(url=>url.pathname===P.result&&url.searchParams.get('case')==='DEMO001');
      assert.equal(new URL(delayed.url()).searchParams.has('ctl00$ContentPlaceHolder1$txtPlateNbr'),false);
    }finally{gate.resolve();await waiting.close();}
  });
  await check('demo starts at a clearly labeled landing page and protects direct search navigation',async()=>{
    await page.goto(site.url);assert.match(await page.locator('.demo-banner').textContent(),/SYNTHETIC DATA/);
    await page.screenshot({path:join(screenshots,'home.png'),fullPage:true});
    await page.goto(site.url+P.search);await page.waitForURL(site.url+P.login);
  });
  await check('demo login validates locally and continues through the actual disclaimer and menu selectors',async()=>{
    await page.locator('#ContentPlaceHolder1_userNameText').fill('demo');await page.locator('#ContentPlaceHolder1_passwordText').fill('not-a-real-password');
    await page.locator('#ContentPlaceHolder1_loginButton').click();await page.locator('[role="alert"]').waitFor();
    assert.equal(await page.locator('#ContentPlaceHolder1_passwordText').inputValue(),'');
    await page.locator('#ContentPlaceHolder1_passwordText').fill('demo');await page.locator('#ContentPlaceHolder1_loginButton').click();
    await page.waitForURL(site.url+P.disclaimer);await page.locator('#ContentPlaceHolder1_submitButton').click();await page.waitForURL(site.url+P.menu);
    assert.equal(await page.locator('#ContentPlaceHolder1_menuContainer a').count(),5);
  });
  await check('unknown plates show the production-compatible validation area without a result',async()=>{
    await page.goto(site.url+P.search);await page.locator('#ContentPlaceHolder1_txtPlateNbr').fill('DEMO404');await page.locator('#btnFooterNavNext').click();
    await page.locator('.iFormsValidationSummary:not([hidden])').waitFor();assert.equal(new URL(page.url()).pathname,P.search);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('scdmv-demo-plate')),null);
  });
  let pdfWindow;
  for(const [index,record] of DEMO_CASES.entries())await check(record.plate+' navigates, opens a real PDF and renders production status/barcode views',async()=>{
    await page.goto(site.url+P.search+'?plate='+record.plate);assert.equal(await page.locator('#ContentPlaceHolder1_txtPlateNbr').inputValue(),record.plate);
    await page.locator('#btnFooterNavNext').click();await page.waitForURL(url=>url.pathname===P.result);assert.equal(await page.locator('#result-plate').textContent(),record.plate);
    if(!pdfWindow){const opened=context.waitForEvent('page');await page.locator('#downloadButton').click();pdfWindow=await opened;}
    else await page.locator('#downloadButton').click();
    await pdfWindow.waitForURL(url=>url.pathname===P.pdf&&url.searchParams.get('case')===record.plate);
    const text=await page.evaluate(async({plate,pdfPath})=>{
      const {getDocument,GlobalWorkerOptions}=await import('/extension/vendor/pdf.mjs');GlobalWorkerOptions.workerSrc='/extension/vendor/pdf.worker.mjs';
      const response=await fetch(pdfPath+'?case='+plate),doc=await getDocument({data:new Uint8Array(await response.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,standardFontDataUrl:'/extension/vendor/standard_fonts/'}).promise;
      try {let text='';for(const item of (await (await doc.getPage(1)).getTextContent()).items)if('str' in item)text+=item.str+(item.hasEOL?'\n':' ');return text;}finally{await doc.destroy();}
    },{plate:record.plate,pdfPath:P.pdf});
    assert.ok(text.includes('DEMONSTRATION - SYNTHETIC DATA'));const expected=plateStatus(text),barcode=reportBarcode(text);
    const openedStatus=context.waitForEvent('page');await page.locator('#preview-status').click();const status=await openedStatus;
    await status.locator('.record-status-title').first().waitFor();assert.equal(await status.locator('.record-status-title').first().textContent(),expected.sections[0].title);
    assert.equal(await status.locator('.record-owner').count(),record.kind==='shared'||record.kind==='lessee'?2:1);
    assert.equal(await status.locator('.demo-preview-banner').count(),1);
    if(record.kind==='shared'){const addresses=await status.locator('.record-owner-address').allTextContents();assert.equal(addresses[0],addresses[1]);}
    if(record.kind==='lessee')assert.equal((await status.locator('.record-owner-name').allTextContents())[1],'DEMONSTRATION SERVICES LLC');
    await status.screenshot({path:join(screenshots,record.plate+'-status.png'),fullPage:true});
    if(index===0){
      const followed=context.waitForEvent('page');await status.locator('.record-owner-search').first().click();const customer=await followed;
      await customer.waitForURL(url=>url.pathname===P.driverResult);await customer.locator('#result-plate').filter({hasText:'100000101'}).waitFor();await customer.close();
    }
    if(!status.isClosed())await status.close();
    const openedCode=context.waitForEvent('page');await page.locator('#preview-barcode').click();const code=await openedCode;
    await code.locator('#scanArea').waitFor();assert.ok(await code.locator('#barcode').evaluate(canvas=>canvas.width>400));
    const values=await code.locator('#fields input').evaluateAll(inputs=>inputs.map(input=>input.value));assert.ok(values.includes(record.plate));
    await code.locator('#barcode').screenshot({path:join(screenshots,record.plate+'-barcode.png')});
    await writeFile(join(screenshots,record.plate+'-payload.txt'),barcode.payload);
    if(index===0){await code.locator('#edit').click();const editable=code.locator('#fields input').first();assert.equal(await editable.getAttribute('readonly'),null);}
    await code.close();
  });
  await check('demo stays on loopback, sends no credentials, resets its own state and fits a narrow screen',async()=>{
    assert.equal(requests.some(request=>request.method!=='GET'),false);
    assert.equal(requests.some(request=>request.body?.includes('not-a-real-password')),false);
    // Chrome's native PDF viewer also loads internal chrome:// resources.
    assert.deepEqual(requests.filter(request=>/^https?:/.test(request.url)&&new URL(request.url).origin!==site.url).map(request=>request.url),[]);
    assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage).sort()),['scdmv-demo-auth','scdmv-demo-plate']);
    await page.locator('#reset-demo').click();await page.waitForURL(site.url+P.login);
    assert.equal(await page.evaluate(()=>sessionStorage.length),0);
    await page.goto(site.url);await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:join(screenshots,'mobile.png'),fullPage:true});assert.deepEqual(errors,[]);
  });
  await context.close();console.log(`${passed} demo browser checks passed; no live DMV requests were made.`);
} finally {await browser.close();await site.close();}
