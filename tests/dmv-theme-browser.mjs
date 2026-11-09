// Synthetic DMV markup based on the supplied login DOM; no viewstate, login, or tracking data.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {dependency} from './runtime.mjs';
const {chromium}=dependency('playwright'),root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url),darkReaderPath=require.resolve('darkreader');
const css=await readFile(join(root,'extension/dmv-theme.css'),'utf8');
const memberFixture=await readFile(join(root,'tests/fixtures/dmv-member-header.html'),'utf8');
const transactionFixture=await readFile(join(root,'tests/fixtures/dmv-transactions.html'),'utf8');
const controller=await readFile(join(root,'extension/dmv-theme.js'),'utf8'),startup=await readFile(join(root,'extension/dmv-theme-start.js'),'utf8');
const fixture=`<!doctype html><html lang="en-us"><head><title>Fictional DMV member login</title><style>
body{margin:0;background:#fff;color:#333;font:16px Arial,sans-serif}a{color:#337ab7}h1{font-size:26px}label{color:#333;display:block;margin:14px 0 6px}input,select{box-sizing:border-box;padding:10px;width:100%;background:#fff;color:#555;border:1px solid #ccc;border-radius:4px}.container{max-width:920px;margin:auto}.navbar{background:#00345e;padding:18px;color:white}.navbar a{color:white;margin-right:24px}.navbar img{width:38px;height:38px;vertical-align:middle;margin-right:14px}.panel{margin:24px 0;border:1px solid #ddd;border-radius:4px;background:white}.panel-heading{padding:12px;background:#f5f5f5;color:#333}.panel-body{padding:18px}.btn{padding:10px 20px;border:1px solid #ccc;border-radius:4px;background:white;color:#333;margin:16px 8px 0 0}.btn-primary{background:#337ab7;color:#fff;border-color:#2e6da4}.alert{padding:12px;margin:12px 0;border:1px solid}.alert-danger{background:#f2dede;color:#a94442;border-color:#ebccd1}.iFormsRequired{color:#a94442}.text-muted{color:#777}table{border-collapse:collapse;width:100%;background:white;color:#333}th,td{padding:10px;border:1px solid #ddd}thead{background:#eee}.table-striped>tbody>tr:nth-of-type(odd){background:#f9f9f9}.dropdown-menu{display:none;background:#fff}.dropdown-menu.open{display:block}.dropdown-menu li{padding:7px}footer{margin:24px;padding:20px;background:#eee}button:focus,input:focus{outline:2px solid #66afe9}#globalTopPanel_message{display:none}
</style></head><body><nav class="navbar first-navbar topnav-color"><div class="container"><img id="logo" alt="Fictional DMV logo" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='20' height='40' fill='red'/%3E%3Crect x='20' width='20' height='40' fill='lime'/%3E%3C/svg%3E"><a href="#">SCDMV Member Services</a><a id="menuLink" href="#menu">Transactions</a></div></nav><main class="container"><h1 class="pageTitle">Member Login</h1><div class="panel panel-default"><div class="panel-heading">Log in to your account</div><div class="panel-body"><form id="form1"><input type="hidden" id="__VIEWSTATE" value="synthetic-state"><label id="ContentPlaceHolder1_userNameText_Label" for="ContentPlaceHolder1_userNameText">Username <i class="iFormsRequired">*</i></label><input class="form-control iForms_Textbox" id="ContentPlaceHolder1_userNameText" value="FICTIONAL-USER"><label for="ContentPlaceHolder1_passwordText">Password</label><input class="form-control iForms_Textbox" id="ContentPlaceHolder1_passwordText" type="password" value="fictional-password"><button class="btn btn-primary" id="ContentPlaceHolder1_loginButton" type="submit">Log in</button><a id="ContentPlaceHolder1_passwordforget" href="#forgot">Forgot password?</a></form><div id="globalTopPanel_message" class="iFormsValidationSummary alert alert-danger">Hidden validation message</div></div></div><div class="alert alert-danger" id="visibleError">Example validation error</div><div class="panel"><div class="panel-heading">Available transactions</div><div class="panel-body"><button class="btn" id="menuToggle">Show menu</button><ul id="menu" class="dropdown-menu"><li><a href="#plate">Vehicle record</a></li><li><a href="#driver">Driver record</a></li></ul><table class="table table-striped"><thead><tr><th>Transaction</th><th>Status</th></tr></thead><tbody><tr><td>Vehicle record</td><td>Available</td></tr><tr><td>Driver record</td><td>Available</td></tr></tbody></table><p class="text-muted">Synthetic page for appearance testing.</p></div></div></main><footer><div class="container">Contact and support information</div></footer><script>document.querySelector('#menuToggle').onclick=()=>document.querySelector('#menu').classList.toggle('open');document.querySelector('#form1').onsubmit=e=>{e.preventDefault();window.submitted=true;};</script></body></html>`;
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let passed=0;const worlds=new WeakMap();
const worldEval=async(page,expression)=>{const {session,id}=worlds.get(page),result=await session.send('Runtime.evaluate',{expression,contextId:id,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
const test=async(name,run)=>{await run();passed++;console.log('PASS '+name);};
try {
 const context=await browser.newContext({viewport:{width:1100,height:1000}});
 await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:route.request().url().includes('transaction-fixture')?transactionFixture:route.request().url().includes('member-header-fixture')?memberFixture:fixture}));
 async function pageAt(url='https://www.scdmvonline.com/SCTRNS/Member/logon.aspx') {
  const page=await context.newPage();
  await page.goto(url);
  const session=await context.newCDPSession(page),{frameTree}=await session.send('Page.getFrameTree');
  const {executionContextId:id}=await session.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'SC DMV Hotkeys fixture'});worlds.set(page,{session,id});
  await worldEval(page,`window.themeEnabled=true;window.themeRequests=[];window.themeListeners=[];window.chrome={runtime:{sendMessage:async message=>{window.themeRequests.push(message);return {ok:true,value:{enabled:window.themeEnabled}};},onMessage:{addListener:fn=>window.themeListeners.push(fn)}}};`);
  return page;
 }
 const color=(page,selector,property)=>page.locator(selector).first().evaluate((element,property)=>getComputedStyle(element)[property],property);
 const palette=async page=>({body:await color(page,'body','backgroundColor'),text:await color(page,'body','color'),input:await color(page,'input.form-control','backgroundColor'),inputText:await color(page,'input.form-control','color'),primary:await color(page,'.btn-primary','backgroundColor'),heading:await color(page,'.panel-heading','backgroundColor'),link:await color(page,'#ContentPlaceHolder1_passwordforget','color'),error:await color(page,'#visibleError','backgroundColor')});
 const activate=async page=>{await page.addStyleTag({content:css});await worldEval(page,startup);await worldEval(page,controller);await page.waitForFunction(()=>document.documentElement.hasAttribute('data-scdmv-dark'));assert.equal(await worldEval(page,'globalThis.__scdmvDmvTheme.loaded'),true);};
 await test('native DMV styling matches Dark Reader neutral colors and preserves forms, menus, and image colors',async()=>{
  const page=await pageAt();await activate(page);
  assert.equal(await color(page,'body','backgroundColor'),'rgb(24, 26, 27)');assert.equal(await color(page,'body','color'),'rgb(200, 195, 188)');
  assert.equal(await color(page,'#logo','filter'),'none');assert.equal(await color(page,'html','filter'),'none');
  assert.equal(await page.locator('#ContentPlaceHolder1_userNameText').inputValue(),'FICTIONAL-USER');assert.equal(await page.locator('#ContentPlaceHolder1_passwordText').inputValue(),'fictional-password');assert.equal(await page.locator('#__VIEWSTATE').inputValue(),'synthetic-state');
  assert.equal(await page.locator('#globalTopPanel_message').isVisible(),false);await page.locator('#menuToggle').click();assert.equal(await page.locator('#menu').isVisible(),true);
  await page.locator('#ContentPlaceHolder1_loginButton').click();assert.equal(await page.evaluate(()=>window.submitted),true);
  await page.evaluate(()=>{const row=document.querySelector('tbody').insertRow();row.insertCell().textContent='New transaction';row.insertCell().textContent='Available';});
  assert.equal(await color(page,'tbody tr:last-child td','color'),'rgb(200, 195, 188)');
  await page.locator('#ContentPlaceHolder1_passwordText').fill('');await mkdir(join(root,'test-results'),{recursive:true});await page.screenshot({path:join(root,'test-results/dmv-native-dark.png'),fullPage:true});await page.close();
 });
 await test('real DMV header roles match the supplied Dark Reader screenshot without recoloring other images',async()=>{
  const page=await pageAt('https://www.scdmvonline.com/SCTRNS/Member/logon.aspx?member-header-fixture=1');await page.setViewportSize({width:1900,height:1000});
  const logoImage=await color(page,'#dmvHomeLink','backgroundImage'),link=await page.locator('#dmvHomeLink').getAttribute('href');await activate(page);
  assert.equal(await color(page,'.first-navbar','backgroundColor'),'rgb(16, 62, 112)');assert.equal(await color(page,'.navbar.pageTitle','backgroundColor'),'rgb(16, 62, 112)');
  assert.equal(await color(page,'.topnav-Logo','backgroundColor'),'rgb(24, 26, 27)');assert.equal(await color(page,'.topnav-Logo','borderBottomColor'),'rgba(0, 0, 0, 0)');
  assert.equal(await color(page,'#dmvHomeLink','filter'),'brightness(0) invert(1)');assert.equal(await color(page,'#dmvHomeLink','backgroundImage'),logoImage);assert.equal(await page.locator('#dmvHomeLink').getAttribute('href'),link);
  await page.locator('#dmvHomeLink').hover();assert.equal(await color(page,'#dmvHomeLink','backgroundColor'),'rgba(0, 0, 0, 0)');
  assert.equal(await color(page,'#globalTopPanel_header','backgroundColor'),'rgba(0, 0, 0, 0)');assert.equal(await color(page,'#globalTopPanel_header a span','color'),'rgb(178, 171, 161)');
  assert.equal(await color(page,'#driverPhoto','filter'),'none');assert.equal(await color(page,'#ContentPlaceHolder1_userNameText','boxShadow'),'none');
  // Force browser autofill to check that no inset shadow covers its native fill.
  const {session}=worlds.get(page);await session.send('DOM.enable');await session.send('CSS.enable');
  const {root:dom}=await session.send('DOM.getDocument');const {nodeId}=await session.send('DOM.querySelector',{nodeId:dom.nodeId,selector:'#ContentPlaceHolder1_userNameText'});
  await session.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:['autofill']});
  assert.equal(await color(page,'#ContentPlaceHolder1_userNameText','boxShadow'),'none');
  await page.locator('#ContentPlaceHolder1_passwordText').fill('');await page.evaluate(()=>document.activeElement?.blur());
  await mkdir(join(root,'test-results'),{recursive:true});await page.screenshot({path:join(root,'test-results/dmv-member-header-native.png'),fullPage:true});
  await page.emulateMedia({media:'print'});assert.equal(await color(page,'#dmvHomeLink','filter'),'none');
  await page.emulateMedia({media:'screen'});await worldEval(page,"window.themeEnabled=false;window.themeListeners.forEach(fn=>fn({type:'dmv-theme-changed'}));");await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-scdmv-dark'));
  assert.equal(await color(page,'#dmvHomeLink','filter'),'none');assert.equal(await color(page,'#dmvHomeLink','backgroundImage'),logoImage);await page.close();
 });
 await test('DMV footer and transaction panels retain their distinct colors and emblem without filtering report photos',async()=>{
  const page=await pageAt('https://www.scdmvonline.com/SCTRNS/Member/logon.aspx?member-header-fixture=1');
  const emblem=await color(page,'.footer-Logo','backgroundImage');await activate(page);
  assert.equal(await color(page,'.footer-Area','backgroundColor'),'rgb(34, 37, 38)');
  assert.equal(await color(page,'.footer-copyright','backgroundColor'),'rgb(16, 62, 112)');
  assert.equal(await color(page,'#copyright','color'),'rgb(232, 230, 227)');
  assert.equal(await color(page,'.footer-text-head','color'),'rgb(105, 166, 213)');
  assert.equal(await color(page,'.footer-address','color'),'rgb(105, 166, 213)');
  assert.equal(await color(page,'.footer-Area a','color'),'rgb(105, 166, 213)');
  assert.equal(await color(page,'.footer-Logo','filter'),'brightness(0) invert(1)');
  assert.equal(await color(page,'.footer-Logo','backgroundImage'),emblem);
  assert.equal(await color(page,'.panel-primary','borderTopColor'),'rgb(36, 106, 166)');
  assert.equal(await color(page,'.panel-primary>.panel-heading','backgroundColor'),'rgb(16, 62, 112)');
  assert.equal(await color(page,'#driverPhoto','filter'),'none');
  await page.setViewportSize({width:1900,height:1300});await mkdir(join(root,'test-results'),{recursive:true});await page.screenshot({path:join(root,'test-results/dmv-footer-native.png'),fullPage:true});
  await page.emulateMedia({media:'print'});assert.equal(await color(page,'.footer-Logo','filter'),'none');
  assert.equal(await color(page,'.footer-copyright','backgroundColor'),'rgb(20, 78, 139)');await page.close();
 });
 const transactionPalette=async page=>{
  const roles={primary:['#ContentPlaceHolder1_btnPrint','backgroundColor'],primaryBorder:['#ContentPlaceHolder1_btnPrint','borderTopColor'],primaryText:['#ContentPlaceHolder1_btnPrint','color'],success:['#downloadButton','backgroundColor'],successBorder:['#downloadButton','borderTopColor'],receipt:['#ContentPlaceHolder1_referenceNbrBox_DisplayOnly','color'],label:['.receipt label','color'],navigation:['#navigationFooter','backgroundColor'],navigationBorder:['#navigationFooter','borderTopColor'],pageNumber:['#pageNumberText','color'],head:['table.dataTable thead','backgroundColor'],headText:['table.dataTable th','color'],odd:['table.dataTable tbody tr.odd','backgroundColor'],even:['table.dataTable tbody tr.even','backgroundColor'],cell:['table.dataTable td','backgroundColor'],cellText:['table.dataTable td','color'],customerLink:['table.dataTable td a','color'],tableBorder:['table.dataTable','borderBottomColor']};
  const result={};for(const [key,[selector,property]] of Object.entries(roles))result[key]=await color(page,selector,property);return result;
 };
 await test('transaction receipt, buttons, results rows and fixed footer match an actual Dark Reader rendering',async()=>{
  const url='https://www.scdmvonline.com/SCTRNS/Member/Transactions/DrvCert/Page2.aspx?transaction-fixture=1';
  const reference=await pageAt(url);await reference.addScriptTag({path:darkReaderPath});await reference.evaluate(()=>DarkReader.enable({brightness:100,contrast:100,sepia:0}));
  await reference.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(24, 26, 27)');await reference.waitForTimeout(100);
  const expected=await transactionPalette(reference),page=await pageAt(url);await activate(page);
  assert.deepEqual(await transactionPalette(page),expected);
  for(const selector of ['#ContentPlaceHolder1_btnPrint','#downloadButton']) {
   await reference.locator(selector).hover();await page.locator(selector).hover();
   assert.equal(await color(page,selector,'backgroundColor'),await color(reference,selector,'backgroundColor'),`${selector} hover`);
  }
  await reference.mouse.move(0,0);await page.mouse.move(0,0);
  // Page state (including a hidden Finish control) must remain owned by the portal.
  await page.locator('#btnFooterNavNext').evaluate(element=>element.style.display='none');assert.equal(await page.locator('#btnFooterNavNext').isVisible(),false);
  await page.locator('#btnFooterNavPrevious').click();assert.equal(await page.evaluate(()=>window.lastClicked),'btnFooterNavPrevious');
  await page.locator('#downloadButton').click();assert.equal(await page.evaluate(()=>window.lastClicked),'downloadButton');
  await page.locator('#ContentPlaceHolder1_btnPrint').click();assert.equal(await page.evaluate(()=>window.lastClicked),'ContentPlaceHolder1_btnPrint');
  await page.mouse.move(0,0);await page.locator('#ContentPlaceHolder1_btnPrint').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.equal(await color(page,'#ContentPlaceHolder1_btnPrint','outlineStyle'),'solid');
  await page.evaluate(()=>document.activeElement.blur());await mkdir(join(root,'test-results'),{recursive:true});await page.screenshot({path:join(root,'test-results/dmv-transaction-native.png'),fullPage:true});await reference.screenshot({path:join(root,'test-results/dmv-transaction-darkreader.png'),fullPage:true});
  // Competing CSS cannot reintroduce the white result row or change DMV button colors.
  await page.addStyleTag({content:'html body form table.dataTable.display tbody tr.odd{background:white!important;color:black!important}html body form button.iFormsButton.btn-success{background:white!important;color:black!important}'});
  assert.deepEqual(await transactionPalette(page),expected);
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('#navigationFooter').isVisible(),false);assert.equal(await color(page,'.receipt span.iForms_Textbox','color'),'rgb(51, 122, 183)');await page.close();await reference.close();
 });
 await test('DataTables filtering, sorting and late row redraws stay readable without altering customer links',async()=>{
  const page=await pageAt('https://www.scdmvonline.com/SCTRNS/Member/Transactions/DrvCert/Page2.aspx?transaction-fixture=1&view=search');await activate(page);
  const reference=await pageAt('https://www.scdmvonline.com/SCTRNS/Member/Transactions/DrvCert/Page2.aspx?transaction-fixture=1&view=search');
  await reference.addScriptTag({path:darkReaderPath});await reference.evaluate(()=>DarkReader.enable({brightness:100,contrast:100,sepia:0}));await reference.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(24, 26, 27)');
  const table=page.locator('table.dataTable'),link=await table.locator('tbody a').first().getAttribute('href');
  await page.locator('input[type=search]').fill('SAMPLE');assert.equal(await table.locator('tbody tr:visible').count(),1);await page.locator('input[type=search]').fill('');
  await table.locator('thead th').first().click();assert.equal(await table.locator('tbody a').first().textContent(),'22222222');assert.equal(await table.locator('tbody a').last().getAttribute('href'),link);
  await page.evaluate(()=>{const body=document.querySelector('tbody');body.insertAdjacentHTML('beforeend','<tr class="odd"><td><a href="#third">33333333</a></td><td>FICTIONAL</td><td>NEW</td><td>789 EXAMPLE WAY</td><td>COLUMBIA</td></tr>');});
  await reference.locator('thead th').first().click();await reference.mouse.move(0,0);await page.mouse.move(0,0);
  assert.equal(await color(page,'tbody tr.odd .sorting_1','backgroundColor'),await color(reference,'tbody tr.odd .sorting_1','backgroundColor'));
  await reference.screenshot({path:join(root,'test-results/dmv-search-results-darkreader.png'),fullPage:true});await reference.close();
  assert.equal(await color(page,'tbody tr:last-child','backgroundColor'),'rgb(30, 32, 33)');assert.equal(await color(page,'tbody tr:last-child td','color'),'rgb(200, 195, 188)');
  assert.equal(await color(page,'thead','backgroundColor'),'rgba(0, 0, 0, 0)');assert.equal(await page.locator('#btnFooterNavNext').isVisible(),true);
  await page.screenshot({path:join(root,'test-results/dmv-search-results-native.png'),fullPage:true});await page.close();
 });
 await test('an active Dark Reader engine yields to the native lock and cannot invert images or replace the theme when enabled again',async()=>{
  const page=await pageAt();await page.addScriptTag({path:darkReaderPath});await page.evaluate(()=>DarkReader.enable({brightness:100,contrast:100,sepia:0}));
  await page.waitForFunction(()=>document.documentElement.dataset.darkreaderMode==='dynamic');
  const reference=await palette(page);await activate(page);
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-darkreader-mode'));
  const native=await palette(page);assert.equal(native.body,reference.body);assert.equal(native.text,reference.text);assert.equal(native.input,reference.input);assert.equal(native.inputText,reference.inputText);assert.equal(native.primary,reference.primary);assert.equal(native.heading,reference.heading);assert.equal(native.link,reference.link);assert.equal(native.error,reference.error);
  
  await page.evaluate(()=>DarkReader.enable({brightness:80,contrast:110,sepia:20}));await page.waitForTimeout(100);
  assert.deepEqual(await palette(page),native);assert.equal(await color(page,'#logo','filter'),'none');assert.equal(await page.locator('meta[name="darkreader-lock"]').count(),1);
  // Removing the lock in a head replacement restores our own lock, without touching page content.
  await page.locator('#scdmv-darkreader-lock').evaluate(element=>element.remove());await page.waitForFunction(()=>!!document.querySelector('#scdmv-darkreader-lock'));
  await page.close();
 });
 await test('generic competing theme styles and inversion filters cannot replace native colors after page load',async()=>{
  const page=await pageAt();await activate(page);const expected=await palette(page);
  await page.addStyleTag({content:`html{filter:invert(1)!important;backdrop-filter:invert(1)!important}html body main.container div.panel div.panel-body #form1 input#ContentPlaceHolder1_userNameText{background-color:white!important;color:black!important}html body div.panel{filter:invert(1)!important;mix-blend-mode:difference!important}html body nav.navbar{background-color:white!important;color:black!important}html body img#logo{filter:invert(1) hue-rotate(180deg)!important}`});
  assert.deepEqual(await palette(page),expected);assert.equal(await color(page,'html','filter'),'none');assert.equal(await color(page,'.panel','filter'),'none');assert.equal(await color(page,'.panel','mixBlendMode'),'normal');assert.equal(await color(page,'#logo','filter'),'none');
  // A late layer of important rules also yields to our earlier important layer.
  await page.addStyleTag({content:'@layer another-night-theme{html body{background:white!important;color:black!important}}'});assert.deepEqual(await palette(page),expected);await page.close();
 });
 await test('turning off native styling restores site colors and removes only its own Dark Reader lock',async()=>{
  const page=await pageAt();const light=await palette(page);await activate(page);
  await worldEval(page,"window.themeEnabled=false;window.themeListeners.forEach(fn=>fn({type:'dmv-theme-changed'}));");
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-scdmv-dark'));assert.deepEqual(await palette(page),light);assert.equal(await page.locator('#scdmv-darkreader-lock').count(),0);
  await worldEval(page,"window.themeEnabled=true;window.themeListeners.forEach(fn=>fn({type:'dmv-theme-changed'}));");await page.waitForFunction(()=>document.documentElement.hasAttribute('data-scdmv-dark'));assert.equal(await color(page,'body','backgroundColor'),'rgb(24, 26, 27)');await page.close();
 });
 await test('portal dark mode does not run on SCUTTIES, other websites, or native DMV attachment pages',async()=>{
  for(const url of ['https://scutties.example.test/','https://www.scdmvonline.com.example.org/','https://www.scdmvonline.com/SCTRNS/Member/Transactions/ViewAttachment.aspx','https://www.scdmvonline.com/SCTRNS/Member/Transactions/viewattachment.aspx?test=1']) {
   const page=await pageAt(url);await page.addStyleTag({content:css});await worldEval(page,startup);await worldEval(page,controller);
   assert.equal(await page.locator('html[data-scdmv-dark]').count(),0);assert.equal(await worldEval(page,'window.themeRequests.length'),0);assert.equal(await color(page,'body','backgroundColor'),'rgb(255, 255, 255)');await page.close();
  }
 });
 await test('portal styles are screen-only and leave the website print appearance intact',async()=>{
  const page=await pageAt();await activate(page);await page.emulateMedia({media:'print'});
  assert.equal(await color(page,'body','backgroundColor'),'rgb(255, 255, 255)');assert.equal(await color(page,'body','color'),'rgb(51, 51, 51)');await page.close();
 });
 console.log(`${passed} DMV theme browser checks passed.`);
} finally {await browser.close();}
