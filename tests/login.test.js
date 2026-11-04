// DOM operation tests for extension-managed credentials and form notification.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SearchRun} from '../extension/run.js';
import {search, scutties} from '../extension/automation.js';
import {MEMBER, LOGIN, DISCLAIMER, PDF_URL} from '../extension/core.js';
test('a login post that unloads the frame is verified at a new SCDMV URL and keeps login focused',async()=>{
  const portal={id:1,url:LOGIN,status:'complete',windowId:1};let pdf,submits=0;
  const session={lastQuery:0,portalId:1},focused=[];
  globalThis.chrome={
    storage:{session:{get:async()=>session,set:async values=>Object.assign(session,values)}},
    tabs:{onCreated:{addListener:()=>{},removeListener:()=>{}},onUpdated:{addListener:()=>{},removeListener:()=>{}},query:async()=>pdf?[{...portal},{...pdf}]:[{...portal}],get:async id=>({...id===1?portal:pdf}),update:async(id,update)=>{const tab=id===1?portal:pdf;Object.assign(tab,update);if(update.active)focused.push(id);return {...tab};}},
    windows:{get:async()=>({state:'normal'}),update:async()=>{}},
    scripting:{executeScript:async({args:[op,args]})=>{
      if(op==='state')return [{result:{url:portal.url,present:true,presentSelectors:[true,true],errors:[]}}];
      if(op==='extensionLogin'){
        assert.deepEqual(args.credentials,{user:'extension-user',password:'extension-password'});
        if(args.submit){submits++;portal.url=`${MEMBER}Home.aspx`;throw new Error('Frame was removed.');}
      }
      if(op==='click'&&args.selector==='#btnFooterNavNext')portal.url=`${MEMBER}Transactions/DrvRec/Page2.aspx?opt=CP`;
      if(op==='click'&&args.selector==='#downloadButton')pdf={id:2,url:PDF_URL,status:'complete',windowId:1,openerTabId:1};
      return [{result:true}];
    }}
  };
  const result=await search('customer','12345678',{status:()=>{},credentials:async()=>({user:'extension-user',password:'extension-password'})});
  assert.equal(result.tabId,2);assert.equal(submits,1);assert.equal(focused.at(-1),2);assert.ok(focused.includes(1));
});

test('warm-session searches focus the portal and restore its window before navigation or DOM access', async () => {
  for (const [kind, path] of [['plate','VehRec'], ['license','DrvRec'], ['customer','DrvRec'], ['address','DrvSameRes']]) {
    const portal = {id:1, url:DISCLAIMER, status:'complete', windowId:7, active:false};
    const win = {id:7, state:'minimized', focused:false};
    const session = {portalId:1, lastQuery:Date.now()};
    let pdf, navigated = false;
    const assertFocused = () => {assert.equal(portal.active,true); assert.equal(win.state,'normal'); assert.equal(win.focused,true);};
    globalThis.chrome = {
      storage:{session:{get:async()=>session,set:async value=>Object.assign(session,value)}},
      tabs:{onCreated:{addListener(){},removeListener(){}},onUpdated:{addListener(){},removeListener(){}},
        query:async()=>pdf?[{...portal},{...pdf}]:[{...portal}], get:async id=>({...id===1?portal:pdf}),
        update:async(id,update)=>{
          if(update.url){assertFocused();navigated=true;}
          const tab=id===1?portal:pdf;Object.assign(tab,update);return {...tab};
        }},
      windows:{get:async id=>{assert.equal(id,7);return {...win};},update:async(id,update)=>{assert.equal(id,7);Object.assign(win,update);}},
      scripting:{executeScript:async({target,args:[op,args]})=>{
        assert.equal(target.tabId,1);assertFocused();
        assert.notEqual(op,'extensionLogin','Fresh sessions must not need login to gain focus');
        if(op==='state')return [{result:{url:portal.url,present:true,errors:[]}}];
        if(op==='click'&&args.selector==='#btnFooterNavNext')portal.url=`${MEMBER}Transactions/${path}/Page2.aspx`;
        if(op==='click'&&args.selector==='#downloadButton')pdf={id:2,url:PDF_URL,status:'complete',windowId:7,openerTabId:1};
        return [{result:true}];
      }}
    };
    const result=await search(kind,'12345678',{status(){},credentials(){assert.fail('Unexpected login');}});
    assert.equal(navigated,true);assert.equal(result.tabId,2);assert.equal(pdf.active,true);
  }
});

test('SCUTTIES activates a new destination window and refocuses it after the permission popup', async () => {
  const portal={id:1,url:DISCLAIMER,status:'complete',windowId:7};
  let child, activeId, focusedWindow, permissions=false, searched=false;
  const session={portalId:1,lastQuery:Date.now()};
  globalThis.chrome={
    storage:{session:{get:async()=>session,set:async value=>Object.assign(session,value)}},
    tabs:{query:async()=>child?[portal,child]:[portal],get:async id=>({...id===1?portal:child}),update:async(id,update)=>{
      if(update.active)activeId=id;
      Object.assign(id===1?portal:child,update);return {...id===1?portal:child};
    }},
    windows:{get:async id=>({id,state:'minimized'}),update:async(id,update)=>{if(update.focused)focusedWindow=id;}},
    permissions:{contains:async()=>permissions},
    scripting:{executeScript:async({target,args:[op,args]})=>{
      const tab=target.tabId===1?portal:child;
      assert.equal(activeId,tab.id);assert.equal(focusedWindow,tab.windowId);
      if(op==='state')return [{result:{url:tab.url,present:true,enabled:true,errors:[]}}];
      if(op==='click'&&target.tabId===1)child={id:2,url:'https://scutties.fixture.test/search',windowId:8,status:'complete',openerTabId:1};
      if(op==='fill')assert.ok(['EXAMPLE','01/02/2000'].includes(args.value));
      if(op==='click'&&target.tabId===2)searched=true;
      return [{result:true}];
    }}
  };
  await scutties({lastName:'EXAMPLE',dob:'01/02/2000'},{status(){},permission:async origin=>{
    assert.equal(origin,'https://scutties.fixture.test/*');permissions=true;activeId=99;focusedWindow=99;
  }});
  assert.equal(searched,true);assert.equal(activeId,2);assert.equal(focusedWindow,8);
});

const TRANSACTIONS = `${MEMBER}Transactions/TransactionList.aspx`;
const LOGOFF = '#ContentPlaceHolder1_menuContainer > div > div:nth-child(1) > div:nth-child(1) > div.panel-body > ul > li:nth-child(1) > a';
function recoveryFixture({redirects=1, fresh=false, loginLanding=DISCLAIMER, missingLogoff=false, laterRedirect=false, pendingInitial=false, onLogoff}={}) {
  const portal={id:1,url:DISCLAIMER,status:'complete',windowId:1};
  const session={portalId:1,lastQuery:fresh?0:Date.now()};
  const counts={logoffs:0,logins:0,loads:0,fills:[],requests:[],statuses:[]};
  let pdf;
  globalThis.chrome={
    storage:{session:{get:async()=>session,set:async x=>Object.assign(session,x)}},
    tabs:{onCreated:{addListener(){},removeListener(){}},onUpdated:{addListener(){},removeListener(){}},
      query:async()=>pdf?[{...portal},{...pdf}]:[{...portal}],get:async id=>{
        if(id===1&&pendingInitial&&counts.loads===1){pendingInitial=false;return {...portal,url:TRANSACTIONS,pendingUrl:counts.requests[0]};}
        return {...id===1?portal:pdf};
      },
      update:async(id,update)=>{
        const tab=id===1?portal:pdf;
        Object.assign(tab,update);
        if(update.url){
          counts.requests.push(update.url);
          if(update.url.includes('Page1.aspx')){counts.loads++;if(redirects-->0)tab.url=TRANSACTIONS;}
        }
        return {...tab};
      }},
    windows:{get:async()=>({id:1,state:'normal'}),update:async()=>{}},
    scripting:{executeScript:async({args:[op,args]})=>{
      if(op==='state'){
        if(laterRedirect&&portal.url===TRANSACTIONS)throw new Error('Later website failure');
        return [{result:{url:portal.url,present:true,presentSelectors:[true,true],errors:[]}}];
      }
      if(op==='click'&&args.selector===LOGOFF){
        counts.logoffs++;assert.equal(session.lastQuery,0);
        if(missingLogoff)throw new Error('Log off link was not found');
        portal.url=LOGIN;onLogoff?.();
        // A successful navigation can destroy the script response context.
        throw new Error('Frame was removed.');
      }
      if(op==='extensionLogin'&&args.submit){counts.logins++;portal.url=loginLanding;}
      if(op==='fill')counts.fills.push(args.value);
      if(op==='click'&&args.selector==='#btnFooterNavNext')portal.url=laterRedirect?TRANSACTIONS:portal.url.replace('Page1.aspx','Page2.aspx');
      if(op==='click'&&args.selector==='#downloadButton')pdf={id:2,url:PDF_URL,status:'complete',windowId:1,openerTabId:1};
      return [{result:true}];
    }}
  };
  const ctx={status:s=>counts.statuses.push(s),credentials:async()=>({user:'test-user',password:'test-password'})};
  return {counts,session,ctx};
}
test('warm-session transaction-list redirect logs off once, signs in, and retries the original search',async()=>{
  for(const kind of ['plate','license','customer','address']){
    const {counts,session,ctx}=recoveryFixture();
    const result=await search(kind,'12345678',ctx);
    assert.equal(result.tabId,2);assert.equal(counts.logoffs,1);assert.equal(counts.logins,1);assert.equal(counts.loads,2);
    assert.deepEqual(counts.fills,['12345678']);
    assert.equal(counts.requests[0],counts.requests.at(-1),'Retry must preserve the original transaction and query');
    assert.ok(session.lastQuery>0);
  }
});
test('normal warm searches and fresh-login redirects to the transaction menu do not log off',async()=>{
  for(const fresh of [false,true]){
    const {counts,ctx}=recoveryFixture({redirects:0,fresh,loginLanding:TRANSACTIONS});
    await search('customer','12345678',ctx);
    assert.equal(counts.logoffs,0);assert.equal(counts.loads,1);assert.equal(counts.logins,fresh?1:0);
  }
});
test('recovery does not loop if the retried request returns to the transaction list',async()=>{
  const {counts,session,ctx}=recoveryFixture({redirects:2});
  await assert.rejects(search('customer','12345678',ctx),/transaction list again/);
  assert.equal(counts.logoffs,1);assert.equal(counts.logins,1);assert.equal(counts.loads,2);
  assert.deepEqual(counts.fills,[]);assert.equal(session.lastQuery,0);
});
test('a missing log-off link fails without submitting and invalidates the stale session hint',async()=>{
  const {counts,session,ctx}=recoveryFixture({missingLogoff:true});
  await assert.rejects(search('customer','12345678',ctx),/Log off link was not found/);
  assert.equal(counts.logins,0);assert.deepEqual(counts.fills,[]);assert.equal(session.lastQuery,0);
});
test('the transaction-list recovery is not applied after submitting a search',async()=>{
  const {counts,ctx}=recoveryFixture({redirects:0,laterRedirect:true});
  await assert.rejects(search('customer','12345678',ctx),/Later website failure/);
  assert.equal(counts.logoffs,0);assert.equal(counts.loads,1);
});

test('Stop during log off prevents the recovery login and retry',async()=>{
  const run=new SearchRun();
  const {counts,session,ctx}=recoveryFixture({onLogoff:()=>run.cancel()});
  await assert.rejects(search('customer','12345678',{...ctx,run}),error=>error.name==='AbortError');
  assert.equal(counts.logoffs,1);assert.equal(counts.logins,0);assert.equal(counts.loads,1);
  assert.equal(session.lastQuery,0);assert.deepEqual(counts.fills,[]);
});

test('a pending first navigation is not mistaken for a completed transaction-list redirect',async()=>{
  const {counts,ctx}=recoveryFixture({redirects:0,pendingInitial:true});
  await search('customer','12345678',ctx);
  assert.equal(counts.logoffs,0);assert.equal(counts.loads,1);assert.equal(counts.logins,0);
  assert.deepEqual(counts.fills,['12345678']);
});
