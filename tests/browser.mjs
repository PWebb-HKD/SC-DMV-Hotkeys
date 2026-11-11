// Real Chrome regression harness served from localhost; website pages are fixtures, not live queries.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dependency} from './runtime.mjs';
import {pageOperation} from '../extension/page.js';
import {search, scutties} from '../extension/automation.js';
import {ROOT, MEMBER, LOGIN, DISCLAIMER, PDF_URL, ownerNumbers, isResidenceReport} from '../extension/core.js';
import {reportBarcode} from '../extension/barcode-data.js';
import {plateStatus, licenseStatus} from '../extension/status-alerts.js';
import {RECORDING_PATHS} from '../extension/voice-recordings.js';
const {chromium} = dependency('playwright');
const {PDFDocument, StandardFonts, degrees} = dependency('pdf-lib');
const root = fileURLToPath(new URL('../', import.meta.url));
const errorFixture=await readFile(join(root,'tests/fixtures/dmv-error.html'),'utf8');
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
const screenshots = join(root, 'test-results'); await mkdir(screenshots, {recursive: true});
let passed = 0;
const tests = async (name, fn) => { if(process.env.BROWSER_TEST_FILTER&&!name.includes(process.env.BROWSER_TEST_FILTER))return; await fn(); passed++; console.log(`PASS ${name}`); };
const event=()=>({listeners:new Set(),addListener(fn){this.listeners.add(fn);},removeListener(fn){this.listeners.delete(fn);},emit(...args){for(const fn of this.listeners)fn(...args);}});
try {
  const context = await browser.newContext();
  let nextId = 1, clock = 100, activated = [], windowsUpdated = [], submissions = [], loginClicks = 0, invalid = false, loginInvalid = false, plateRadio = false, credentialPrompts = 0, autofillMode = '', disclaimerClicks = 0, loginElapsed = 0, resultMode = 'new', loginDestination = DISCLAIMER;
  let transactionRedirects=0, brokenTransactions=false, logoffClicks=0, transactionRedirectTarget=`${MEMBER}Transactions/TransactionList.aspx`;
  const navigation = [], loginFills = [];
  let loginEvents = [], loginReapplied = [], loginWasFocused = false, loginSubmitted;
  const tabs = new Map(), local = {}, session = {}, permissions = new Set([`${ROOT}/*`]);
  let latestPdf = null, serverFailureStage='';
  // Render transaction-specific local pages; their event handlers report actions to the browser mock.
  const render = async (page, url) => {
    const u = new URL(url); let html = '';
    if(u.pathname.endsWith('/ErrorPage.aspx'))return errorFixture;
    if (u.pathname.endsWith('/logon.aspx')) html = `<input id="ContentPlaceHolder1_userNameText"><input id="ContentPlaceHolder1_passwordText" type="password"><button id="ContentPlaceHolder1_loginButton">Log in</button>`;
    else if (u.pathname.endsWith('/Disclaimer.aspx')) html = '<button id="accept">I Agree</button>';
    else if (u.pathname.endsWith('/TransactionList.aspx') && brokenTransactions) html = '<div id="ContentPlaceHolder1_menuContainer"><div><div><div><div class="panel-body"><ul><li><a id="logoff" href="#">Log off</a></li></ul></div></div></div></div></div>';
    else if (u.pathname.endsWith('/TransactionList.aspx')) html = '<a href="/SCTRNS/Member/Transactions/SCUTTIES/SCUTTIES.aspx">SCUTTIES</a>';
    else if (u.pathname.includes('/SCUTTIES/')) html = '<div id="home"><input id="last"><input id="dob"><button id="go">Search</button></div>';
    else if (u.pathname.endsWith('/Page1.aspx')) html = `<input id="ContentPlaceHolder1_rblReportType_0" type="radio"><input id="ContentPlaceHolder1_txtPlateNbr"><input id="ContentPlaceHolder1_dlNumberTextBox"><input id="ContentPlaceHolder1_idNumberTextBox"><input id="ContentPlaceHolder1_txtDLNumber"><button id="btnFooterNavNext">Next</button>`;
    else if (u.pathname.endsWith('/Page2.aspx')) html = '<button id="downloadButton">Open PDF</button>';
    else html = 'Fixture PDF result';
    return `<!doctype html><html><body><div id="form1"><div class="container"><div class="iFormsValidationSummary alert alert-danger"><ul><li><span id="validation"></span></li></ul></div>${html}</div></div><script>
      const button = document.querySelector('#ContentPlaceHolder1_loginButton');
      if(button) {
        const loadedAt=performance.now();
        const mode=${JSON.stringify(autofillMode)};
        const fields=[document.querySelector('#ContentPlaceHolder1_userNameText'),document.querySelector('#ContentPlaceHolder1_passwordText')];
        const fieldEvents=[],reapplied=[];
        const nativeValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
        for(const field of fields)Object.defineProperty(field,'value',{
          get(){return nativeValue.get.call(this);},
          set(value){if(document.activeElement===this)reapplied.push({id:this.id,empty:value===''});nativeValue.set.call(this,value);}
        });
        for(const type of ['focusin','input','change','keyup','blur','focusout'])document.querySelector('#form1').addEventListener(type,event=>{
          if(fields.includes(event.target))fieldEvents.push({id:event.target.id,type:event.type,bubbles:event.bubbles,focused:document.activeElement===event.target,at:performance.now()-loadedAt});
        });
        if(mode==='filled')fields.forEach((el,i)=>el.value=i?'wrong-browser-password':'wrong-browser-user');
        if(['delayed','early','last-moment'].includes(mode))setTimeout(()=>fields.forEach((el,i)=>el.value=i?'wrong-browser-password':'wrong-browser-user'),mode==='early'?700:mode==='last-moment'?1050:900);
        if(mode==='concealed'||mode==='early')for(const el of fields){const original=el.matches.bind(el);el.matches=selector=>{if(selector===':autofill'||selector===':-webkit-autofill')throw new Error('Browser autofill must not be inspected');return original(selector);};}
        button.onclick=()=>{
          if(!fields.every(field=>['input','change'].every(type=>fieldEvents.some(event=>event.id===field.id&&event.type===type&&event.bubbles&&event.focused)))){
            document.querySelector('#validation').textContent='Login fields were not synchronized while focused';return;
          }
          return window.fixture('login', {user:fields[0].value,password:fields[1].value,elapsed:performance.now()-loadedAt,events:fieldEvents,reapplied});
        };
      }
      const accept = document.querySelector('#accept'); if(accept)accept.onclick=()=>window.fixture('accept');
      const radio = document.querySelector('#ContentPlaceHolder1_rblReportType_0'); if(radio)radio.onclick=()=>window.fixture('radio');
      const next = document.querySelector('#btnFooterNavNext'); if(next)next.onclick=()=>window.fixture('next',Object.fromEntries([...document.querySelectorAll('input')].map(x=>[x.id,x.value])));
      const download = document.querySelector('#downloadButton'); if(download)download.onclick=()=>window.fixture('download');
      const logoff=document.querySelector('#logoff');if(logoff)logoff.onclick=e=>{e.preventDefault();window.fixture('logoff');};
      const link = document.querySelector('a'); if(link&&!logoff)link.onclick=e=>{e.preventDefault();window.fixture('scutties')};
    <\/script></body></html>`;
  };
  await context.route(`${ROOT}/**`, async route => {
    navigation.push(route.request().url());
    const page = route.request().frame().page();
    await route.fulfill({contentType: 'text/html', body: await render(page, route.request().url())});
  });
  /** Create a local fixture page and attach browser events to its simulated extension tab identity. */
  async function createTab(url, active = false, openerTabId) {
    const id = nextId++, page = await context.newPage();
    const tab = {id, url, active, openerTabId, windowId: 1, status: 'loading', lastAccessed: clock++};
    tabs.set(id, {tab, page});
    await page.exposeFunction('fixture', async (action, payload) => {
      if (action === 'logoff') {
        logoffClicks++;assert.equal(session.lastQuery,0);brokenTransactions=false;await updateTab(id,{url:LOGIN});
      } else if (action === 'login') {
        loginWasFocused=tab.active&&windowsUpdated.at(-1)?.focused===true;
        loginClicks++; loginElapsed=payload.elapsed; loginEvents=payload.events; loginReapplied=payload.reapplied;
        loginSubmitted={user:payload.user,password:payload.password};
        if (loginInvalid) { await page.locator('#validation').evaluate(el => el.textContent = 'Invalid User ID Or Password'); return; }
        assert.deepEqual(loginSubmitted,{user:'fictional-user',password:'fictional-password'}); await updateTab(id, {url: loginDestination});
      } else if (action === 'accept') { disclaimerClicks++; await updateTab(id, {url: `${MEMBER}Transactions/TransactionList.aspx`}); }
      else if (action === 'radio') plateRadio = true;
      else if (action === 'next') {
        submissions.push(payload);
        if(serverFailureStage==='submit'){await updateTab(id,{url:MEMBER+'ErrorPage.aspx'});return;}
        if (invalid) await page.locator('#validation').evaluate(el => el.textContent = 'Invalid search number');
        else await updateTab(id, {url: tab.url.replace('Page1.aspx','Page2.aspx')});
      } else if (action === 'download') {
        if(serverFailureStage.startsWith('download-')) {
          if(serverFailureStage==='download-same')await updateTab(id,{url:MEMBER+'ErrorPage.aspx'});
          else if(serverFailureStage==='download-reuse')await updateTab(latestPdf.id,{url:MEMBER+'ErrorPage.aspx'});
          else latestPdf=await createTab(MEMBER+'ErrorPage.aspx',false,id);
          return;
        }
        if(resultMode==='reuse') {
          const reuse=tabs.get(latestPdf.id).tab;reuse.status='loading';
          chrome.tabs.onUpdated.emit(reuse.id,{status:'loading'},reuse);
          reuse.status='complete';
          chrome.tabs.onUpdated.emit(reuse.id,{status:'complete'},reuse);
        } else {
          latestPdf = await createTab(PDF_URL, false, id);
          if(resultMode==='loading')tabs.get(latestPdf.id).tab.status='loading';
        }
      }
      else if (action === 'scutties') {
        // The transaction link establishes the DMV session before opening the SCUTTIES form.
        await updateTab(id, {url: MEMBER+'Transactions/SCUTTIES/Search.aspx'});
      }
    });
    chrome.tabs.onCreated.emit({...tab});
    await page.goto(url); tab.status = 'complete'; return {...tab};
  }
  /** Model redirects and tab notifications while preserving the focus state checked by automation. */
  async function updateTab(id, update) {
    const record = tabs.get(id); if (!record) throw new Error('No tab');
    if (update.url) {
      record.tab.status = 'loading'; record.tab.url = update.url;
      chrome.tabs.onUpdated.emit(id,{url:update.url,status:'loading'},{...record.tab});
      let destination=update.url;
      // Model the server redirect locally; never let fixtures follow a live HTTP redirect.
      if(transactionRedirects>0&&destination.includes('/Page1.aspx')){transactionRedirects--;destination=transactionRedirectTarget;brokenTransactions=destination===`${MEMBER}Transactions/TransactionList.aspx`;}
      await record.page.goto(destination); record.tab.url=record.page.url(); record.tab.status = 'complete';
      chrome.tabs.onUpdated.emit(id,{status:'complete'},{...record.tab});
    }
    if (update.active) { activated.push(id); for (const r of tabs.values()) r.tab.active = r.tab.id === id; }
    return {...record.tab};
  }
  await context.route(`${MEMBER}Transactions/SCUTTIES/Search.aspx`, route => route.fulfill({contentType:'text/html',body:`<div id="home"><div><div class="col-xs-12 row"><div></div><div></div><div><div class="panel-body"><div><div><input id="last"></div><div><input id="dob"></div><div class="col-xs-8"><button>Other</button><button id="scSearch" disabled>Search</button></div></div></div></div></div></div></div><script>
    window.events=[];window.formModel={};window.delegatedEvents=[];
    const last=document.querySelector('#last'),dob=document.querySelector('#dob'),search=document.querySelector('#scSearch');
    for(const type of ['input','change','keyup','blur'])document.querySelector('#home').addEventListener(type,event=>{
      if(![last,dob].includes(event.target))return;
      window.events.push(type);window.delegatedEvents.push({id:event.target.id,type,bubbles:event.bubbles,complete:!!(last.value&&dob.value)});
      if(type==='input'&&last.value&&dob.value){const id=event.target.id,value=event.target.value;setTimeout(()=>{window.formModel[id]=value;search.disabled=!(window.formModel.last&&window.formModel.dob);},30);}
    });
    search.onclick=()=>{window.didSearch=true;window.submittedModel={...window.formModel};};
    <\/script>`}));
  globalThis.chrome = {
    storage: {
      local: {get: async () => local, set: async x => Object.assign(local,x)},
      session: {get: async () => session, set: async x => Object.assign(session,x)}
    },
    tabs: {
      query: async opts => [...tabs.values()].map(r => ({...r.tab})).filter(t => !opts.url || t.url.startsWith(ROOT)),
      get: async id => ({...tabs.get(id).tab}),
      create: opts => createTab(opts.url,opts.active,opts.openerTabId), update: updateTab,
      onCreated:event(),onUpdated:event()
    },
    windows: {get: async () => ({id:1,state:'minimized'}), update: async (id, data) => { windowsUpdated.push(data); }},
    scripting: {executeScript: async ({target,func,args}) => {
      assert.equal(tabs.get(target.tabId).tab.active,true,'Automation must activate the working tab before DOM access');
      assert.equal(windowsUpdated.at(-1)?.focused,true,'Automation must focus the working window before DOM access');
      if(args[0]==='extensionLogin'&&!args[1].submit)loginFills.push(...args[1].selectors);
      return [{result: await tabs.get(target.tabId).page.evaluate(`(${func.toString()})(...${JSON.stringify(args)})`)}];
    }},
    permissions: {contains: async ({origins}) => origins.every(o => permissions.has(o))}
  };
  const ctx = {
    status: () => {}, credentials: async () => {credentialPrompts++; return {user:'fictional-user',password:'fictional-password'};}
  };
  await tests('plate: extension-only login focuses the login tab and window before submitting', async () => {
    const result = await search('plate','ABC12345',ctx);
    assert.equal(loginClicks,1); assert.equal(credentialPrompts,1); assert.equal(plateRadio,true);
    assert.equal(submissions.at(-1).ContentPlaceHolder1_txtPlateNbr,'ABC12345');
    assert.equal(loginWasFocused,true);
    assert.equal(activated.at(-1),result.tabId);assert.ok(activated.slice(0,-1).every(id=>id===result.portalId));
    assert.ok(activated.includes(result.portalId));assert.ok(windowsUpdated.some(change=>change.focused));
    assert.equal(disclaimerClicks,0);
    assert.equal(navigation[navigation.indexOf(DISCLAIMER)+1],`${MEMBER}Transactions/VehRec/Page1.aspx`);
  });
  await tests('customer: focuses the portal from an unrelated tab with a fresh session, excluding PDF', async () => {
    await context.route('https://unrelated.fixture.test/**', route=>route.fulfill({contentType:'text/html',body:'Unrelated tab'}));
    const unrelated=await createTab('https://unrelated.fixture.test/',false);
    await updateTab(unrelated.id,{active:true});
    const focusBefore=activated.length;
    const before = tabs.size; await search('customer','12345678',ctx);
    assert.equal(loginClicks,1); assert.equal(tabs.size,before+1);
    assert.equal(activated[focusBefore],session.portalId);
    assert.equal(submissions.at(-1).ContentPlaceHolder1_idNumberTextBox,'12345678');
  });
  await tests('DL and same-address searches target their transaction fields', async () => {
    await search('license','123456789',ctx);
    assert.equal(submissions.at(-1).ContentPlaceHolder1_dlNumberTextBox,'123456789');
    await search('address','987654321',ctx);
    assert.equal(submissions.at(-1).ContentPlaceHolder1_txtDLNumber,'987654321');
  });
  await tests('validation errors stop the workflow before PDF results', async () => {
    invalid = true; const before = activated.length;
    await assert.rejects(search('customer','12345678',ctx), {name:'PortalSearchError',message:'Invalid search number'});
    assert.deepEqual(activated.slice(before),[session.portalId]); invalid = false;
  });
  await tests('expired query age forces login and displays site login errors', async () => {
    session.lastQuery = Date.now()-600001; loginInvalid = true;
    await assert.rejects(search('plate','ABC',ctx), /Invalid User ID Or Password/);
    assert.equal(loginClicks,2); loginInvalid = false;
  });
  await tests('SCUTTIES follows the DMV transaction link without extra permissions and emits framework input events', async () => {
    session.lastQuery = Date.now();
    // Reset portal to a valid authenticated page after the invalid-login case.
    await updateTab(session.portalId,{url:`${MEMBER}Transactions/TransactionList.aspx`});
    await scutties({lastName:'DE LA CRUZ',dob:'01/02/2000'},ctx);
    const page = tabs.get(session.portalId).page;
    assert.equal(await page.locator('#last').inputValue(),'DE LA CRUZ');
    assert.equal(await page.locator('#dob').inputValue(),'01/02/2000');
    assert.equal(await page.evaluate(() => window.didSearch),true);
    assert.ok((await page.evaluate(() => window.events)).includes('keyup'));
    assert.deepEqual(await page.evaluate(() => window.submittedModel),{last:'DE LA CRUZ',dob:'01/02/2000'});
    const delegated=await page.evaluate(() => window.delegatedEvents);
    for(const id of ['last','dob'])for(const type of ['input','change','keyup','blur']) {
      assert.ok(delegated.some(event=>event.id===id&&event.type===type&&event.bubbles&&event.complete),`${id} must notify the parent after both fields have values`);
    }
    assert.deepEqual([...permissions],[`${ROOT}/*`]);
  });
  for (const mode of ['filled','delayed','concealed','early','last-moment']) {
    await tests(`extension-only login replaces ${mode} browser autofill with extension credentials`,async()=>{
      autofillMode=mode;session.lastQuery=0;
      await updateTab(session.portalId,{url:LOGIN});
      const beforePrompts=credentialPrompts, beforeFills=loginFills.length;
      const beforeVisits=navigation.filter(url=>url===LOGIN).length;
      await search('customer','12345678',ctx);
      assert.equal(credentialPrompts,beforePrompts+1);assert.equal(loginFills.length,beforeFills+2);
      assert.equal(navigation.filter(url=>url===LOGIN).length,beforeVisits);
      assert.equal(disclaimerClicks,0);
      assert.ok(loginElapsed>=950,'Keep the one-second form synchronization delay.');
      assert.deepEqual(loginSubmitted,{user:'fictional-user',password:'fictional-password'});
    });
  }
  await tests('extension login dispatches bubbling field events and retains the submit delay',async()=>{
    autofillMode='filled';session.lastQuery=0;await updateTab(session.portalId,{url:LOGIN});
    const beforeFills=loginFills.length;
    await search('customer','12345678',ctx);
    for(const id of ['ContentPlaceHolder1_userNameText','ContentPlaceHolder1_passwordText']) {
      const events=loginEvents.filter(event=>event.id===id);
      assert.deepEqual(events.map(event=>event.type),['focusin','input','change','focusout']);
      assert.ok(events.filter(event=>['input','change'].includes(event.type)).every(event=>event.bubbles&&event.focused));
    }
    assert.ok(loginElapsed-loginEvents.at(-1).at>=90,'Allow at least 100 ms for framework synchronization, with timer tolerance.');
    assert.equal(loginFills.length,beforeFills+2,'Both fields must always be filled by the extension.');
  });
  await tests('missing extension credentials never fall back to populated browser fields',async()=>{
    for(const value of [null,{user:'',password:'extension-password'}]){
      autofillMode='filled';session.lastQuery=0;await updateTab(session.portalId,{url:LOGIN});
      const clicks=loginClicks;
      await assert.rejects(search('customer','12345678',{...ctx,credentials:async()=>value}),/cancelled|required/);
      assert.equal(loginClicks,clicks);
    }
  });
  await tests('an already-loaded disclaimer goes straight to the requested form without login or acknowledgement',async()=>{
    session.lastQuery=Date.now();await updateTab(session.portalId,{url:DISCLAIMER});
    const before=loginClicks;await search('license','123456789',ctx);
    assert.equal(loginClicks,before);assert.equal(disclaimerClicks,0);
  });
  await tests('completed non-error SCDMV redirects away from logon verify login, not just Disclaimer.aspx',async()=>{
    loginDestination=`${ROOT}/SCTRNS/Member/Home.aspx`;session.lastQuery=0;
    await updateTab(session.portalId,{url:LOGIN});
    const before=loginClicks;
    await search('customer','12345678',ctx);
    assert.equal(loginClicks,before+1);
    assert.ok(navigation.includes(loginDestination));loginDestination=DISCLAIMER;
  });
  await tests('login completed during the extension submit delay continues without a second login click',async()=>{
    for(const delay of [300,1050]){
      autofillMode='filled';session.lastQuery=0;await updateTab(session.portalId,{url:LOGIN});
      const before=loginClicks;
      const manual=new Promise((resolve,reject)=>setTimeout(()=>updateTab(session.portalId,{url:DISCLAIMER}).then(resolve,reject),delay));
      await search('customer','12345678',ctx);await manual;
      assert.equal(loginClicks,before);
    }
  });
  for(const mode of ['loading','reuse']) {
    await tests(`results tab: focuses ${mode} PDF results without waiting for a new complete tab`,async()=>{
      resultMode=mode;const previous=latestPdf.id;
      const result=await search('customer','12345678',ctx);
      assert.equal(activated.at(-1),result.tabId);
      if(mode==='reuse')assert.equal(result.tabId,previous);
      resultMode='new';
    });
  }
  await tests('warm plate search recovers from an empty transaction menu by logging off and retrying after login',async()=>{
    await updateTab(session.portalId,{url:DISCLAIMER});session.lastQuery=Date.now();
    const before={login:loginClicks,logoff:logoffClicks,submits:submissions.length};transactionRedirects=1;
    const result=await search('plate','REC123',ctx);
    assert.equal(logoffClicks,before.logoff+1);assert.equal(loginClicks,before.login+1);
    assert.equal(submissions.length,before.submits+1);
    assert.equal(submissions.at(-1).ContentPlaceHolder1_txtPlateNbr,'REC123');
    assert.equal(activated.at(-1),result.tabId);assert.ok(session.lastQuery>0);
  });
  await tests('unexpected first search page returns directly to login and retries without logoff',async()=>{
    session.lastQuery=Date.now();transactionRedirects=1;transactionRedirectTarget=`${MEMBER}Unexpected.aspx`;
    const before={login:loginClicks,logoff:logoffClicks,submits:submissions.length};
    const result=await search('customer','11223344',ctx);
    assert.equal(logoffClicks,before.logoff);assert.equal(loginClicks,before.login+1);
    assert.equal(submissions.length,before.submits+1);
    assert.equal(submissions.at(-1).ContentPlaceHolder1_idNumberTextBox,'11223344');
    assert.equal(activated.at(-1),result.tabId);assert.ok(session.lastQuery>0);
  });
  await tests('generic portal error DOM exposes the public message while ignoring hidden validation summaries',async()=>{
    const page=await context.newPage();await page.goto(MEMBER+'ErrorPage.aspx');
    const state=await page.evaluate(pageOperation,'state');assert.equal(state.portalError,true);assert.deepEqual(state.errors,['An unexpected error occurred']);
    await page.locator('#ContentPlaceHolder1_errorMessagePublicText').evaluate(element=>element.hidden=true);
    const hidden=await page.evaluate(pageOperation,'state');assert.equal(hidden.portalError,false);assert.deepEqual(hidden.errors,[]);await page.close();
  });
  await tests('generic portal error before submission recovers once through login and does not duplicate the query',async()=>{
    const source=await createTab(DISCLAIMER,true);session.portalId=source.id;session.lastQuery=Date.now();transactionRedirects=1;transactionRedirectTarget=MEMBER+'ErrorPage.aspx';
    const before=submissions.length;await search('customer','11000001',ctx);assert.equal(submissions.length,before+1);
    transactionRedirects=2;session.lastQuery=Date.now();const retryStart=submissions.length;
    await assert.rejects(search('customer','11000002',ctx),/An unexpected error occurred/);assert.equal(submissions.length,retryStart);assert.equal(session.lastQuery,0);assert.equal(transactionRedirects,0);
  });
  await tests('generic portal error after submission stops immediately and the next query requires login',async()=>{
    const source=await createTab(DISCLAIMER,true);session.portalId=source.id;session.lastQuery=Date.now();serverFailureStage='submit';const before=submissions.length;
    try {await assert.rejects(search('customer','11000003',ctx),{name:'PortalSearchError',message:'An unexpected error occurred'});assert.equal(submissions.length,before+1);assert.equal(session.lastQuery,0);}
    finally {serverFailureStage='';}
    const logins=loginClicks;await search('customer','11000004',ctx);assert.equal(loginClicks,logins+1);assert.equal(submissions.length,before+2);
  });
  await tests('generic portal error during PDF download is detected in same, new and reused tabs',async()=>{
    for(const stage of ['download-same','download-new','download-reuse']) {
      const source=await createTab(DISCLAIMER,true);session.portalId=source.id;session.lastQuery=Date.now();
      if(stage==='download-reuse')latestPdf=await createTab(PDF_URL,false,source.id);
      serverFailureStage=stage;const before=submissions.length;
      try {await assert.rejects(search('customer','11000005',ctx),{name:'PortalSearchError',message:'An unexpected error occurred'});assert.equal(submissions.length,before+1);assert.equal(session.lastQuery,0);if(stage!=='download-same')assert.equal(ctx.tabId,latestPdf.id);}
      finally {serverFailureStage='';}
    }
  });
  await tests('generic portal error during login is surfaced instead of being accepted as login success',async()=>{
    const source=await createTab(LOGIN,true);session.portalId=source.id;session.lastQuery=0;loginDestination=MEMBER+'ErrorPage.aspx';const before=submissions.length;
    try {await assert.rejects(search('customer','11000006',ctx),{name:'Error',message:'An unexpected error occurred'});assert.equal(submissions.length,before);assert.equal(session.lastQuery,0);}
    finally {loginDestination=DISCLAIMER;}
  });
  await context.close();

  const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mjs':'text/javascript','.mp3':'audio/mpeg'};
  const server = createServer(async (req,res) => {
    const path = new URL(req.url,'http://localhost').pathname;
    try { const body = await readFile(join(root,'extension',path)); res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const ui = await browser.newContext({viewport:{width:540,height:900},deviceScaleFactor:1});
  await ui.addInitScript(() => {
    window.requests=[];window.runtimeListeners=[];
    window.panelClosed=false;window.close=()=>{window.panelClosed=true;};
    window.openedTabs=[];
    window.sessionAlerts=false;window.pdfDarkMode=false;window.dmvDarkMode=true;window.blacklistData={hasVault:false,unlocked:false,entries:[]};window.historyErrors=[];window.storageListeners=[];
    window.audioSettings={};
    window.commandShortcuts=[{name:'plate',shortcut:'Ctrl+Shift+7'},{name:'next',shortcut:'Alt+N'},{name:'_execute_action',shortcut:'Alt+Period'}];
    window.chrome = {
      runtime:{onMessage:{addListener:fn=>window.runtimeListeners.push(fn)},getURL:path=>`${location.origin}/${path}`,connect:()=>({postMessage:()=>{}}),sendMessage:async message=>{
        window.requests.push(message);
        if(message.type==='state')return {ok:true,value:{dmvDarkMode:window.dmvDarkMode,pdfDarkMode:window.pdfDarkMode,blacklist:window.blacklistData,history:[...window.historyErrors,{kind:'plate',value:'ABC12345',at:Date.now()},{kind:'license',value:'123456789',at:Date.now()}],queue:{values:['123','456'],index:1},commands:window.commandShortcuts,alertsEnabled:window.sessionAlerts,...window.audioSettings,voices:[{voiceName:'Microsoft David Desktop',lang:'en-US'},{voiceName:'Microsoft Zira Desktop',lang:'en-US'}]}};
        if(message.type==='blacklist-unlock'){
          if(message.passphrase!=='fixture passphrase')return {ok:false,error:'Could not unlock the vault. Check the passphrase.'};
          window.blacklistData.unlocked=true;return {ok:true,value:window.blacklistData};
        }
        if(message.type==='blacklist-add'){
          window.blacklistData.entries.push({kind:message.kind,value:message.value});return {ok:true,value:window.blacklistData};
        }
        if(message.type==='blacklist-remove'){
          window.blacklistData.entries=window.blacklistData.entries.filter(x=>x.kind!==message.kind||x.value!==message.value);return {ok:true,value:window.blacklistData};
        }
        if(message.type==='dmv-display-settings'){window.dmvDarkMode=message.enabled;return {ok:true,value:window.dmvDarkMode};}
        if(message.type==='pdf-display-settings'){window.pdfDarkMode=message.enabled;return {ok:true,value:window.pdfDarkMode};}
        if(message.type==='audio-settings'){Object.assign(window.audioSettings,message);return {ok:true,value:true};}
        if(message.type==='alerts'){window.sessionAlerts=message.enabled;return {ok:true,value:message.enabled};}
        if(message.type==='panel-data')return {ok:true,value:window.location.search.includes('credentials')?{type:'credentials',hasVault:false}:{type:'input',command:'plate'}};
        return {ok:true,value:true};
      }}, commands:{getAll:async()=>window.commandShortcuts},windows:{create:async options=>{window.openedTabs.push(options);}}, storage:{onChanged:{addListener:listener=>window.storageListeners.push(listener)}},tabs:{create:async options=>{window.openedTabs.push(options);}},permissions:{request:async()=>true}
    };
  });
  await tests('shortcut setup lists actual assignments and preferred keys, opens settings, refreshes and dismisses',async()=>{
    const page=await ui.newPage();await page.setViewportSize({width:900,height:820});
    await page.addInitScript(()=>{window.setupClosed=false;window.close=()=>{window.setupClosed=true;};});
    await page.goto(`${base}/shortcut-setup.html`);await page.locator('#assignments tr').first().waitFor();
    assert.equal(await page.locator('#assignments tr').count(),9);
    assert.match(await page.locator('main').textContent(),/In Chrome.*Global/s);
    assert.match(await page.locator('[data-command="plate"]').textContent(),/Alt\+P.*Ctrl\+Shift\+7/);
    assert.match(await page.locator('[data-command="barcode"]').textContent(),/Alt\+B.*Not assigned/);
    await page.locator('#openShortcuts').click();
    assert.deepEqual(await page.evaluate(()=>window.openedTabs),[{url:'chrome://extensions/shortcuts',type:'normal',focused:true}]);
    await page.evaluate(()=>window.commandShortcuts=[{name:'barcode',shortcut:'Alt+B'}]);await page.locator('#refresh').click();
    await page.waitForFunction(()=>document.querySelector('[data-command="barcode"]').textContent.endsWith('Alt+B'));
    await page.screenshot({path:join(screenshots,'shortcut-setup.png'),fullPage:true});
    await page.locator('#done').click();assert.equal(await page.evaluate(()=>window.setupClosed),true);await page.close();
  });
  await tests('Stop remains below status and Settings owns alerts and shortcut setup',async()=>{
    const page=await ui.newPage();await page.addInitScript(()=>{window.close=()=>{window.panelClosed=true;};});
    await page.goto(`${base}/popup.html`);await page.locator('#history tr').first().waitFor();
    assert.equal(await page.locator('#status').evaluate(el=>el.nextElementSibling.id),'stopFunction');
    assert.equal(await page.locator('#alertsToggle').isVisible(),false);
    assert.equal(await page.locator('#settingsView').isVisible(),false);
    await page.locator('#stopFunction').click();assert.equal(await page.locator('#status').textContent(),'Stopped');
    assert.equal(await page.evaluate(()=>window.requests.some(message=>message.type==='stop')),true);
    await page.locator('#settingsTab').click();assert.equal(await page.locator('#alertsToggle').isVisible(),true);
    assert.equal(await page.locator('#speechToggle').isVisible(),true);assert.equal(await page.locator('#browserShortcuts').isVisible(),true);
    assert.equal(await page.locator('#aboutView #browserShortcuts').count(),0);
    await page.screenshot({path:join(screenshots,'settings.png'),fullPage:true});
    await page.locator('#aboutTab').click();assert.equal(await page.locator('#alertsToggle').isVisible(),false);
    await page.locator('#historyTab').click();await page.getByRole('button',{name:'Previous customer',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.requests.at(-1).command),'previous');await page.close();
  });
  await tests('audio controls start off and retain independent toggles and voice selection',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/popup.html`);await page.locator('#history tr').first().waitFor();
    await page.locator('#settingsTab').click();
    assert.equal(await page.locator('#speechToggle').isChecked(),false);assert.equal(await page.locator('#clipToggle').isChecked(),false);
    assert.equal(await page.locator('#voiceSource').inputValue(),'recordings');
    assert.equal(await page.locator('#voiceSource option').first().getAttribute('value'),'recordings');
    assert.equal(await page.locator('#voiceName').isDisabled(),true);
    await page.locator('#voiceSource').selectOption('microsoft');
    assert.equal(await page.locator('#repeatSpeechToggle').isChecked(),false);
    await page.locator('#repeatSpeechToggle').check();
    await page.locator('#speechToggle').check();await page.locator('#clipToggle').check();
    await page.locator('#voiceGender').selectOption('male');await page.locator('#voiceName').selectOption('Microsoft David Desktop');
    await page.locator('#aboutTab').click();
    await page.locator('#settingsTab').click();
    assert.equal(await page.locator('#speechToggle').isChecked(),true);assert.equal(await page.locator('#clipToggle').isChecked(),true);
    assert.equal(await page.locator('#repeatSpeechToggle').isChecked(),true);
    assert.equal(await page.locator('#voiceGender').inputValue(),'male');assert.equal(await page.locator('#voiceName').inputValue(),'Microsoft David Desktop');
    assert.equal(await page.locator('#voiceSource').inputValue(),'microsoft');
    await page.locator('#voiceSource').selectOption('recordings');assert.equal(await page.locator('#voiceName').isDisabled(),true);
    await page.locator('#stopAudio').click();assert.equal(await page.evaluate(()=>window.requests.at(-1).type),'stop-audio');
    await page.screenshot({path:join(screenshots,'audio-settings.png'),fullPage:true});await page.close();
  });
  await tests('packaged suspended MP3 decodes in Chromium',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/popup.html`);
    const duration=await page.evaluate(async()=>{
      const bytes=await(await fetch('/audio/suspended.mp3')).arrayBuffer();
      const context=new OfflineAudioContext(1,44100,44100);const audio=await context.decodeAudioData(bytes);return audio.duration;
    });
    assert.ok(duration>0&&duration<90);await page.close();
  });
  await tests('all 20 packaged male and female MP3 recordings decode locally in Chromium',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/popup.html`);
    const durations=await page.evaluate(async paths=>{
      const context=new OfflineAudioContext(1,44100,44100);
      return Promise.all(paths.map(async path=>{
        const bytes=await(await fetch('/'+path)).arrayBuffer();const audio=await context.decodeAudioData(bytes);return audio.duration;
      }));
    },RECORDING_PATHS);
    assert.equal(durations.length,20);for(const duration of durations)assert.ok(duration>0&&duration<90);
    await page.close();
  });
  await tests('status alerts toggle starts disabled and updates the session setting',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/popup.html`);await page.locator('#history tr').first().waitFor();
    await page.locator('#settingsTab').click();
    assert.equal(await page.locator('#alertsToggle').isChecked(),false);
    await page.locator('#alertsToggle').check();await page.locator('#aboutTab').click();
    assert.equal(await page.locator('#alertsToggle').isChecked(),true);
    await page.locator('#settingsTab').click();
    await page.locator('#alertsToggle').uncheck();
    assert.equal(await page.evaluate(()=>window.sessionAlerts),false);await page.close();
  });
  await tests('About shows actual browser shortcuts, descriptions, setup instructions, and perpetual ownership notice', async () => {
    const page=await ui.newPage(); await page.goto(`${base}/popup.html`);
    await page.locator('#history tr').first().waitFor();
    assert.equal(await page.locator('h1').textContent(),'SC DMV Hotkeys');
    assert.equal(await page.locator('#history tr').count(),2);
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(24, 26, 27)');
    await page.screenshot({path:join(screenshots,'history.png')});
    await page.locator('#aboutTab').click();
    assert.equal(await page.locator('#aboutTab').textContent(),'About');
    assert.equal(await page.locator('.shortcut-entry').count(),10);
    assert.equal(await page.locator('[data-command="selected"]').count(),0);
    assert.equal(await page.locator('[data-command="plate"] kbd').textContent(),'Ctrl+Shift+7');
    assert.equal(await page.locator('[data-command="license"] kbd').textContent(),'Not assigned');
    assert.equal(await page.locator('[data-command="_execute_action"] kbd').textContent(),'Alt+Period');
    assert.equal(await page.locator('#bindings, #saveKeys, #reconnect, #installCommand, #forget').count(),0);
    for(const row of await page.locator('.shortcut-entry').all()) assert.ok((await row.locator('p').textContent()).length>20);
    assert.match(await page.locator('.about-instructions').textContent(),/In Chrome.*Global/);
    assert.match(await page.locator('.about-license').textContent(),/perpetual basis.*Preston Webb/s);
    assert.equal(await page.locator('#aboutView #browserShortcuts').count(),0);
    await page.locator('#settingsTab').click();
    await page.locator('#browserShortcuts').click();
    assert.deepEqual(await page.evaluate(()=>window.openedTabs),[{url:'chrome://extensions/shortcuts'}]);
    await page.evaluate(()=>{window.commandShortcuts[0].shortcut='Alt+Shift+P';});
    await page.locator('#historyTab').click();await page.locator('#aboutTab').click();
    await page.waitForFunction(()=>document.querySelector('[data-command="plate"] kbd').textContent==='Alt+Shift+P');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:join(screenshots,'about.png'),fullPage:true});
  });
  await tests('DMV error attempts appear live in history with safe text and remain available to rerun',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/popup.html`);await page.locator('#history tr').first().waitFor();
    assert.equal(await page.locator('#history tr').count(),2);
    await page.evaluate(()=>{
      window.historyErrors=[{id:'failed-fixture',kind:'customer',value:'61000001',at:Date.now(),outcome:'error',errorMessage:'No record <img src=x>'}];
      for(const listener of window.storageListeners)listener({history:{newValue:window.historyErrors}},'session');
    });
    await page.waitForFunction(()=>document.querySelectorAll('#history tr').length===3);
    assert.equal(await page.locator('#history .history-error').textContent(),'DMV error: No record <img src=x>');
    assert.equal(await page.locator('#history img').count(),0);
    assert.equal(await page.locator('#history .history-rerun').first().textContent(),'61000001');
    await page.locator('#history .history-rerun').first().click();
    await page.waitForFunction(()=>window.requests.some(x=>x.type==='rerun'));
    assert.equal(await page.evaluate(()=>window.requests.find(x=>x.type==='rerun').search.id),'failed-fixture');
    await page.close();
  });
  await tests('Blacklist settings unlock, validate identifiers, add entries and confirm trash removal',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/popup.html`);await page.locator('#history tr').first().waitFor();await page.locator('#settingsTab').click();
    assert.equal(await page.locator('#blacklistAdd').isDisabled(),true);
    assert.equal(await page.locator('#blacklistSetup').isVisible(),true);
    await page.locator('#blacklistSetup').click();
    assert.equal(await page.evaluate(()=>window.requests.some(x=>x.type==='blacklist-setup')),true);
    assert.equal(await page.evaluate(()=>window.requests.some(x=>x.type==='run')),false);
    await page.evaluate(()=>{
      window.blacklistData={hasVault:true,unlocked:false,entries:[]};
      for(const listener of window.storageListeners)listener({vault:{newValue:{ciphertext:'fixture'}}},'local');
    });
    await page.waitForFunction(()=>!document.querySelector('#blacklistUnlock').disabled);
    assert.equal(await page.locator('#blacklistTable').isVisible(),false);
    await page.locator('#blacklistPassphrase').fill('incorrect phrase');await page.locator('#blacklistUnlock').click();
    await page.waitForFunction(()=>document.querySelector('#blacklistFeedback').textContent.includes('Could not unlock'));
    assert.equal(await page.locator('#blacklistAdd').isDisabled(),true);
    await page.locator('#blacklistPassphrase').fill('fixture passphrase');await page.locator('#blacklistUnlock').click();
    await page.waitForFunction(()=>!document.querySelector('#blacklistAdd').disabled);
    await page.locator('#blacklistKind').selectOption('license');assert.match(await page.locator('#blacklistLimit').textContent(),/Up to 9 digits/);
    await page.locator('#blacklistValue').fill('ABC');await page.locator('#blacklistAdd').click();
    assert.match(await page.locator('#blacklistFeedback').textContent(),/only numbers/);
    assert.equal(await page.evaluate(()=>window.requests.filter(x=>x.type==='blacklist-add').length),0);
    await page.locator('#blacklistKind').selectOption('plate');assert.match(await page.locator('#blacklistLimit').textContent(),/Up to 8 letters or digits/);
    await page.locator('#blacklistValue').fill('test123');await page.locator('#blacklistAdd').click();
    await page.waitForFunction(()=>document.querySelectorAll('#blacklistEntries tr').length===1);
    assert.match(await page.locator('#blacklistEntries').textContent(),/Plate number.*TEST123/s);
    assert.equal(await page.locator('#blacklistPassphrase').inputValue(),'');
    assert.equal(await page.evaluate(()=>window.requests.find(x=>x.type==='blacklist-add').passphrase),undefined);
    page.once('dialog',async dialog=>{assert.match(dialog.message(),/no longer be stopped/);await dialog.dismiss();});
    await page.locator('.blacklist-remove').click();assert.equal(await page.locator('#blacklistEntries tr').count(),1);
    assert.equal(await page.evaluate(()=>window.requests.filter(x=>x.type==='blacklist-remove').length),0);
    assert.equal(await page.locator('#blacklistPassphrase').isVisible(),false);
    await page.screenshot({path:join(screenshots,'blacklist-settings.png'),fullPage:true});
    page.once('dialog',async dialog=>{assert.match(dialog.message(),/suspended or revoked/);await dialog.accept();});
    await page.locator('.blacklist-remove').click();await page.waitForFunction(()=>document.querySelectorAll('#blacklistEntries tr').length===0);
    assert.equal(await page.evaluate(()=>window.requests.find(x=>x.type==='blacklist-remove').confirmed),true);
    assert.equal(await page.locator('#blacklistEmpty').isVisible(),true);await page.close();
  });
  await tests('formatted blacklist numbers are normalized without silent input truncation',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/popup.html`);await page.locator('#history tr').first().waitFor();await page.locator('#settingsTab').click();
    await page.evaluate(()=>{
      window.blacklistData={hasVault:true,unlocked:true,entries:[]};
      for(const listener of window.storageListeners)listener({vault:{newValue:{ciphertext:'fixture'}}},'local');
    });
    await page.waitForFunction(()=>!document.querySelector('#blacklistAdd').disabled);
    await page.locator('#blacklistKind').selectOption('license');
    await page.locator('#blacklistValue').fill('001 234 567');await page.locator('#blacklistAdd').click();
    await page.waitForFunction(()=>document.querySelectorAll('#blacklistEntries tr').length===1);
    assert.equal(await page.evaluate(()=>window.requests.find(x=>x.type==='blacklist-add').value),'001234567');
    await page.locator('#blacklistValue').fill('1234567890');await page.locator('#blacklistAdd').click();
    assert.match(await page.locator('#blacklistFeedback').textContent(),/more than 9/);
    assert.equal(await page.evaluate(()=>window.requests.filter(x=>x.type==='blacklist-add').length),1);
    await page.close();
  });
  await tests('vault setup requires encryption and different credentials retain the blacklist-unlock requirement',async()=>{
    for(const mode of ['setup','unlock']){
      const page=await ui.newPage();
      await page.addInitScript(mode=>{
        const original=chrome.runtime.sendMessage;
        chrome.runtime.sendMessage=async message=>message.type==='panel-data'?{ok:true,value:mode==='setup'?{type:'credentials',hasVault:false,setupOnly:true,encryptedRequired:true}:{type:'credentials',hasVault:true,unlockOnly:true}}:original(message);
      },mode);
      await page.goto(`${base}/panel.html?id=vault-${mode}`);await page.locator('#credentialsArea').waitFor();
      if(mode==='setup'){
        assert.equal(await page.locator('#save').isChecked(),true);assert.equal(await page.locator('#save').isDisabled(),true);
        assert.equal(await page.locator('#savePassArea').isVisible(),true);
        await page.locator('#user').fill('fixture-user');await page.locator('#password').fill('fixture-password');await page.locator('#savePass').fill('fixture passphrase');
      } else {
        assert.equal(await page.locator('#useNew').isVisible(),true);await page.locator('#useNew').click();
        assert.equal(await page.locator('#newCredentials').isVisible(),true);assert.equal(await page.locator('#unlockPass').isVisible(),true);
        assert.match(await page.locator('#message').textContent(),/replaces the saved login/);
        await page.locator('#unlockPass').fill('fixture passphrase');
        await page.locator('#user').fill('different-user');await page.locator('#password').fill('different-password');
      }
      await page.locator('#submit').click();await page.waitForFunction(()=>window.requests.some(x=>x.type==='panel-submit'));
      const request=await page.evaluate(()=>window.requests.find(x=>x.type==='panel-submit'));
      if(mode==='setup')assert.equal(request.save,true);else {assert.equal(request.unlock,false);assert.equal(request.blacklistPassphrase,'fixture passphrase');assert.equal(request.user,'different-user');}
      await page.close();
    }
  });
  await tests('login popup confirms clearing saved user info and vaults before sending the delete request',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/panel.html?id=credentials`);await page.locator('#clearSavedInfo').waitFor();
    page.once('dialog',async dialog=>{assert.match(dialog.message(),/saved credentials.*blacklisted numbers.*re-entered before blacklist protection is enabled again/s);await dialog.dismiss();});
    await page.locator('#clearSavedInfo').click();assert.equal(await page.evaluate(()=>window.requests.some(x=>x.type==='clear-saved-user-info')),false);
    page.once('dialog',async dialog=>{assert.match(dialog.message(),/cannot be undone/);await dialog.accept();});
    await page.locator('#clearSavedInfo').click();await page.waitForFunction(()=>window.panelClosed);
    assert.equal(await page.evaluate(()=>window.requests.find(x=>x.type==='clear-saved-user-info').confirmed),true);
    await page.close();
  });
  await tests('blacklist warnings show large flashing red text and require no status-alert preference',async()=>{
    const page=await ui.newPage();await page.clock.install();
    await page.addInitScript(()=>{
      const original=chrome.runtime.sendMessage;
      chrome.runtime.sendMessage=async message=>message.type==='panel-data'?{ok:true,value:{type:'record-alert',blacklist:true,tone:'danger',subject:'SEARCH BLOCKED: BLACKLIST',autoCloseMs:90000,sections:[{title:'Plate number is blacklisted. Running this plate number could cause your SCDMV access privileges to be suspended or revoked automatically by the DMV.',lines:[]}]}}:original(message);
    });
    await page.goto(`${base}/panel.html?id=blacklist`);await page.locator('.record-status-title').waitFor();
    const title=page.locator('.record-status-title');
    assert.match(await title.textContent(),/is blacklisted.*suspended or revoked/);
    assert.equal(await title.evaluate(el=>getComputedStyle(el).color),'rgb(255, 85, 89)');
    assert.equal(await title.evaluate(el=>getComputedStyle(el).animationName),'blacklist-flash');
    assert.ok(await title.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=32);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:join(screenshots,'blacklist-warning.png'),fullPage:true});
    await page.clock.fastForward(90000);await page.waitForFunction(()=>window.panelClosed);await page.close();
  });
  await tests('incomplete barcode-owner popup offers next owner only when available and submits explicit blank choices',async()=>{
    for(const [hasNext,choice] of [[true,'next'],[true,'blank'],[false,'blank']]){
      const page=await ui.newPage();
      await page.addInitScript(hasNext=>{
        const original=chrome.runtime.sendMessage;
        chrome.runtime.sendMessage=async message=>message.type==='panel-data'?{ok:true,value:{type:'barcode-owner-incomplete',hasNext,message:'The selected owner address is incomplete. Generate with blanks or cancel.'}}:original(message);
      },hasNext);
      await page.goto(`${base}/panel.html?id=incomplete-owner`);await page.locator('#message').waitFor();
      assert.match(await page.locator('#message').textContent(),/incomplete/);
      assert.equal(await page.locator('#barcodeBlanks').isVisible(),hasNext);
      assert.equal(await page.locator('#submit').textContent(),hasNext?'Use next owner':'Generate with blanks');
      await page.locator(choice==='blank'&&hasNext?'#barcodeBlanks':'#submit').click();
      await page.waitForFunction(()=>window.requests.some(x=>x.type==='panel-submit'));
      assert.equal(await page.evaluate(()=>window.requests.find(x=>x.type==='panel-submit').value),choice);
      await page.close();
    }
  });
  await tests('recent search numbers rerun the stored search by click or keyboard without an input prompt',async()=>{
    for(const [row,kind,value] of [[0,'plate','ABC12345'],[1,'license','123456789']]){
      const page=await ui.newPage();await page.goto(`${base}/popup.html`);
      const button=page.locator('#history .history-rerun').nth(row);await button.waitFor();
      if(row===0)await button.click();else {await button.focus();await page.keyboard.press('Enter');}
      await page.waitForFunction(()=>window.requests.some(message=>message.type==='rerun'));
      const request=await page.evaluate(()=>window.requests.find(message=>message.type==='rerun'));
      assert.equal(request.search.kind,kind);assert.equal(request.search.value,value);
      assert.equal(await page.evaluate(()=>window.requests.some(message=>message.type==='run')),false);
      await page.close();
    }
  });
  await tests('plate panel rejects oversize input and submits normalized input', async()=>{
    const page=await ui.newPage(); await page.goto(`${base}/panel.html?id=plate`);
    await page.locator('#value').fill('ABCDEFGHI'); await page.keyboard.press('Enter');
    assert.match(await page.locator('#error').textContent(),/more than 8/);
    await page.screenshot({path:join(screenshots,'plate-panel.png')});
    await page.locator('#value').fill('abc 123'); await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const request=await page.evaluate(()=>window.requests.find(x=>x.type==='panel-submit'));
    assert.equal(request.value,'ABC123');
  });
  await tests('empty Enter, Escape, and the 90-second deadline cancel without a query',async()=>{
    for (const action of ['empty','escape','timeout']) {
      const page=await ui.newPage();
      if(action==='timeout')await page.clock.install();
      await page.goto(`${base}/panel.html?id=plate`); await page.locator('#value').waitFor();
      if(action==='empty')await page.keyboard.press('Enter');
      if(action==='escape')await page.keyboard.press('Escape');
      if(action==='timeout')await page.clock.fastForward(91000);
      await page.waitForFunction(()=>window.panelClosed===true);
      assert.equal(await page.evaluate(()=>window.requests.some(x=>x.type==='restore')),false);
      assert.equal(await page.evaluate(()=>window.requests.some(x=>x.type==='panel-submit')),false);
      await page.close();
    }
  });
  await tests('credential form fits without horizontal overflow',async()=>{
    const page=await ui.newPage(); await page.setViewportSize({width:460,height:650});
    await page.goto(`${base}/panel.html?id=credentials`); await page.locator('#user').waitFor();
    await page.locator('#save').check();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:join(screenshots,'credentials.png'),fullPage:true});
  });
  await tests('barcodes close at ninety seconds without scale changes extending their lifetime; Escape cancels expiry',async()=>{
    for(const mode of ['timeout','escape']) {
      const page=await ui.newPage();await page.clock.install();
      await page.addInitScript(()=>{
        window.barcodeCloseCalls=0;window.close=()=>{window.barcodeCloseCalls++;};
        const original=chrome.runtime.sendMessage;
        chrome.runtime.sendMessage=async message=>message.type==='panel-data'
          ? {ok:true,value:{type:'barcode',title:'Synthetic barcode',summary:'Fixture only',profile:'Test',payload:'SYNTHETIC TEST DATA',warnings:[]}}
          : original(message);
      });
      await page.goto(base+'/barcode.html?id=timeout-fixture');
      await page.waitForFunction(()=>document.querySelector('#barcode').width>100);
      assert.equal(await page.locator('#error').textContent(),'');
      assert.equal(await page.locator('#countdown').textContent(),'Closes in 90 seconds. Press Esc to dismiss.');
      if(mode==='escape')await page.keyboard.press('Escape');
      else {
        await page.clock.fastForward(89000);assert.equal(await page.evaluate(()=>window.barcodeCloseCalls),0);
        assert.equal(await page.locator('#countdown').textContent(),'Closes in 1 seconds. Press Esc to dismiss.');
        await page.locator('#scale').selectOption('4');
        assert.equal(await page.locator('#countdown').textContent(),'Closes in 1 seconds. Press Esc to dismiss.');
        await page.clock.fastForward(1000);
        assert.equal(await page.locator('#countdown').textContent(),'Closes in 0 seconds. Press Esc to dismiss.');
      }
      assert.equal(await page.evaluate(()=>window.barcodeCloseCalls),1);
      await page.clock.fastForward(90000);assert.equal(await page.evaluate(()=>window.barcodeCloseCalls),1);
      await page.close();
    }
  });
  const fixedNow=new Date('2026-10-28T16:00:00Z');
  const currentHeader='Type Class Function Issued Expires Printed Date Restr.Endor.Document Identifier Current (ACN / DDN)';
  /** Render a status panel from worker display data for text, layout, and lifetime assertions. */
  async function statusPage(payload){
    const page=await ui.newPage();await page.setViewportSize({width:580,height:700});await page.clock.install();
    await page.addInitScript(payload=>{
      window.closedByAlert=false;window.close=()=>{window.closedByAlert=true;};
      const original=chrome.runtime.sendMessage;chrome.runtime.sendMessage=async message=>message.type==='panel-data'?{ok:true,value:payload}:original(message);
    },payload);
    await page.goto(`${base}/panel.html?id=record-status`);await page.locator('.record-status-title').first().waitFor();return page;
  }
  await tests('plate popups render vehicle details beneath valid, expired and suspended statuses in smaller large white text',async()=>{
    for(const [name,expiration,enforcement] of [['valid','11/01/2026',''],['expired','10/27/2026',''],['suspended','11/01/2026','Enforcement Description: Insurance suspension Enforcement Statute: 56-1-460']]){
      const report=`VIN: SYNTHETICVIN Year: 2026 Make: TEST MAKE Model: EXAMPLE MODEL Body: 4S Empty Weight: 3000 Plate Class: ABC PRIVATE PASSENGER Decal Exp Date: ${expiration} ${enforcement}`;
      const page=await statusPage(plateStatus(report,fixedNow));
      const details=page.locator('.record-vehicle-details');await details.waitFor();
      assert.deepEqual(await details.locator('p').allTextContents(),['Make: TEST MAKE','Model: EXAMPLE MODEL','Year: 2026','Body style: 4S']);
      assert.equal(await details.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
      const size=await details.evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
      assert.ok(size>=22&&size<await page.locator('.record-status-title').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)));
      assert.equal(await details.evaluate(el=>el.previousElementSibling.classList.contains('record-status-section')),true);
      assert.doesNotMatch(await details.textContent(),/SYNTHETICVIN|3000/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:join(screenshots,`plate-vehicle-${name}.png`),fullPage:true});await page.close();
    }
    const payload=plateStatus('VIN: TEST Year: 2026 Make: TEST Model: Body: Empty Weight: 3000 Plate Class: ABC Decal Exp Date: 11/01/2026',fixedNow);
    payload.vehicle.model='<img src=x>';
    const page=await statusPage(payload);await page.locator('.record-vehicle-details').waitFor();
    assert.match(await page.locator('.record-vehicle-details').textContent(),/Model: <img src=x>.*Body style: Unavailable/s);
    assert.equal(await page.locator('.record-vehicle-details img').count(),0);await page.close();
  });
  await tests('combined plate alert renders large red headings, remains open for 90 seconds, then closes',async()=>{
    const payload=plateStatus('Plate Class: ABC Decal Exp Date: 09/27/2025 Enforcement Description: <img src=x> Insurance suspension Enforcement Statute: 56-1-460',fixedNow);
    const page=await statusPage(payload);
    assert.deepEqual(await page.locator('.record-status-title').allTextContents(),['TAG SUSPENDED','EXPIRED']);
    assert.equal(await page.locator('.record-status-title').first().evaluate(el=>getComputedStyle(el).color),'rgb(255, 85, 89)');
    assert.equal(await page.locator('#recordAlert img').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:join(screenshots,'plate-alert.png'),fullPage:true});
    await page.clock.fastForward(89000);assert.equal(await page.evaluate(()=>window.closedByAlert),false);
    await page.clock.fastForward(1000);assert.equal(await page.evaluate(()=>window.closedByAlert),true);await page.close();
  });
  await tests('suspended license alert shows large grouped reasons and dismisses on Escape',async()=>{
    const block=reason=>`SUSP: ${reason} Special Driving Privilege: NONE Suspension Beg: 01/01/2020 Suspension End: INDEFINITE Causal: 01/01/2020 Post: 01/01/2020 Reinstatement Requirements Met: NO Reinstatement Fee Paid: NO`;
    const payload=licenseStatus(`Status - DL:SUSPENDED ${block('097 - Failure to Pay Traffic Ticket')} ${block('097 - Failure to Pay Traffic Ticket')} ${block('018 - Failure to Stop for Blue Light')} VIOL: 123 - Driving Under Suspension Ticket#: 123 Violation: 01/01/2025`,fixedNow);
    const page=await statusPage(payload);
    assert.deepEqual(await page.locator('.record-status-list li').allTextContents(),['Failure to Pay Traffic Ticket × 2','Failure to Stop for Blue Light × 1']);
    assert.match(await page.locator('#recordAlert').textContent(),/1 Prior DUS convictions within 5 years/);
    assert.ok(await page.locator('.record-status-title').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>await page.locator('.record-status-line').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)));
    await page.screenshot({path:join(screenshots,'license-alert.png'),fullPage:true});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.closedByAlert);await page.close();
  });
  await tests('green plate and license alerts close after ten seconds',async()=>{
    const payloads=[plateStatus('Plate Class: ABC Decal Exp Date: 10/28/2026',fixedNow),licenseStatus(`Status - DL: NO SUSPENSION Driver License No:123456789 Name: FICTIONAL, PERSON ${currentHeader} DL Renewal 01/01/2020 10/28/2026 01/01/2020`,fixedNow)];
    for(const payload of payloads){const page=await statusPage(payload);assert.equal(await page.locator('.record-status-title').evaluate(el=>getComputedStyle(el).color),'rgb(67, 220, 121)');await page.clock.fastForward(9000);assert.equal(await page.evaluate(()=>window.closedByAlert),false);await page.clock.fastForward(1000);assert.equal(await page.evaluate(()=>window.closedByAlert),true);await page.close();}
  });
  await tests('combined Dark Mode group exposes two keyboard-accessible independent saved switches',async()=>{
    const page=await ui.newPage();await page.goto(base+'/popup.html');await page.locator('#settingsTab').click();
    const group=page.locator('#appearanceSettings');assert.equal(await group.getByRole('heading',{name:'Dark Mode',exact:true}).count(),1);
    assert.equal(await group.getByRole('switch').count(),2);assert.equal(await group.getByRole('checkbox').count(),0);
    assert.equal(await page.locator('#dmvDarkMode').isChecked(),true);assert.equal(await page.locator('#pdfDarkMode').isChecked(),false);
    await page.locator('#dmvDarkMode').focus();await page.keyboard.press('Space');
    assert.deepEqual(await page.evaluate(()=>window.requests.find(x=>x.type==='dmv-display-settings')),{type:'dmv-display-settings',enabled:false});
    assert.equal(await page.locator('#pdfDarkMode').isChecked(),false);
    await page.locator('#pdfDarkMode').focus();await page.keyboard.press('Space');
    assert.deepEqual(await page.evaluate(()=>window.requests.find(x=>x.type==='pdf-display-settings')),{type:'pdf-display-settings',enabled:true});
    assert.equal(await page.locator('#dmvDarkMode').isChecked(),false);
    await page.locator('#aboutTab').click();await page.locator('#settingsTab').click();
    assert.equal(await page.locator('#dmvDarkMode').isChecked(),false);assert.equal(await page.locator('#pdfDarkMode').isChecked(),true);
    assert.equal(await page.evaluate(()=>window.requests.some(x=>x.type==='run')),false);
    await page.screenshot({path:join(screenshots,'settings-wording-v1.8.8.png'),fullPage:true});await page.close();
  });
  await tests('PDF dark-view setting is opt-in and changes only the PDF preference',async()=>{
    const page=await ui.newPage();await page.goto(`${base}/popup.html`);await page.locator('#history tr').first().waitFor();await page.locator('#settingsTab').click();
    assert.equal(await page.locator('#pdfDarkMode').isChecked(),false);await page.locator('#pdfDarkMode').check();
    assert.deepEqual(await page.evaluate(()=>window.requests.find(x=>x.type==='pdf-display-settings')),{type:'pdf-display-settings',enabled:true});
    assert.equal(await page.evaluate(()=>window.requests.some(x=>x.type==='run')),false);await page.close();
  });
  await tests('PDF-only dark view changes paper/ink while embedded photo pixels exactly match original colors',async()=>{
    const page=await ui.newPage();
    await page.goto(base+'/reader.html');
    const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=60;const ctx=c.getContext('2d');for(const [x,y,color] of [[0,0,'#e83040'],[30,0,'#289c55'],[0,30,'#3060dc'],[30,30,'#c58c62']]){ctx.fillStyle=color;ctx.fillRect(x,y,30,30);}for(const [x,color] of [[0,'#000'],[20,'#888'],[40,'#fff']]){ctx.fillStyle=color;ctx.fillRect(x,50,20,10);}return c.toDataURL().split(',')[1];});
    const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),photo=await doc.embedPng(Buffer.from(png,'base64'));
    const pdf=doc.addPage([400,400]);pdf.drawText('SYNTHETIC DRIVER RECORD',{x:20,y:350,font,size:16});pdf.drawImage(photo,{x:100,y:150,width:120,height:120});
    doc.addPage([400,400]).drawText('SECOND PAGE',{x:20,y:350,font,size:16});
    const base64=Buffer.from(await doc.save()).toString('base64');
    await page.addInitScript(base64=>{const original=chrome.runtime.sendMessage;chrome.runtime.sendMessage=async message=>{if(message.type==='reader-start'||message.type==='reader-direct-start')return {ok:true,value:{base64,id:'synthetic-direct'}};if(message.type==='reader-result'){window.pdfResult=message;return {ok:true,value:true};}return original(message);};},base64);
    await page.goto(base+'/reader.html?dark=1&pdf=1#https://www.scdmvonline.com/SCTRNS/Member/Transactions/ViewAttachment.aspx');await page.waitForFunction(()=>window.pdfResult?.viewReady===true);
    const pixels=()=>page.locator('.pdf-sheet:first-child .pdf-page').evaluate(canvas=>{const ctx=canvas.getContext('2d');return {photo:[...ctx.getImageData(150,195,180,180).data],paper:[...ctx.getImageData(5,5,1,1).data],bright:[...ctx.getImageData(20,45,500,40).data].filter((v,i)=>i%4!==3&&v>200).length};});
    assert.equal(new URL(page.url()).searchParams.get('id'),'synthetic-direct');
    const dark=await pixels();assert.deepEqual(dark.paper,[24,26,27,255]);assert.ok(dark.bright>100);
    assert.equal(await page.locator('.pdf-sheet:first-child .pdf-page').evaluate(el=>getComputedStyle(el).filter),'none');
    await page.screenshot({path:join(screenshots,'pdf-dark-photo.png'),fullPage:true});
    await page.locator('#pdfColors').click();await page.locator('.pdf-sheet:first-child .pdf-page[data-ready=true]').waitFor();const light=await pixels();
    assert.deepEqual(light.paper,[255,255,255,255]);assert.deepEqual(dark.photo,light.photo);
    assert.equal(await page.locator('.pdf-sheet').count(),2);assert.equal(await page.locator('#pdfNext,#pdfPrev').count(),0);
    await page.locator('.pdf-sheet:nth-child(2)').scrollIntoViewIfNeeded();await page.locator('.pdf-sheet:nth-child(2) .pdf-page[data-ready=true]').waitFor();
    await page.locator('.pdf-sheet:first-child').scrollIntoViewIfNeeded();await page.locator('.pdf-sheet:first-child .pdf-page[data-ready=true]').waitFor();
    assert.match((await page.evaluate(()=>window.pdfResult.text)),/SYNTHETIC DRIVER RECORD.*SECOND PAGE/s);await page.close();
  });
  await tests('continuous PDF scrolling renders distant pages on demand and releases offscreen canvases',async()=>{
    const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
    for(let n=1;n<=30;n++)doc.addPage([400,400]).drawText(`SYNTHETIC PAGE ${n}`,{x:20,y:350,font,size:16});
    const base64=Buffer.from(await doc.save()).toString('base64'),page=await ui.newPage();
    await page.addInitScript(base64=>{chrome.runtime.sendMessage=async message=>{
      if(message.type==='reader-direct-start')return {ok:true,value:{base64,id:'long-report'}};
      if(message.type==='reader-result'){window.pdfResult=message;return {ok:true,value:true};}
      return {ok:false};
    };},base64);
    await page.goto(base+'/reader.html?dark=1&pdf=1#https://www.scdmvonline.com/SCTRNS/Member/Transactions/ViewAttachment.aspx');
    await page.waitForFunction(()=>window.pdfResult?.viewReady===true);assert.equal(await page.locator('.pdf-sheet').count(),30);
    assert.ok(await page.locator('.pdf-page').count()<=5);assert.equal(await page.locator('.pdf-sheet:last-child canvas').count(),0);
    await page.locator('.pdf-sheet:last-child').scrollIntoViewIfNeeded();await page.locator('.pdf-sheet:last-child canvas[data-ready=true]').waitFor();
    await page.waitForFunction(()=>!document.querySelector('.pdf-sheet:first-child canvas'));assert.ok(await page.locator('.pdf-page').count()<=5);
    const paper=await page.locator('.pdf-sheet:last-child canvas').evaluate(c=>[...c.getContext('2d').getImageData(5,5,1,1).data]);assert.deepEqual(paper,[24,26,27,255]);
    assert.match((await page.evaluate(()=>window.pdfResult.text)),/SYNTHETIC PAGE 30/);await page.close();
  });
  await tests('PDF text can be selected and copied after resize, rotation, color toggles, and canvas eviction',async()=>{
    const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),text='CUSTOMER NUMBER: 12345678';
    doc.addPage([400,400]).drawText(text,{x:50,y:300,font,size:16});
    const rotated=doc.addPage([400,500]);rotated.drawText('ROTATED COPY TEXT',{x:40,y:200,font,size:16});rotated.setRotation(degrees(90));
    for(let n=3;n<=12;n++)doc.addPage([400,400]).drawText(`SYNTHETIC PAGE ${n}`,{x:30,y:300,font,size:16});
    const base64=Buffer.from(await doc.save()).toString('base64'),page=await ui.newPage();
    await ui.grantPermissions(['clipboard-read','clipboard-write']);
    await page.addInitScript(base64=>{chrome.runtime.sendMessage=async message=>{
      if(message.type==='reader-direct-start')return {ok:true,value:{base64,id:'selection-fixture'}};
      if(message.type==='reader-result'){window.pdfResult=message;return {ok:true,value:true};}
      return {ok:false};
    };},base64);
    await page.goto(base+'/reader.html?dark=1&pdf=1#https://www.scdmvonline.com/SCTRNS/Member/Transactions/ViewAttachment.aspx');
    await page.waitForFunction(()=>window.pdfResult?.viewReady===true);await page.waitForFunction(()=>document.querySelectorAll('.pdf-text-surface').length===12);
    const first=page.locator('.pdf-sheet:first-child .textLayer span').filter({hasText:text});
    const copy=async(locator,vertical=false)=>{
      await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box.width>0&&box.height>0);
      await page.evaluate(()=>getSelection().removeAllRanges());
      await page.mouse.move(vertical?box.x+box.width/2:box.x+1,vertical?box.y+1:box.y+box.height/2);await page.mouse.down();
      await page.mouse.move(vertical?box.x+box.width/2:box.x+box.width-1,vertical?box.y+box.height-1:box.y+box.height/2,{steps:20});await page.mouse.up();
      const selected=await page.evaluate(()=>getSelection().toString());
      await page.evaluate(()=>navigator.clipboard.writeText('fixture empty'));await page.keyboard.press('Control+c');
      assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),selected);return selected;
    };
    for(const width of [540,920,360]){
      await page.setViewportSize({width,height:900});
      await page.waitForFunction(()=>{const sheet=document.querySelector('.pdf-sheet'),surface=sheet.querySelector('.pdf-text-surface');return Math.abs(surface.getBoundingClientRect().width-sheet.getBoundingClientRect().width)<1;});
      assert.equal(await copy(first),text);
      const box=await first.boundingBox(),sheet=await page.locator('.pdf-sheet:first-child').boundingBox();assert.ok(Math.abs(box.x-sheet.x-sheet.width*50/400)<2);
    }
    await page.setViewportSize({width:540,height:900});assert.equal(await copy(page.locator('.pdf-sheet:nth-child(2) .textLayer span').filter({hasText:'ROTATED COPY TEXT'}),true),'ROTATED COPY TEXT');
    await page.locator('#pdfColors').click();assert.equal(await copy(first),text);
    await page.locator('.pdf-sheet:last-child').scrollIntoViewIfNeeded();await page.waitForFunction(()=>!document.querySelector('.pdf-sheet:first-child canvas'));
    assert.equal(await page.locator('.pdf-sheet:first-child .pdf-text-surface').count(),1);
    assert.equal(await copy(first),text);
    // Native Select All includes unvisited report pages, without toolbar/page-label text.
    await page.keyboard.press('Control+a');await page.keyboard.press('Control+c');const all=await page.evaluate(()=>navigator.clipboard.readText());
    assert.match(all,/CUSTOMER NUMBER: 12345678/);assert.match(all,/SYNTHETIC PAGE 12/);assert.doesNotMatch(all,/Use original PDF colors|Use dark PDF colors|DMV PDF results/);
    await page.close();
  });
  await tests('Print button and print shortcuts open the exact captured PDF in Chromium without printing the dark HTML',async()=>{
    const doc=await PDFDocument.create();doc.addPage().drawText('ORIGINAL PRINT SNAPSHOT');doc.addPage().drawText('ORIGINAL SECOND PAGE');
    const bytes=Buffer.from(await doc.save()),base64=bytes.toString('base64'),page=await ui.newPage();let native,requests=0,dmvRequests=0;
    const readerHtml=await readFile(join(root,'extension/reader.html'),'utf8');
    await page.route('**/reader.html?*',route=>route.fulfill({body:readerHtml,contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'self'; object-src 'self'; worker-src 'self'"}}));
    page.on('request',request=>{if(request.url().startsWith('https://www.scdmvonline.com/'))dmvRequests++;});
    await page.exposeFunction('nativePdfRequest',async (url,text)=>{
      requests++;assert.match(text,/ORIGINAL PRINT SNAPSHOT/);assert.match(text,/ORIGINAL SECOND PAGE/);
      const actual=await page.evaluate(async url=>[...new Uint8Array(await(await fetch(url)).arrayBuffer())],url);assert.deepEqual(Buffer.from(actual),bytes);
      if(!native){native=await ui.newPage();await native.goto(url);}
      else await native.bringToFront();
      return true;
    });
    await page.addInitScript(base64=>{window.htmlPrintCount=0;window.print=()=>window.htmlPrintCount++;addEventListener('beforeprint',()=>window.htmlPrintCount++);
      chrome.runtime.sendMessage=async message=>{
        if(message.type==='reader-direct-start')return {ok:true,value:{base64,id:'print-fixture'}};
        if(message.type==='reader-result'){window.pdfResult=message;return new Promise(resolve=>{window.releaseReaderAck=()=>{window.readerAcked=true;resolve({ok:true,value:true});};});}
        if(message.type==='pdf-native-print'){await window.nativePdfRequest(message.url,message.text);return {ok:true,value:true};}
        return {ok:false};
      };
    },base64);
    await page.goto(base+'/reader.html?dark=1&pdf=1#https://www.scdmvonline.com/SCTRNS/Member/Transactions/ViewAttachment.aspx',{waitUntil:'commit'});
    await page.waitForFunction(()=>window.pdfResult?.viewReady===true&&!document.querySelector('#pdfPrint').disabled);
    await page.locator('#pdfPrint').click();await page.waitForFunction(()=>document.querySelector('#pdfPrintStatus').textContent.startsWith('Original PDF opened'));
    assert.equal(requests,1);assert.ok(native.url().startsWith('blob:'));
    assert.equal(await page.evaluate(()=>window.readerAcked===true),false);await page.evaluate(()=>window.releaseReaderAck());
    const info=await native.evaluate(()=>({type:document.contentType,embed:!!document.querySelector('embed[type="application/pdf"]'),darkPages:document.querySelectorAll('.pdf-sheet').length}));
    assert.ok(info.type==='application/pdf'||info.embed,JSON.stringify(info));assert.equal(info.darkPages,0);
    await page.bringToFront();await page.keyboard.press('Control+p');await page.waitForFunction(()=>!document.querySelector('#pdfPrint').disabled);assert.equal(requests,2);
    const prevented=await page.evaluate(()=>{const event=new KeyboardEvent('keydown',{key:'p',metaKey:true,bubbles:true,cancelable:true});dispatchEvent(event);return event.defaultPrevented;});
    assert.equal(prevented,true);await page.waitForFunction(()=>!document.querySelector('#pdfPrint').disabled);assert.equal(requests,3);
    assert.equal(await page.evaluate(()=>window.htmlPrintCount),0);assert.equal(dmvRequests,0);assert.equal(await page.locator('.pdf-sheet').count(),2);
    // Failed handoffs must be visible, and the same button must remain usable for retry.
    await page.bringToFront();await page.evaluate(()=>{window.successfulPrintSend=chrome.runtime.sendMessage;chrome.runtime.sendMessage=async message=>message.type==='pdf-native-print'?{ok:false,error:'The browser could not open the native PDF tab.'}:window.successfulPrintSend(message);});
    await page.locator('#pdfPrint').click();await page.locator('#pdfPrintStatus.error[role=alert]').waitFor();
    assert.match(await page.locator('#pdfPrintStatus').textContent(),/Unable to open PDF for printing/);assert.equal(await page.locator('#pdfPrint').isDisabled(),false);
    await page.evaluate(()=>{chrome.runtime.sendMessage=window.successfulPrintSend;});await page.locator('#pdfPrint').click();
    await page.waitForFunction(()=>document.querySelector('#pdfPrintStatus').textContent.startsWith('Original PDF opened'));assert.equal(requests,4);assert.equal(await page.locator('#pdfPrintStatus.error').count(),0);
    await native.close();await page.close();
  });
  await tests('cancelling PDF worker startup reports a deliberate stop instead of Worker was destroyed',async()=>{
    const doc=await PDFDocument.create();doc.addPage().drawText('SYNTHETIC CANCELLATION FIXTURE');
    const base64=Buffer.from(await doc.save()).toString('base64'),page=await ui.newPage();
    await page.addInitScript(base64=>{chrome.runtime.sendMessage=async message=>{
      if(message.type==='reader-direct-start')return {ok:true,value:{base64,id:'cancel-fixture'}};
      if(message.type==='reader-result'){window.pdfResult=message;return {ok:true,value:true};}
      return {ok:false};
    };},base64);
    // Hold worker startup so cancellation lands after getDocument creates its loading task.
    await page.route('**/vendor/pdf.worker.mjs',async route=>{
      await page.evaluate(()=>window.runtimeListeners.forEach(fn=>fn({target:'pdf-reader',type:'reader-cancel',id:'cancel-fixture'})));
      await route.continue().catch(()=>{});
    });
    await page.goto(base+'/reader.html?dark=1&pdf=1#https://www.scdmvonline.com/SCTRNS/Member/Transactions/ViewAttachment.aspx');
    await page.waitForFunction(()=>window.pdfResult?.error);
    assert.equal(await page.locator('#readingNote').textContent(),'Report loading stopped. Run the search again to reopen it.');
    assert.doesNotMatch((await page.evaluate(()=>window.pdfResult.error)),/Worker was destroyed/);await page.close();
  });
  await tests('bundled PDF.js extracts owner and driver text in a real browser worker',async()=>{
    for (const text of ['Owner Number: 00001234\nCustomer Number: 87654321','Driver License No: 123456789 Name: DE LA CRUZ, JANE\nDOB: 01/02/2000']) {
      const doc=await PDFDocument.create(), font=await doc.embedFont(StandardFonts.Helvetica), pdfPage=doc.addPage();
      text.split('\n').forEach((line,i)=>pdfPage.drawText(line,{x:30,y:750-i*25,size:12,font}));
      const base64=Buffer.from(await doc.save()).toString('base64');
      const page=await ui.newPage();
      await page.addInitScript(base64=>{
        const original=chrome.runtime.sendMessage;
        chrome.runtime.sendMessage=async message=>{
          if(message.type==='reader-start')return {ok:true,value:{base64,url:'https://www.scdmvonline.com/SCTRNS/Member/Transactions/ViewAttachment.aspx'}};
          if(message.type==='reader-result'){window.pdfResult=message;return {ok:true,value:true};}
          return original(message);
        };
      },base64);
      await page.goto(`${base}/reader.html?id=test`);
      await page.waitForFunction(()=>window.pdfResult,{timeout:20000});
      const result=await page.evaluate(()=>window.pdfResult);
      assert.equal(result.error,undefined,result.error);
      assert.ok(result.text.includes(text.split('\n')[0]));
      await page.close();
    }
  });
  /** Read one optional local PDF through the actual browser worker, without logging report contents. */
  async function localPdfText(path) {
    const base64=(await readFile(path)).toString('base64'),page=await ui.newPage();
    try {
      await page.addInitScript(base64=>{chrome.runtime.sendMessage=async message=>{
        if(message.type==='reader-start')return {ok:true,value:{base64}};
        if(message.type==='reader-result'){window.pdfResult=message;return {ok:true,value:true};}
        return {ok:true};
      };},base64);
      await page.goto(base+'/reader.html?id=local-report-regression');await page.waitForFunction(()=>window.pdfResult,{timeout:20000});
      const result=await page.evaluate(()=>window.pdfResult);assert.equal(result.error,undefined,result.error);return result.text;
    } finally {await page.close();}
  }
  const residenceIndex=process.argv.indexOf('--residence-pdf');
  if(residenceIndex>=0)await tests('local report: residence recognition and customer collection',async()=>{
    const text=await localPdfText(process.argv[residenceIndex+1]);assert.equal(isResidenceReport(text),true);
    const numbers=ownerNumbers(text);assert.ok(numbers.length>0);console.log(`Residence PDF check: ${numbers.length} unique customer numbers; identifiers are not logged.`);
  });
  const barcodeIndex=process.argv.indexOf('--barcode-pdf');
  if(barcodeIndex>=0)await tests('local report: vehicle barcode mapping',async()=>{
    const text=await localPdfText(process.argv[barcodeIndex+1]),barcode=reportBarcode(text);
    assert.equal(barcode.kind,'vehicle');assert.ok(barcode.payload.startsWith('@\n'));
    console.log('Local barcode PDF generated successfully; identifiers are not logged.');
  });
  // Retain the legacy CLI spelling without retaining a report-specific expected count.
  const customerIndex=process.argv.findIndex(arg=>['--customer-pdf','--sample-pdf'].includes(arg));
  if(customerIndex>=0)await tests('local report: unique customer collection',async()=>{
    const numbers=ownerNumbers(await localPdfText(process.argv[customerIndex+1]));assert.ok(numbers.length>0);
    console.log(`Customer PDF check: ${numbers.length} unique numbers; identifiers are not logged.`);
  });
  await ui.close(); await new Promise(resolve=>server.close(resolve));
  await writeFile(join(screenshots,'browser-tests.txt'),`${passed} browser/fixture checks passed. No live database requests were made.\n`);
  console.log(`${passed} browser/fixture checks passed; screenshots in test-results.`);
} finally { await browser.close(); }

