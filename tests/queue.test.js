// Worker integration harness: queue commits, cancellation, panels, history, and settings races.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MEMBER, PDF_URL, isPdf} from '../extension/core.js';
import {addBlacklistEntry} from '../extension/vault.js';
import {driverReport, vehicleReport} from './barcode-fixtures.js';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(fn){this.listeners=this.listeners.filter(x=>x!==fn);}});
const local={history:[{id:'old-persistent',kind:'plate',value:'OLD123',at:1}]}, session={history:[],lastQuery:Date.now(),portalId:1,pdfCreated:{2:100},'pdf:2':{text:'Owner Number: 00001234\nCustomer Number: 87654321\nOwner Number: 1234'}};
const tabs=new Map([[1,{id:1,url:`${MEMBER}Transactions/DrvRec/Page2.aspx`,status:'complete',windowId:1,active:false}],[2,{id:2,url:PDF_URL,status:'complete',windowId:1,active:true}]]);
const windows=[], submissions=[], navigations=[], submittedQueries=[];
let serverFailureStage='', nextId=3, invalid=false, invalidAfterSubmit=false, technicalFailure=false, loginRejected=false, blockSubmitted=false, captureBlocked=false, onResultFocus=null;
let reportIdentity;
let reportText='Driver License No: 123456789 Name: TEST, PERSON\nDOB: 01/01/2000';
let pauseAlertWindow=false,alertWindowRelease;
const removedWindows=[],removedTabs=[];
const store=data=>({clear:async()=>{for(const key of Object.keys(data))delete data[key];},get:async keys=>typeof keys==='string'?{[keys]:data[keys]}:Array.isArray(keys)?Object.fromEntries(keys.map(k=>[k,data[k]])):{...data},set:async values=>Object.assign(data,values),remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete data[k];},setAccessLevel:async()=>{}});
const runtimeMessages=[],routingUpdates=[],themeRegistrations=[],themeCss=[];
let registeredThemes=[];
const runtime={sendMessage:async message=>{runtimeMessages.push(message);},id:'a'.repeat(32),getURL:path=>`chrome-extension://${'a'.repeat(32)}/${path}`,onMessage:event(),onConnect:event(),onStartup:event(),onInstalled:event()};
globalThis.chrome={
  runtime,webNavigation:{onCommitted:event(),getFrame:async({tabId})=>({documentId:tabs.get(tabId)?.documentId})},declarativeNetRequest:{updateDynamicRules:async rules=>{routingUpdates.push(rules);}},storage:{local:store(local),session:store(session)},
  tabs:{
    query:async opts=>[...tabs.values()].filter(t=>!opts.active||t.active).map(t=>({...t})),
    get:async id=>({...tabs.get(id)}),
    create:async opts=>{const tab={id:nextId++,url:opts.url,status:'complete',windowId:1,active:!!opts.active};tabs.set(tab.id,tab);return {...tab};},
    update:async(id,update)=>{if(update.url)navigations.push(update.url);const tab=tabs.get(id);Object.assign(tab,update);if(update.active){for(const t of tabs.values())if(t.id!==id)t.active=false;if(onResultFocus&&isPdf(tab.url)){const hook=onResultFocus;onResultFocus=null;queueMicrotask(hook);}}return {...tab};},
    sendMessage:async()=>{},remove:async id=>{removedTabs.push(id);},onCreated:event(),onUpdated:event(),onRemoved:event()
  },
  windows:{get:async()=>({id:1,state:'normal'}),update:async()=>{},onRemoved:event(),create:async data=>{const win={id:windows.length+10,...data};windows.push(win);if(pauseAlertWindow&&session[`panel:${new URL(data.url).searchParams.get('id')}`]?.type==='record-alert')await new Promise(resolve=>{alertWindowRelease=resolve;});return win;},remove:async id=>{removedWindows.push(id);}},
  scripting:{getRegisteredContentScripts:async()=>registeredThemes,registerContentScripts:async scripts=>{registeredThemes=scripts;themeRegistrations.push(scripts);},updateContentScripts:async scripts=>{registeredThemes=scripts;themeRegistrations.push(scripts);},unregisterContentScripts:async()=>{registeredThemes=[];},insertCSS:async options=>{themeCss.push({enabled:true,...options});},removeCSS:async options=>{themeCss.push({enabled:false,...options});},executeScript:async request=>{
    if(request.files)return [];
    const {target,args:[op,args]}=request;
    const tab=tabs.get(target.tabId); let result=true;
    if(op==='fill'&&technicalFailure)throw new Error('Script connection lost');
    if(op==='state')result={url:tab.url,present:true,enabled:true,presentSelectors:args.selectors?.map(()=>true)||[],errors:(invalid&&tab.url.includes('Page1.aspx'))||(invalidAfterSubmit&&tab.url.includes('Page2.aspx'))?['Invalid customer number']:[]};
    if(op==='state'&&tab.url===MEMBER+'ErrorPage.aspx')Object.assign(result,{errors:['An unexpected error occurred'],portalError:true});
    if(op==='state'&&loginRejected&&tab.url.endsWith('/logon.aspx'))result.errors=['Invalid User ID Or Password'];
    if(op==='extensionLogin'&&args.submit&&!loginRejected)tab.url=`${MEMBER}Disclaimer.aspx`;
    if(op==='fill')submissions.push(args.value);
    if(op==='click'&&args.selector==='#btnFooterNavNext') {submittedQueries.push(submissions.at(-1));if(serverFailureStage==='submit')tab.url=MEMBER+'ErrorPage.aspx';else if(!invalid&&!blockSubmitted)tab.url=tab.url.replace('Page1.aspx','Page2.aspx');}
    if(op==='fetchPdf'&&captureBlocked)return new Promise(()=>{});
    if(op==='click'&&args.selector==='#downloadButton'){
      if(serverFailureStage==='download'){tab.url=MEMBER+'ErrorPage.aspx';return [{result:true}];}
      const pdf={id:nextId++,url:PDF_URL,status:'complete',windowId:1,openerTabId:tab.id,active:false};tabs.set(pdf.id,pdf);
      if(captureBlocked)session.pdfCreated[pdf.id]=Date.now();
      else session[`pdf:${pdf.id}`]={text:reportText,capturedAt:Date.now(),...(reportIdentity?{driverIdentity:reportIdentity}:{})};
    }
    return [{result}];
  }},commands:{onCommand:event(),getAll:async()=>[]},permissions:{contains:async()=>true}
};
await import('../extension/background.js');
const send=(message,view='popup.html')=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,{id:runtime.id,url:runtime.getURL(view)},r=>r.ok?resolve(r.value):reject(new Error(r.error))));
/** Bound asynchronous worker expectations so a stalled workflow fails the test promptly. */
async function wait(fn){const end=Date.now()+4000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Queue test timed out.');}
test('startup removes persistent history without changing current session history',async()=>{
  assert.deepEqual((await send({type:'state'})).history,[]);
  assert.equal(local.history,undefined);
});

test('queue starts with first unique number, consumes portal-rejected last item, and offers restart',async()=>{
  await send({type:'run',command:'owners'});
  await wait(()=>session.queue?.index===1);
  assert.deepEqual(session.queue.values,['1234','87654321']);assert.equal(submissions[0],'1234');
  // A visible DMV rejection consumes the attempted item and is labeled as an error in history.
  invalid=true;await send({type:'run',command:'next'});
  await wait(()=>windows.some(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type==='notice'));
  assert.equal(session.queue.index,2);assert.equal(session.history.length,2);
  assert.equal(session.history[0].outcome,'error');assert.equal(session.history[0].value,'87654321');
  invalid=false;await send({type:'run',command:'next'});
  await wait(()=>windows.some(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type==='restart'));
  const restart=windows.find(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type==='restart');
  await send({type:'panel-submit',id:new URL(restart.url).searchParams.get('id'),value:true});
  await wait(()=>session.queue.index===1&&session.history.length===3);
  assert.equal(submissions.at(-1),'1234');
  assert.equal(tabs.get(1).url.includes('Page2.aspx'),true);
});
/** Find the latest live panel of a type through the same session data used by extension views. */
function panel(type) { return windows.findLast(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type===type); }
/** Submit an identifier through the actual worker prompt protocol rather than calling automation directly. */
async function input(value,command='customer') {
  await send({type:'run',command}); await wait(()=>panel('input'));
  await send({type:'panel-submit',id:new URL(panel('input').url).searchParams.get('id'),value});
}
test('previous moves back through the saved queue; Next returns forward and DMV errors move to the attempted position',async()=>{
  session.queue={values:['101','202','303'],index:3};
  const before=submissions.length;await send({type:'run',command:'previous'});await wait(()=>session.queue.index===2);
  assert.equal(submissions.at(-1),'202');
  invalid=true;await send({type:'run',command:'previous'});await wait(()=>panel('notice'));
  assert.equal(session.queue.index,1);invalid=false;
  await send({type:'run',command:'next'});await wait(()=>session.queue.index===2);
  await send({type:'run',command:'previous'});await wait(()=>session.queue.index===1);assert.equal(submissions.at(-1),'101');
  const end=submissions.length;await send({type:'run',command:'previous'});await wait(()=>panel('notice'));assert.equal(submissions.length,end);
  await send({type:'run',command:'next'});await wait(()=>session.queue.index===2);assert.equal(submissions.at(-1),'202');
  delete session.queue;const empty=submissions.length;await send({type:'run',command:'previous'});await wait(()=>panel('notice'));assert.equal(submissions.length,empty);
  assert.ok(submissions.length>before);
});

test('Stop cancels a stalled query, preserves history/queue and allows an immediate new search',async()=>{
  const before=session.history.length;session.queue={values:['101','202'],index:1};
  blockSubmitted=true;await input('50000000');await wait(()=>submissions.at(-1)==='50000000');
  await send({type:'stop'});assert.equal(session.status,'Stopped');
  blockSubmitted=false;await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(session.history.length,before);assert.equal(session.queue.index,1);assert.equal(panel('notice'),undefined);
  await input('50000001');await wait(()=>session.history[0].value==='50000001');
});

test('Stop dismisses pending input and prevents its delayed submission',async()=>{
  const before=submissions.length;await input('50000002');await send({type:'stop'});
  await new Promise(resolve=>setTimeout(resolve,250));assert.equal(submissions.length,before);assert.equal(panel('input'),undefined);
});

test('a new query replaces a stalled search without stale errors or history entries',async()=>{
  const history=session.history.length, notices=windows.length;
  blockSubmitted=true; await input('11111111'); await wait(()=>submissions.at(-1)==='11111111');
  blockSubmitted=false; await input('22222222');
  await wait(()=>session.history.length===history+1);
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(session.history[0].value,'22222222');
  assert.equal(session.history.slice(0,1).some(x=>x.value==='11111111'),false);
  assert.equal(windows.slice(notices).some(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type==='notice'),false);
});
test('a newer command invalidates a previously submitted input panel delay',async()=>{
  const before=submissions.length;
  await input('33333333'); await input('44444444');
  await wait(()=>submissions.includes('44444444'));
  await new Promise(resolve=>setTimeout(resolve,300));
  assert.deepEqual(submissions.slice(before),['44444444']);
});
test('completed results and queued progress are not blocked by unfinished PDF extraction',async()=>{
  const history=session.history.length; captureBlocked=true;
  await input('55555555'); await wait(()=>session.history.length===history+1);
  captureBlocked=false; await input('66666666'); await wait(()=>session.history.length===history+2);
  assert.equal(session.history[0].value,'66666666');
});
test('new input commands dismiss a pending queue restart panel',async()=>{
  session.queue={values:['1234'],index:1};
  await send({type:'run',command:'next'}); await wait(()=>panel('restart'));
  const previous=panel('restart'); await send({type:'run',command:'customer'});
  await wait(()=>panel('input'));
  assert.ok(removedWindows.includes(previous.id));
  assert.equal(panel('restart'),undefined);
});
test('Alt+N bootstraps an empty queue from a twelve-customer residence report and visits every unique number',async()=>{
  const values=Array.from({length:12},(_,i)=>String(41000001+i));
  const report='Customers at Same Residence\n'+values.map(value=>`Customer Number: ${value}\nBirthdate: 01/01/2000\nFICTIONAL PERSON`).join('\n');
  session['pdf:2']={text:report,capturedAt:Date.now()};delete session.queue;
  for(const tab of tabs.values())tab.active=tab.id===2;
  const before=submissions.length;
  for(let i=0;i<values.length;i++){
    await send({type:'run',command:'next'});await wait(()=>session.queue?.index===i+1);
  }
  assert.deepEqual(submissions.slice(before),values);
  assert.deepEqual(session.queue.values,values);
  assert.equal(session.queue.sourceTabId,2);
});
test('pressing Next as soon as results receive focus uses the following queued number',async()=>{
  const values=['42000001','42000002'];session.queue={values,index:0,sourceTabId:2};
  const before=submissions.length;
  onResultFocus=()=>{send({type:'run',command:'next'}).catch(error=>{throw error;});};
  await send({type:'run',command:'next'});await wait(()=>session.queue.index===2);
  assert.deepEqual(submissions.slice(before),values);
});
test('recent history reruns plate, DL, customer, and same-address searches without an input panel or source PDF',async()=>{
  for(const [kind,value,expected] of [['plate','ZZZ12345','ZZZ12345'],['license','135791357','135791357'],['customer','01234567','1234567'],['address','246802468','246802468']]){
    const saved={id:`saved-${kind}`,kind,value,at:1700000000000};session.history.unshift(saved);
    const before=submissions.length,windowCount=windows.length;
    await send({type:'rerun',search:{id:saved.id}});
    await wait(()=>session.history[0].id!==saved.id&&session.history[0].kind===kind&&session.history[0].value===expected);
    assert.equal(submissions[before],expected);
    assert.equal(windows.length,windowCount,'Reruns must not open an input panel.');
  }
});
test('SCUTTIES reruns both old and structured history with the stored identity instead of the current PDF',async()=>{
  for(const identity of [undefined,{lastName:'DE LA CRUZ',dob:'01/02/2000'}]){
    const saved={id:crypto.randomUUID(),kind:'scutties',value:'DE LA CRUZ · 01/02/2000',at:1700000000001,...(identity?{identity}:{})};session.history.unshift(saved);
    const before=submissions.length;
    await send({type:'rerun',search:identity?{id:saved.id}:{kind:saved.kind,value:saved.value,at:saved.at}});
    await wait(()=>session.history[0].id!==saved.id&&session.history[0].kind==='scutties');
    assert.deepEqual(submissions.slice(before),['DE LA CRUZ','01/02/2000']);
    assert.deepEqual(session.history[0].identity,{lastName:'DE LA CRUZ',dob:'01/02/2000'});
  }
});
test('stale history clicks are rejected before starting a search',async()=>{
  const before=submissions.length;
  await assert.rejects(send({type:'rerun',search:{id:'deleted-entry'}}),/no longer in recent history/);
  assert.equal(submissions.length,before);
});
test('login asks for extension credentials even when a portal form already exists',async()=>{
  delete session.credentials;session.lastQuery=0;tabs.get(1).url=`${MEMBER}logon.aspx`;
  const before=submissions.length;await input('43000001');await wait(()=>panel('credentials'));
  assert.equal(submissions.length,before);
  const request=panel('credentials');
  await send({type:'panel-submit',id:new URL(request.url).searchParams.get('id'),user:'extension-user',password:'extension-password',save:false});
  await wait(()=>submissions.length>before);
  assert.equal(submissions[before],'43000001');
  assert.deepEqual(session.credentials,{user:'extension-user',password:'extension-password'});
});
test('record alerts are off by default and their toggle is saved persistently',async()=>{
  assert.equal((await send({type:'state'})).alertsEnabled,false);
  reportText='Plate Class: ABC Decal Exp Date: 01/01/2000 Enforcement Description: Insurance suspension Enforcement Statute: 56-1-460';
  const before=submissions.length;await input('ALRT100','plate');await wait(()=>submissions.length>before&&session.history[0].value==='ALRT100');
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(panel('record-alert'),undefined);
  await send({type:'alerts',enabled:true});assert.equal((await send({type:'state'})).alertsEnabled,true);assert.equal(local.alertsEnabled,undefined);
});
test('a combined plate status creates one alert and a new search closes it before showing driver status',async()=>{
  const before=submissions.length;await input('ALRT200','plate');await wait(()=>panel('record-alert'));
  const previous=panel('record-alert'),data=session[`panel:${new URL(previous.url).searchParams.get('id')}`];
  assert.deepEqual(data.sections.map(section=>section.title),['TAG SUSPENDED','EXPIRED']);assert.equal(data.autoCloseMs,90000);
  assert.equal(submissions[before],'ALRT200');
  reportText='Status - DL: NO SUSPENSION Driver License No: 123456789 Name: FICTIONAL, PERSON License Information Type Class Function Issued Expires Printed Date Restr.Endor.Document Identifier Current (ACN / DDN) DL Renewal 01/01/2020 12/31/2099 01/01/2020';
  await input('44000001');await wait(()=>panel('record-alert'));
  assert.ok(removedWindows.includes(previous.id));
  const current=panel('record-alert'),result=session[`panel:${new URL(current.url).searchParams.get('id')}`];
  assert.equal(result.sections[0].title,'VALID LICENSE');assert.equal(result.autoCloseMs,30000);
  await send({type:'alerts',enabled:false});assert.equal(panel('record-alert'),undefined);assert.ok(removedWindows.includes(current.id));
});
test('disabling alerts or replacing a query suppresses a pending PDF analysis',async()=>{
  await send({type:'alerts',enabled:true});captureBlocked=true;
  const before=session.history[0].id;await input('44000002');await wait(()=>session.history[0].id!==before);
  await send({type:'alerts',enabled:false});captureBlocked=false;
  await input('44000003');await wait(()=>session.history[0].value==='44000003');
  assert.equal(panel('record-alert'),undefined);
});
test('browser startup restores the saved alert preference',async()=>{
  await send({type:'alerts',enabled:true});
  delete session.alertsEnabled;for(const listener of runtime.onStartup.listeners)await listener();
  assert.equal(session.alertsEnabled,true);assert.equal(local.alertPreferences.alertsEnabled,true);await send({type:'alerts',enabled:false});
});
test('driver identity preference gates license alerts and never attaches identity to plate alerts',async()=>{
  await send({type:'alerts',enabled:true});await send({type:'driver-identity-settings',enabled:true});
  assert.equal((await send({type:'state'})).showDriverIdentity,true);assert.equal(local.alertPreferences.showDriverIdentity,true);
  reportIdentity={name:'SYNTHETIC, DRIVER',photo:'data:image/png;base64,AAAA'};
  await input('44000011');await wait(()=>panel('record-alert'));
  let data=session[`panel:${new URL(panel('record-alert').url).searchParams.get('id')}`];
  assert.deepEqual(data.driverIdentity,reportIdentity);
  assert.equal(local.alertPreferences.driverIdentity,undefined);
  await send({type:'driver-identity-settings',enabled:false});await input('44000012');await wait(()=>panel('record-alert'));
  data=session[`panel:${new URL(panel('record-alert').url).searchParams.get('id')}`];assert.equal(data.driverIdentity,undefined);
  await send({type:'driver-identity-settings',enabled:true});await input('PHOTO123','plate');await wait(()=>panel('record-alert'));
  data=session[`panel:${new URL(panel('record-alert').url).searchParams.get('id')}`];assert.equal(data.driverIdentity,undefined);
  await send({type:'driver-identity-settings',enabled:false});reportIdentity=undefined;await send({type:'alerts',enabled:false});
});
test('turning alerts off during popup creation closes the late window as well',async()=>{
  await send({type:'alerts',enabled:true});pauseAlertWindow=true;
  await input('44000004');await wait(()=>alertWindowRelease);
  const pending=windows.at(-1);await send({type:'alerts',enabled:false});
  pauseAlertWindow=false;alertWindowRelease();await wait(()=>removedWindows.includes(pending.id));
  assert.equal(panel('record-alert'),undefined);
});

test('barcode command uses the focused report, creates no query, and a new search dismisses its popup',async()=>{
  const focused=[...tabs.values()].find(tab=>tab.active);
  session[`pdf:${focused.id}`]={text:driverReport};
  const before=submissions.length;await send({type:'run',command:'barcode'});await wait(()=>panel('barcode'));
  const barcode=panel('barcode');assert.match(barcode.url,/barcode\.html/);assert.equal(submissions.length,before);
  const data=session[`panel:${new URL(barcode.url).searchParams.get('id')}`];
  assert.match(data.payload,/DCA[D]\n/);assert.equal(data.kind,'driver');
  await input('44000005');await wait(()=>session.history[0].value==='44000005');assert.ok(removedWindows.includes(barcode.id));
});

test('installation opens setup once; updates retire companion state and preserve history and browser assignments',async()=>{
  const before=windows.length, savedHistory=structuredClone(session.history);
  local.bindings={plate:'Alt+P'}; session.nativeStatus='Connected'; session.nativeErrors=[];
  for(const listener of runtime.onInstalled.listeners)await listener({reason:'install'});
  assert.equal(windows.length,before+1);assert.match(windows.at(-1).url,/shortcut-setup\.html$/);
  assert.equal(windows.at(-1).type,'popup');assert.equal(windows.at(-1).focused,true);
  for(const listener of runtime.onInstalled.listeners)await listener({reason:'update'});
  assert.equal(windows.length,before+1);assert.equal(local.bindings,undefined);assert.equal(session.nativeStatus,undefined);assert.equal(session.nativeErrors,undefined);assert.deepEqual(session.history,savedHistory);
  await send({type:'shortcut-setup'});assert.equal(windows.length,before+2);
});

test('speech runs with visual alerts off and startup restores saved audio options',async()=>{
  const spoken=[];
  chrome.tts={stop(){},getVoices:cb=>cb([{voiceName:'Microsoft David Desktop',lang:'en-US'}]),speak(text,options,callback){spoken.push(text);callback();queueMicrotask(()=>options.onEvent({type:'end'}));}};
  await send({type:'audio-settings',speechEnabled:true,voiceSource:'microsoft',repeatSpeech:true,voiceGender:'male'});
  assert.equal(session.speechEnabled,true);assert.equal(local.speechEnabled,undefined);
  reportText='Plate Class: ABC Decal Exp Date: 12/31/2099';
  await input('SPEECH1','plate');await wait(()=>spoken.length===2);
  assert.deepEqual(spoken,['Valid tag','Valid tag']);assert.equal(panel('record-alert'),undefined);
  await send({type:'audio-settings',suspendedClipEnabled:true});
  for(const listener of runtime.onStartup.listeners)await listener();
  assert.equal(session.speechEnabled,true);assert.equal(session.suspendedClipEnabled,true);
  assert.equal(session.repeatSpeech,true);assert.equal(session.voiceGender,'male');assert.equal(local.alertPreferences.voiceSource,'microsoft');
  await send({type:'audio-settings',speechEnabled:false,suspendedClipEnabled:false,repeatSpeech:false});
});

test('background passes the selected exclusive voice source and gender to recorded and Microsoft announcements',async()=>{
  const played=[],spoken=[];let documentOpen=false;
  runtime.sendMessage=async message=>{played.push(message);return {ok:true};};
  chrome.offscreen={hasDocument:async()=>documentOpen,createDocument:async()=>{documentOpen=true;},closeDocument:async()=>{documentOpen=false;}};
  chrome.tts={stop(){},getVoices:cb=>cb([{voiceName:'Microsoft David Desktop',lang:'en-US'}]),speak(text,options,callback){spoken.push({text,voice:options.voiceName});callback();queueMicrotask(()=>options.onEvent({type:'end'}));}};
  await send({type:'audio-settings',speechEnabled:true,voiceSource:'recordings',voiceGender:'male',repeatSpeech:false});
  reportText=driverReport;await input('51000001');await wait(()=>played.length===1);
  assert.equal(spoken.length,0);assert.deepEqual(played[0].files,['audio/voices/Male_Valid_Drivers_License.mp3']);assert.equal(played[0].repeat,1);
  await assert.rejects(send({type:'audio-settings',voiceSource:'both'}),/Choose bundled recordings or Microsoft speech/);
  await send({type:'audio-settings',voiceSource:'microsoft'});await input('51000002');await wait(()=>spoken.length===1);
  assert.equal(played.length,1);assert.equal(spoken[0].voice,'Microsoft David Desktop');
  assert.equal((await send({type:'state'})).voiceSource,'microsoft');
  await send({type:'audio-settings',speechEnabled:false});
});



test('recent history stays session-only, remains capped at twenty, and clears independently',async()=>{
  const previousHistory=structuredClone(session.history), previousQueue=structuredClone(session.queue);
  const savedVault={ciphertext:'test-vault'};local.vault=savedVault;session.unlockedVault=JSON.stringify([savedVault.salt,savedVault.iv,savedVault.ciphertext]);session.blacklist=[];session.vaultKey='fixture-key';
  session.history=Array.from({length:20},(_,i)=>({id:'session-'+i,kind:'customer',value:String(80000000+i),at:i}));
  await input('70000001');await wait(()=>session.history[0].value==='70000001');
  assert.equal(session.history.length,20);assert.equal(session.history.at(-1).id,'session-18');
  assert.equal(local.history,undefined);
  assert.deepEqual((await send({type:'state'})).history,session.history);
  await send({type:'clear-history'});assert.equal(session.history,undefined);
  assert.deepEqual(local.vault,savedVault);assert.deepEqual(session.queue,previousQueue);
  await assert.rejects(send({type:'rerun',search:{id:'session-0'}}),/no longer in recent history/);
  session.history=previousHistory;delete local.vault;delete session.unlockedVault;delete session.blacklist;delete session.vaultKey;
});

test('Collect on a same-residence report retains the first customer, starts at second, and navigates both directions', async()=>{
  const values=['51000001','51000002','51000003'];
  session['pdf:2']={text:'Customers at Same Residence\n'+values.map(n=>`Customer Number: ${n}\nBirthdate: 01/01/2000\nFICTIONAL PERSON`).join('\n')};
  for(const tab of tabs.values())tab.active=tab.id===2;
  const before=submissions.length;
  await send({type:'run',command:'owners'});await wait(()=>session.queue?.values[0]===values[0]&&session.queue.index===2);
  assert.deepEqual(session.queue.values,values);assert.equal(session.queue.sourceTabId,2);
  assert.deepEqual(submissions.slice(before),[values[1]]);
  await send({type:'run',command:'next'});await wait(()=>session.queue.index===3);
  assert.equal(submissions.at(-1),values[2]);
  await send({type:'run',command:'previous'});await wait(()=>session.queue.index===2);
  await send({type:'run',command:'previous'});await wait(()=>session.queue.index===1);
  assert.equal(submissions.at(-1),values[0]);
  await send({type:'run',command:'next'});await wait(()=>session.queue.index===2);
  assert.equal(submissions.at(-1),values[1]);
});
test('DMV rejection of the second residence customer lets Next continue to the third',async()=>{
  session['pdf:2']={text:'Customers at Same Residence\nCustomer Number: 52000001\nCustomer Number: 52000002\nCustomer Number: 52000003'};
  for(const tab of tabs.values())tab.active=tab.id===2;
  invalid=true;await send({type:'run',command:'owners'});await wait(()=>panel('notice'));
  assert.equal(session.queue.index,2);assert.deepEqual(session.queue.values,['52000001','52000002','52000003']);
  invalid=false;await send({type:'run',command:'next'});await wait(()=>session.queue.index===3);
  assert.equal(submissions.at(-1),'52000003');
});
test('Collect starts at first for single-customer residences and other PDF report types',async()=>{
  for(const text of ['Customers at Same Residence\nCustomer Number: 53000001', 'Owner Number: 53000001\nOwner Number: 53000002', 'Other report\nCustomer Number: 53000001\nCustomer Number: 53000002']){
    session['pdf:2']={text};for(const tab of tabs.values())tab.active=tab.id===2;
    const before=submissions.length;await send({type:'run',command:'owners'});await wait(()=>submissions.length>before&&session.queue.index===1);
    assert.equal(submissions.at(-1),'53000001');
  }
});

test('keyboard commands remain active even with a retired pause preference',async()=>{
  session.shortcutsPaused=true;
  await chrome.commands.onCommand.listeners[0]('customer');
  await wait(()=>panel('input'));
  await send({type:'stop'});
  delete session.shortcutsPaused;
});

test('Collect records a DMV-rejected first customer as an error and Next continues',async()=>{
  session['pdf:2']={text:'Owner Number: 61000001\nOwner Number: 61000002'};
  for(const tab of tabs.values())tab.active=tab.id===2;
  const historyBefore=session.history.length;invalid=true;
  await send({type:'run',command:'owners'});await wait(()=>panel('notice'));
  assert.equal(session.queue.index,1);assert.equal(session.history.length,Math.min(20,historyBefore+1));
  assert.equal(session.history[0].outcome,'error');assert.equal(session.history[0].errorMessage,'Invalid customer number');
  assert.equal(session.status,'Invalid customer number');
  invalid=false;await send({type:'run',command:'next'});await wait(()=>session.queue.index===2);
  assert.equal(submissions.at(-1),'61000002');
  assert.equal(session.history[0].outcome,undefined);assert.equal(session.history[1].outcome,'error');
  const saved=structuredClone(session.queue);const failed=session.history[1];
  await send({type:'rerun',search:{id:failed.id}});await wait(()=>session.history[0].value==='61000001'&&session.history[0].id!==failed.id);
  assert.deepEqual(session.queue,saved);assert.equal(session.history[0].outcome,undefined);
});
test('a DMV error after submission consumes a middle queued customer and keeps the error alert',async()=>{
  session.queue={values:['62000001','62000002','62000003'],index:1};
  const historyBefore=session.history.length;invalidAfterSubmit=true;
  await send({type:'run',command:'next'});await wait(()=>panel('notice'));
  assert.equal(session.queue.index,2);assert.equal(session.history.length,Math.min(20,historyBefore+1));
  assert.equal(session.history[0].outcome,'error');assert.equal(session.history[0].errorMessage,'Invalid customer number');
  assert.equal(session.status,'Invalid customer number');
  invalidAfterSubmit=false;await send({type:'run',command:'next'});await wait(()=>session.queue.index===3);
  assert.equal(submissions.at(-1),'62000003');
});
test('technical failures preserve the pending queued customer for retry',async()=>{
  session.queue={values:['63000001','63000002'],index:0};technicalFailure=true;
  await send({type:'run',command:'next'});await wait(()=>panel('notice'));
  assert.equal(session.queue.index,0);assert.equal(session.status,'Script connection lost');
  technicalFailure=false;await send({type:'run',command:'next'});await wait(()=>session.queue.index===1);
  assert.equal(submissions.at(-1),'63000001');
});

test('login errors do not consume a queued customer',async()=>{
  session.queue={values:['64000001','64000002'],index:0};
  session.lastQuery=0;session.credentials={user:'fixture-user',password:'fixture-password'};
  tabs.get(session.portalId).url=`${MEMBER}logon.aspx`;loginRejected=true;
  await send({type:'run',command:'next'});await wait(()=>panel('notice'));
  assert.equal(session.queue.index,0);assert.equal(session.status,'Invalid User ID Or Password');
  loginRejected=false;session.lastQuery=Date.now();tabs.get(session.portalId).url=`${MEMBER}Disclaimer.aspx`;
});
test('a manually entered customer error leaves an existing queue untouched',async()=>{
  session.queue={values:['65000001','65000002'],index:1};const saved=structuredClone(session.queue);
  invalid=true;await input('65000099');await wait(()=>panel('notice'));
  assert.deepEqual(session.queue,saved);invalid=false;
});

const BLACKLIST_PHRASE='blacklist fixture passphrase';
const blockedPanel=()=>{
  const win=panel('record-alert');return win&&session[`panel:${new URL(win.url).searchParams.get('id')}`]?.blacklist?win:null;
};
test('blacklist blocks plate, DL, customer, same-address and history searches before portal navigation',async()=>{
  const setup=send({type:'blacklist-setup'});await wait(()=>panel('credentials'));
  const id=new URL(panel('credentials').url).searchParams.get('id'),beforeSetup=navigations.length;
  assert.equal(session[`panel:${id}`].setupOnly,true);
  await assert.rejects(send({type:'panel-submit',id,user:'fixture-user',password:'fixture-password',save:false}),/Save the encrypted vault/);
  await send({type:'panel-submit',id,user:'fixture-user',password:'fixture-password',save:true,passphrase:BLACKLIST_PHRASE});
  assert.equal((await setup).unlocked,true);assert.equal(navigations.length,beforeSetup);
  await assert.rejects(send({type:'blacklist-setup'}),/already exists/);
  for(const [kind,value] of [['plate','BLOCK123'],['license','123456789'],['customer','12345678']])await addBlacklistEntry(kind,value,BLACKLIST_PHRASE);
  session.alertsEnabled=false;
  for(const [kind,value] of [['plate','block123'],['license','123456789'],['customer','00012345678']]){
    const before=navigations.length,submitted=submittedQueries.length;
    await input(value,kind);await wait(blockedPanel);
    assert.equal(navigations.length,before);assert.equal(submittedQueries.length,submitted);
    const data=session[`panel:${new URL(blockedPanel().url).searchParams.get('id')}`];
    assert.equal(data.tone,'danger');assert.match(data.sections[0].title,/is blacklisted.*suspended or revoked/);
    await send({type:'alerts',enabled:false});assert.ok(blockedPanel(),'Blacklist warnings cannot be disabled with optional status alerts');
  }
  session['pdf:2']={text:driverReport};for(const tab of tabs.values())tab.active=tab.id===2;
  let before=navigations.length;await send({type:'run',command:'address'});await wait(blockedPanel);assert.equal(navigations.length,before);
  const saved={id:'blocked-replay',kind:'customer',value:'12345678',at:Date.now()};session.history.unshift(saved);
  before=navigations.length;await send({type:'rerun',search:{id:saved.id}});await wait(blockedPanel);assert.equal(navigations.length,before);
});
test('blocked queued numbers are retained but consumed so Next and Previous remain usable',async()=>{
  session.queue={values:['12345678','70000001'],index:0};
  let before=submittedQueries.length;
  await send({type:'run',command:'next'});await wait(blockedPanel);
  assert.equal(session.queue.index,1);assert.deepEqual(session.queue.values,['12345678','70000001']);assert.equal(submittedQueries.length,before);
  await send({type:'run',command:'next'});await wait(()=>session.queue.index===2);assert.equal(submittedQueries.at(-1),'70000001');
  before=submittedQueries.length;await send({type:'run',command:'previous'});await wait(blockedPanel);
  assert.equal(session.queue.index,1);assert.equal(submittedQueries.length,before);
  session['pdf:2']={text:'Owner Number: 12345678\nOwner Number: 70000001'};for(const tab of tabs.values())tab.active=tab.id===2;
  await send({type:'run',command:'owners'});await wait(blockedPanel);assert.equal(session.queue.index,1);
});
test('locked vaults require the passphrase even when credentials are cached and a DMV session is fresh',async()=>{
  delete session.unlockedVault;delete session.blacklist;delete session.vaultKey;session.lastQuery=Date.now();
  const before=navigations.length;
  await input('70000002');await wait(()=>panel('credentials'));
  const id=new URL(panel('credentials').url).searchParams.get('id');assert.equal(session[`panel:${id}`].unlockOnly,true);
  assert.equal(navigations.length,before);
  await assert.rejects(send({type:'panel-submit',id,unlock:false,user:'different-user',password:'different-password'}),/Could not unlock/);
  await assert.rejects(send({type:'panel-submit',id,unlock:true,passphrase:'incorrect passphrase'}),/Could not unlock/);
  assert.equal(navigations.length,before);
  await send({type:'panel-submit',id,unlock:false,blacklistPassphrase:BLACKLIST_PHRASE,user:'different-fixture-user',password:'different-fixture-password',save:false});await wait(()=>submittedQueries.at(-1)==='70000002');
  assert.deepEqual(session.credentials,{user:'different-fixture-user',password:'different-fixture-password'});
  assert.ok(navigations.slice(before).some(url=>url.endsWith('/logon.aspx')),'Different credentials must force the login path');
  delete session.credentials;await send({type:'blacklist-unlock',passphrase:BLACKLIST_PHRASE});
  assert.deepEqual(session.credentials,{user:'different-fixture-user',password:'different-fixture-password'});
  assert.equal((await send({type:'state'})).blacklist.unlocked,true);
  await assert.rejects(send({type:'forget-credentials'}),/remove its blacklist entries/);
});
test('unlocked blacklist edits need only confirmation for removal, not another passphrase',async()=>{
  await assert.rejects(send({type:'blacklist-remove',kind:'plate',value:'BLOCK123',confirmed:false,passphrase:BLACKLIST_PHRASE}),/Confirm removal/);
  await assert.rejects(send({type:'blacklist-add',kind:'license',value:'ABC',passphrase:BLACKLIST_PHRASE}),/only numbers/);
  const key=session.vaultKey;delete session.vaultKey;
  await assert.rejects(send({type:'blacklist-remove',kind:'plate',value:'BLOCK123',confirmed:true}),/Unlock the vault/);session.vaultKey=key;
  const state=await send({type:'blacklist-remove',kind:'plate',value:'BLOCK123',confirmed:true,passphrase:BLACKLIST_PHRASE});
  assert.equal(state.entries.some(x=>x.kind==='plate'),false);
  await input('BLOCK123','plate');await wait(()=>submittedQueries.at(-1)==='BLOCK123');
});
test('adding a blacklist entry during navigation still prevents the final form submission',async()=>{
  const value='70000003',original=chrome.scripting.executeScript,before=submittedQueries.length;
  chrome.scripting.executeScript=async request=>{
    if(request.args[0]==='fill'&&request.args[1].value===value)await addBlacklistEntry('customer',value,BLACKLIST_PHRASE);
    return original(request);
  };
  try{
    await input(value);await wait(blockedPanel);assert.equal(submittedQueries.length,before);
  } finally {chrome.scripting.executeScript=original;}
});
test('SCUTTIES checks driver-report identifiers and stored replay identifiers before handoff',async()=>{
  session['pdf:2']={text:driverReport};for(const tab of tabs.values())tab.active=tab.id===2;
  const before=navigations.length;
  await send({type:'run',command:'scutties'});await wait(blockedPanel);assert.equal(navigations.length,before);
  const identity={lastName:'EXAMPLE',dob:'01/02/2000'};
  session.history.unshift({id:'blocked-scutties',kind:'scutties',identity,identifiers:[{kind:'customer',value:'12345678'}]});
  await send({type:'rerun',search:{id:'blocked-scutties'}});await wait(blockedPanel);assert.equal(navigations.length,before);
  session.history.unshift({id:'legacy-scutties',kind:'scutties',identity});
  await send({type:'rerun',search:{id:'legacy-scutties'}});await wait(()=>panel('notice'));
  assert.match(session.status,/identifiers can be checked/);assert.equal(navigations.length,before);
});

test('registrant/lessee numbers are queued as customers and honor customer blacklist entries',async()=>{
  session['pdf:2']={text:'Owner Number: 70000004\nRegistrant/Lessee Number: 00012345678\nRegistrant/Lessee Name: SYNTHETIC PERSON'};
  for(const tab of tabs.values())tab.active=tab.id===2;
  await send({type:'run',command:'owners'});await wait(()=>session.queue?.values[0]==='70000004'&&session.queue.index===1);
  assert.deepEqual(session.queue.values,['70000004','12345678']);
  const before=submittedQueries.length;await send({type:'run',command:'next'});await wait(blockedPanel);
  assert.equal(session.queue.index,2);assert.equal(submittedQueries.length,before);assert.match(session.status,/Customer number is blacklisted/);
});
test('confirmed login-popup reset deletes saved user info and cancels the pending login/search',async()=>{
  delete session.unlockedVault;delete session.vaultKey;delete session.blacklist;
  session.lastQuery=Date.now();session['pdf:reset-fixture']={text:'SYNTHETIC REPORT'};
  await input('70000008');await wait(()=>panel('credentials'));const before=navigations.length;
  await assert.rejects(send({type:'clear-saved-user-info',confirmed:false}),/Confirm deletion/);assert.ok(local.vault);
  const win=panel('credentials');await send({type:'clear-saved-user-info',confirmed:true});
  assert.equal(local.vault,undefined);assert.deepEqual(session,local.alertPreferences);assert.ok(removedWindows.includes(win.id));
  assert.equal(navigations.length,before);
});

/** Bind invented report text to the focused PDF tab for barcode workflow assertions. */
function barcodeSource(text){session['pdf:2']={text};for(const tab of tabs.values())tab.active=tab.id===2;}
const barcodeData=()=>{const win=panel('barcode');return win&&session[`panel:${new URL(win.url).searchParams.get('id')}`];};
test('incomplete first owner prompts for approval before using the next owner and preserves the captured report',async()=>{
  const text=vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS')
    .replace('Last Transaction: RENEWAL','Owner Number: 2222 Owner Name: NEXT, PERSON Owner Address: 456 NEXT ROAD, CHARLESTON SC 29401 Last Transaction: RENEWAL');
  barcodeSource(text);const before=submittedQueries.length;
  await send({type:'run',command:'barcode'});await wait(()=>panel('barcode-owner-incomplete'));
  const prompt=panel('barcode-owner-incomplete'),id=new URL(prompt.url).searchParams.get('id');
  assert.equal(session[`panel:${id}`].hasNext,true);assert.equal(barcodeData(),undefined);assert.equal(prompt.width,580);assert.equal(prompt.height,520);
  session['pdf:2']={text:'REPLACED SOURCE MUST NOT BE USED'};
  await send({type:'panel-submit',id,value:'next'});await wait(barcodeData);
  const payload=barcodeData().payload;assert.match(payload,/RBDNEXT\nRBEPERSON/);assert.match(payload,/RBI456 NEXT ROAD/);
  assert.doesNotMatch(payload,/UNPARSEABLE|EXAMPLE-SAMPLE/);assert.equal(submittedQueries.length,before);
});
test('one incomplete owner offers blanks without a next-owner option and encodes empty address fields',async()=>{
  barcodeSource(vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS'));
  await send({type:'run',command:'barcode'});await wait(()=>panel('barcode-owner-incomplete'));
  const id=new URL(panel('barcode-owner-incomplete').url).searchParams.get('id');
  assert.equal(session[`panel:${id}`].hasNext,false);assert.doesNotMatch(session[`panel:${id}`].message,/Another owner/);
  await send({type:'panel-submit',id,value:'blank'});await wait(barcodeData);
  assert.match(barcodeData().payload,/RBI\nRBK\nRBL\nRBM\n/);
  assert.ok(barcodeData().warnings.some(x=>/address fields are blank/.test(x)));
});
test('cancelling or replacing an incomplete-owner prompt never generates a barcode',async()=>{
  const text=vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS');
  barcodeSource(text);await send({type:'run',command:'barcode'});await wait(()=>panel('barcode-owner-incomplete'));
  const id=new URL(panel('barcode-owner-incomplete').url).searchParams.get('id');
  await send({type:'panel-submit',id,value:false});await wait(()=>/Barcode generation cancelled/.test(session.status));assert.equal(barcodeData(),undefined);
  barcodeSource(text);await send({type:'run',command:'barcode'});await wait(()=>panel('barcode-owner-incomplete'));
  await send({type:'stop'});assert.equal(panel('barcode-owner-incomplete'),undefined);assert.equal(barcodeData(),undefined);
});

test('dark-view preference persists independently and an active dark snapshot never reads a newer native PDF',async()=>{
  assert.equal(await send({type:'pdf-display-settings',enabled:true}),true);assert.equal(local.pdfDarkMode,true);
  const id=nextId++;tabs.set(id,{id,url:runtime.getURL('reader.html?id=dark-fixture&dark=1'),active:true,status:'complete',windowId:1});
  for(const tab of tabs.values())tab.active=tab.id===id;
  session.pdfViewSources={[id]:true};session.pdfCreated={...session.pdfCreated,[id]:100};session[`pdf:${id}`]={text:driverReport};
  session['pdf:2']={text:driverReport.replace('123456789','987654321')};
  await send({type:'run',command:'barcode'});await wait(barcodeData);
  assert.match(barcodeData().payload,/DAQ123456789/);assert.doesNotMatch(barcodeData().payload,/DAQ987654321/);
  await send({type:'stop'});delete session[`pdf:${id}`];
  await send({type:'run',command:'barcode'});await wait(()=>panel('notice'));assert.match(session.status,/captured text.*no longer available/);
  await send({type:'pdf-display-settings',enabled:false});assert.equal(local.pdfDarkMode,false);
});


test('normal PDF text extraction removes its temporary reader and never requests a dark view',async()=>{
  await send({type:'stop'});captureBlocked=false;await send({type:'pdf-display-settings',enabled:false});
  const native={id:nextId++,url:PDF_URL,status:'complete',windowId:1,active:true};tabs.set(native.id,native);session.pdfCreated[native.id]=Date.now();
  const start=nextId,done=chrome.tabs.onUpdated.listeners[0](native.id,{status:'complete'},native);
  await wait(()=>[...tabs.values()].some(t=>t.id>=start&&t.url.includes('reader.html?id=')));
  const reader=[...tabs.values()].find(t=>t.id>=start&&t.url.includes('reader.html?id=')),id=new URL(reader.url).searchParams.get('id');
  assert.equal(new URL(reader.url).searchParams.get('dark'),null);
  const fromReader=message=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,{id:runtime.id,tab:{id:reader.id},url:reader.url},r=>r.ok?resolve(r.value):reject(new Error(r.error))));
  await assert.rejects(send({type:'reader-result',id,text:'spoofed'}),/Unknown PDF reader/);
  assert.equal((await fromReader({type:'reader-start',id})).url,PDF_URL);
  await fromReader({type:'reader-result',id,text:driverReport});await done;
  assert.equal(session[`pdf:${native.id}`].text,driverReport);assert.equal(removedTabs.includes(reader.id),true);
});

test('redirected PDF captures in the DMV results tab, rejects other documents, supports reuse, and never opens or closes a results tab',async()=>{
  runtime.sendMessage=async message=>{runtimeMessages.push(message);return {ok:true};};
  await send({type:'pdf-display-settings',enabled:true});assert.equal(routingUpdates.at(-1).addRules[0].condition.resourceTypes[0],'main_frame');
  const tab={id:nextId++,url:runtime.getURL(`reader.html?dark=1&pdf=1#${PDF_URL}?a=1&b=2`),status:'complete',windowId:1,active:true};tabs.set(tab.id,tab);
  for(const t of tabs.values())t.active=t.id===tab.id;
  const next=nextId;
  let documentId='direct-first';
  const fromReader=(message,overrides={})=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,{id:runtime.id,tab:{id:tab.id},url:tab.url,frameId:0,documentId,...overrides},r=>r.ok?resolve(r.value):reject(new Error(r.error))));
  await assert.rejects(send({type:'reader-direct-start'}),/Unknown PDF results/);
  await assert.rejects(fromReader({type:'reader-direct-start'},{frameId:1}),/Unknown PDF results/);
  await send({type:'driver-identity-settings',enabled:true});
  let job=await fromReader({type:'reader-direct-start'});assert.equal(job.includeDriverIdentity,true);assert.equal(job.url,PDF_URL+'?a=1&b=2');assert.equal(job.sameTab,true);
  assert.equal(nextId,next);assert.equal(removedTabs.includes(tab.id),false);
  // Chrome can report loading again after the reader replaces its own URL with the job ID.
  const ownUrl=new URL(tab.url);ownUrl.searchParams.set('id',job.id);tab.url=ownUrl.href;
  await chrome.tabs.onUpdated.listeners[0](tab.id,{url:tab.url,status:'loading'},tab);
  assert.equal(runtimeMessages.some(m=>m.type==='reader-cancel'&&m.id===job.id),false,'same-document loading must not destroy the PDF worker');
  await assert.rejects(fromReader({type:'reader-result',id:job.id,text:'wrong document'},{documentId:'different-document'}),/Unknown PDF reader/);
  await fromReader({type:'reader-result',id:job.id,text:driverReport,viewReady:true,driverIdentity:{name:'SYNTHETIC, DRIVER',photo:'data:image/png;base64,AAAA'}});await wait(()=>session.pdfViewSources?.[tab.id]&&session[`pdf:${tab.id}`]);
  assert.equal(session[`pdf:${tab.id}`].driverIdentity.name,'SYNTHETIC, DRIVER');
  assert.equal(local.alertPreferences.driverIdentity,undefined);await send({type:'driver-identity-settings',enabled:false});
  await chrome.tabs.onUpdated.listeners[0](tab.id,{status:'loading'},tab);assert.equal(session[`pdf:${tab.id}`].text,driverReport);
  await send({type:'run',command:'barcode'});await wait(barcodeData);assert.match(barcodeData().payload,/DAQ123456789/);await send({type:'stop'});
  const url=new URL(tab.url);url.searchParams.set('id',job.id);tab.url=url.href;
  await assert.rejects(fromReader({type:'reader-direct-start'}),/Unknown PDF results/);
  // A newly redirected report reusing the same named tab must discard the previous person's text.
  tab.url=runtime.getURL(`reader.html?dark=1&pdf=1#${PDF_URL}`);documentId='direct-second';
  tab.documentId=documentId;await chrome.webNavigation.onCommitted.listeners[0]({tabId:tab.id,frameId:0,documentId,url:tab.url});assert.equal(session[`pdf:${tab.id}`],undefined);
  job=await fromReader({type:'reader-direct-start'});assert.equal(job.includeDriverIdentity,false);
  await fromReader({type:'reader-result',id:job.id,text:driverReport.replace('123456789','987654321'),viewReady:true,driverIdentity:{name:'UNREQUESTED',photo:'data:image/png;base64,AAAA'}});await wait(()=>session[`pdf:${tab.id}`]);
  assert.equal(session[`pdf:${tab.id}`].driverIdentity,undefined);
  assert.match(session[`pdf:${tab.id}`].text,/987654321/);assert.equal(nextId,next);
  await chrome.tabs.onRemoved.listeners[0](tab.id);assert.equal(session[`pdf:${tab.id}`],undefined);assert.equal(session.pdfViewSources[tab.id],undefined);
  // Stopping a pending read notifies that document without removing the user's results tab.
  documentId='direct-third';job=await fromReader({type:'reader-direct-start'});await send({type:'stop'});
  await wait(()=>runtimeMessages.some(m=>m.type==='reader-cancel'&&m.id===job.id));
  assert.equal(removedTabs.includes(tab.id),false);await assert.rejects(fromReader({type:'reader-result',id:job.id,text:driverReport}),/Unknown PDF reader/);
  // A rendering failure keeps extracted text and the user's results tab available.
  documentId='direct-fourth';job=await fromReader({type:'reader-direct-start'});
  await fromReader({type:'reader-result',id:job.id,text:driverReport,viewReady:false,viewerError:'Synthetic rendering failure'});
  await wait(()=>session.status==='PDF dark view unavailable: Synthetic rendering failure');assert.equal(session[`pdf:${tab.id}`].text,driverReport);assert.equal(removedTabs.includes(tab.id),false);
  delete session[`pdf:${tab.id}`];delete session.pdfViewSources[tab.id];
  await send({type:'run',command:'barcode'});await wait(()=>panel('notice'));assert.match(session.status,/captured text.*no longer available/);assert.equal(nextId,next);
  await send({type:'pdf-display-settings',enabled:false});assert.match(routingUpdates.at(-1).addRules[0].action.redirect.regexSubstitution,/dark=0&pdf=1/);
});


test('committed document IDs protect a current PDF worker but cancel a replaced reader',async()=>{
  runtime.sendMessage=async message=>{runtimeMessages.push(message);return {ok:true};};captureBlocked=false;
  const tab={id:nextId++,url:runtime.getURL(`reader.html?dark=1&pdf=1#${PDF_URL}`),windowId:1,status:'loading',documentId:'current-reader'};tabs.set(tab.id,tab);
  const fromReader=message=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,{id:runtime.id,tab:{id:tab.id},url:tab.url,frameId:0,documentId:tab.documentId},r=>r.ok?resolve(r.value):reject(new Error(r.error))));
  const job=await fromReader({type:'reader-direct-start'});
  const committed=documentId=>chrome.webNavigation.onCommitted.listeners[0]({tabId:tab.id,frameId:0,documentId,url:tab.url});
  await committed('current-reader'); // A late commit notification from this document is harmless.
  await committed('older-reader'); // A delayed event must be checked against the actual current frame.
  assert.equal(runtimeMessages.some(m=>m.type==='reader-cancel'&&m.id===job.id),false);
  tab.documentId='replacement-reader';await committed(tab.documentId);
  await wait(()=>runtimeMessages.some(m=>m.type==='reader-cancel'&&m.id===job.id));
  await assert.rejects(fromReader({type:'reader-result',id:job.id,text:driverReport}),/Unknown PDF reader/);
  assert.equal(session[`pdf:${tab.id}`],undefined);assert.equal(removedTabs.includes(tab.id),false);
});


test('native printing opens and reuses a local PDF snapshot without changing dark mode or mixing report identities',async()=>{
  await send({type:'stop'});
  const source={id:nextId++,url:runtime.getURL('reader.html?dark=1&pdf=1&id=print-source#'+PDF_URL),status:'complete',windowId:1,active:true,documentId:'print-source'};tabs.set(source.id,source);
  session[`pdf:${source.id}`]={text:driverReport,capturedAt:100,documentId:'print-source'};session.pdfViewSources={...session.pdfViewSources,[source.id]:true};session.pdfCreated[source.id]=100;
  const fromReader=(message,overrides={})=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0]({text:driverReport,...message},{id:runtime.id,tab:{id:source.id},url:source.url,frameId:0,documentId:'print-source',...overrides},r=>r.ok?resolve(r.value):reject(new Error(r.error))));
  const url='blob:'+runtime.getURL('12345678-1234-1234-1234-123456789abc'),before=nextId,preference=local.pdfDarkMode,rules=routingUpdates.length;
  await assert.rejects(send({type:'pdf-native-print',url}),/Open the report in the PDF viewer/);
  await assert.rejects(fromReader({type:'pdf-native-print',url:PDF_URL}),/original PDF file could not be prepared/);
  // MessageSender can retain the document's original URL after replaceState adds its job ID.
  const originalUrl=source.url.replace('&id=print-source','');
  await fromReader({type:'pdf-native-print',url},{url:originalUrl});const native=tabs.get(before);
  assert.equal(native.url,url);assert.equal(nextId,before+1);assert.equal(local.pdfDarkMode,preference);assert.equal(routingUpdates.length,rules);
  assert.equal(session[`pdf:${native.id}`].text,driverReport);assert.equal(session[`pdf:${native.id}`].documentId,undefined);
  await fromReader({type:'pdf-native-print',url});assert.equal(nextId,before+1);
  session['pdf:2']={text:driverReport.replace('123456789','987654321')};session.pdfCreated[2]=Date.now()+1000;
  await send({type:'run',command:'barcode'});await wait(barcodeData);assert.match(barcodeData().payload,/DAQ123456789/);assert.doesNotMatch(barcodeData().payload,/DAQ987654321/);await send({type:'stop'});
  // A navigated printing tab cannot be reused or mistaken for its previous PDF.
  native.url='https://unrelated.test/';await fromReader({type:'pdf-native-print',url});assert.equal(nextId,before+2);
  const replacement=tabs.get(before+1);await chrome.tabs.onRemoved.listeners[0](source.id);
  await send({type:'run',command:'barcode'});await wait(barcodeData);assert.match(barcodeData().payload,/DAQ123456789/);await send({type:'stop'});
  await chrome.tabs.onRemoved.listeners[0](replacement.id);assert.equal(session[`pdf:${replacement.id}`],undefined);assert.equal(session.pdfViewSources[replacement.id],undefined);
  const emptyUrl='blob:'+runtime.getURL('aaaaaaaa-1234-1234-1234-123456789abc'),emptyId=nextId;
  await fromReader({type:'pdf-native-print',url:emptyUrl,text:undefined});assert.equal(session[`pdf:${emptyId}`].text,'');
});

test('native printing uses the loaded PDF snapshot when background report metadata is stale or unavailable',async()=>{
  await send({type:'stop'});
  const source={id:nextId++,url:runtime.getURL('reader.html?dark=1&pdf=1&id=loaded-file#'+PDF_URL),status:'complete',windowId:1,active:true};tabs.set(source.id,source);
  session[`pdf:${source.id}`]={text:driverReport.replace('123456789','987654321'),documentId:'stale-cache-document'};
  const originalUrl=source.url.replace('&id=loaded-file',''),url='blob:'+runtime.getURL('bbbbbbbb-1234-1234-1234-123456789abc'),nativeId=nextId;
  const request={type:'pdf-native-print',url,text:driverReport};
  await new Promise((resolve,reject)=>runtime.onMessage.listeners[0](request,{id:runtime.id,tab:{id:source.id},url:originalUrl,frameId:0,documentId:'loaded-document'},r=>r.ok?resolve(r.value):reject(new Error(r.error))));
  assert.equal(tabs.get(nativeId).url,url);assert.equal(session[`pdf:${nativeId}`].text,driverReport);
  assert.doesNotMatch(session[`pdf:${nativeId}`].text,/987654321/);
});


test('printing does not wait for a still-pending PDF capture',async()=>{
  await send({type:'stop'});captureBlocked=false;
  const tab={id:nextId++,url:runtime.getURL('reader.html?dark=1&pdf=1#'+PDF_URL),status:'complete',windowId:1};tabs.set(tab.id,tab);
  const fromReader=message=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,{id:runtime.id,tab:{id:tab.id},url:tab.url,frameId:0,documentId:'pending-print-doc'},r=>r.ok?resolve(r.value):reject(new Error(r.error))));
  await fromReader({type:'reader-direct-start'}); // Leave reader-result pending.
  const url='blob:'+runtime.getURL('cccccccc-1234-1234-1234-123456789abc'),nativeId=nextId;
  const result=fromReader({type:'pdf-native-print',url,text:driverReport});
  await wait(()=>tabs.get(nativeId)?.url===url);await result;
  assert.equal(session[`pdf:${nativeId}`].text,driverReport);await send({type:'stop'});
});


test('DMV dark mode is default-on, injects USER CSS in its requesting document, and never exposes private state to content scripts',async()=>{
  assert.equal(registeredThemes[0].runAt,'document_start');assert.equal(registeredThemes[0].allFrames,true);
  const sender={id:runtime.id,url:MEMBER+'logon.aspx',tab:{id:1},frameId:2,documentId:'dmv-frame'};
  const webSend=message=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,sender,r=>r.ok?resolve(r.value):reject(new Error(r.error))));
  assert.deepEqual(await webSend({type:'dmv-theme-init'}),{enabled:true});
  assert.equal(themeCss.at(-1).origin,'USER');assert.deepEqual(themeCss.at(-1).target,{tabId:1,documentIds:['dmv-frame']});
  assert.equal(runtime.onMessage.listeners[0]({type:'state'},sender,()=>assert.fail('Private state leaked')),false);
  for(const url of ['https://unrelated.test/',PDF_URL,'http://www.scdmvonline.com/logon.aspx','https://www.scdmvonline.com.example.org/'])assert.equal(runtime.onMessage.listeners[0]({type:'dmv-theme-init'},{...sender,url},()=>assert.fail('Untrusted page accepted')),false);
  assert.equal(await send({type:'dmv-display-settings',enabled:false}),false);assert.equal(local.dmvDarkMode,false);assert.equal(registeredThemes.length,0);
  assert.deepEqual(await webSend({type:'dmv-theme-init'}),{enabled:false});assert.equal(themeCss.at(-1).enabled,false);
  assert.equal(await send({type:'dmv-display-settings',enabled:true}),true);assert.equal(local.dmvDarkMode,true);assert.equal(registeredThemes.length,1);
});


test('Collect on a residence PDF with a repeated driver header retains every customer and runs the second',async()=>{
  await send({type:'stop'});await send({type:'audio-settings',speechEnabled:false,suspendedClipEnabled:false});await send({type:'alerts',enabled:false});
  session.lastQuery=Date.now();session['pdf:2']={text:'Customers at Same Residence\nCustomer Number: 111 FIRST, FICTIONAL\nCustomer Number: 222 SECOND, FICTIONAL\nPage 1 of 2\fCustomers at Same Residence\nCustomer No: 111 Driver License No: 123456789\nCustomer Number: 333 THIRD, FICTIONAL'};
  for(const tab of tabs.values())tab.active=tab.id===2;
  await send({type:'run',command:'owners'});await wait(()=>session.queue?.values?.join(',')==='111,222,333'&&session.queue.index===2);
  assert.equal(submissions.at(-1),'222');await send({type:'run',command:'next'});await wait(()=>session.queue.index===3);assert.equal(submissions.at(-1),'333');
});

test('generic DMV server errors consume queued attempts, show a notice, record failed history, and permit Next',async()=>{
  for(const stage of ['submit','download']) {
    await send({type:'stop'});session.credentials={user:'fixture-user',password:'fixture-password'};session.portalId=1;session.lastQuery=Date.now();tabs.get(1).url=MEMBER+'Disclaimer.aspx';session.queue={values:['81000001','81000002'],index:0};
    serverFailureStage=stage;const before=submittedQueries.length;
    try {
      await send({type:'run',command:'next'});await wait(()=>session.queue.index===1&&session.history[0]?.value==='81000001'&&panel('notice'));
      assert.equal(session.history[0].outcome,'error');assert.equal(session.history[0].errorMessage,'An unexpected error occurred');assert.equal(session[`panel:${new URL(panel('notice').url).searchParams.get('id')}`].message,'An unexpected error occurred');assert.equal(session.lastQuery,0);assert.equal(submittedQueries.length,before+1);
    } finally {serverFailureStage='';}
    await send({type:'run',command:'next'});await wait(()=>session.queue.index===2&&session.history[0]?.value==='81000002');assert.notEqual(session.history[0].outcome,'error');assert.equal(submittedQueries.length,before+2);
  }
});

test('worker-side DL and customer submissions strip padding before portal fill and history',async()=>{
  for(const [command,value,prefix] of [['license','123456789','000 '],['customer','12345678','000 '],['customer','12345678','C000 ']]) {
    const before=submittedQueries.length,historyId=session.history[0]?.id;await input(prefix+value,command);
    await wait(()=>submittedQueries.length===before+1&&session.history[0]?.id!==historyId&&session.history[0]?.kind===command&&session.history[0]?.value===value);
    assert.equal(submittedQueries.at(-1),value);assert.equal(submissions.at(-1),value);
  }
});


test('barcode parsing errors open a correctable draft without submitting a search',async()=>{
  barcodeSource(driverReport.replace('123 EXAMPLE ROAD','X'.repeat(50)));const before=submittedQueries.length;
  await send({type:'run',command:'barcode'});await wait(barcodeData);
  assert.equal(barcodeData().payload,undefined);assert.match(barcodeData().parseError,/35-character/);
  assert.equal(Object.fromEntries(barcodeData().draftFields).DAG,'X'.repeat(50));
  assert.equal(submittedQueries.length,before);assert.match(session.status,/Review and correct/);
});
test('reviewing an incomplete owner preserves its data and does not switch to a later party',async()=>{
  barcodeSource(vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNSPLIT ADDRESS').replace('Last Transaction:','Owner Number: 9999 Owner Name: LATER, PERSON Owner Address: 456 NEXT ROAD, NEXT CITY SC 12345 Last Transaction:'));
  await send({type:'run',command:'barcode'});await wait(()=>panel('barcode-owner-incomplete'));
  const id=new URL(panel('barcode-owner-incomplete').url).searchParams.get('id');
  await send({type:'panel-submit',id,value:'edit'});await wait(barcodeData);
  const f=Object.fromEntries(barcodeData().draftFields);assert.equal(f.RBD,'EXAMPLE-SAMPLE');assert.equal(f.RBI,'UNSPLIT ADDRESS');assert.equal(f.RBK,'');assert.equal(barcodeData().payload,undefined);
});


test('a second parsing error preserves the explicit choice to leave incomplete owner fields blank',async()=>{
  barcodeSource(vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS').replace('TEST123','TOO-LONG-PLATE'));
  await send({type:'run',command:'barcode'});await wait(()=>panel('barcode-owner-incomplete'));
  const id=new URL(panel('barcode-owner-incomplete').url).searchParams.get('id');
  await send({type:'panel-submit',id,value:'blank'});await wait(barcodeData);
  assert.equal(barcodeData().allowIncompleteParty,true);assert.equal(barcodeData().payload,undefined);
  const f=Object.fromEntries(barcodeData().draftFields);for(const key of ['RBI','RBK','RBL','RBM'])assert.equal(f[key],'');
  assert.equal(f.RAM,'TOO-LONG-PLATE');
});

/** Retrieve a live launcher's ID without treating its tab as a report source. */
function menuId() {return new URL(panel('shortcut-menu').url).searchParams.get('id');}
test('help shortcut opens one menu without cancelling a pending search, and closing it leaves that search usable',async()=>{
  await send({type:'stop'});await send({type:'run',command:'customer'});await wait(()=>panel('input'));
  const inputId=new URL(panel('input').url).searchParams.get('id'),before=submittedQueries.length;
  await chrome.commands.onCommand.listeners[0]('help');await wait(()=>panel('shortcut-menu'));
  const win=panel('shortcut-menu'),count=windows.length,id=menuId();
  assert.match(win.url,/shortcut-menu\.html/);assert.ok(session[`panel:${inputId}`]);assert.equal(submittedQueries.length,before);
  await chrome.commands.onCommand.listeners[0]('help');assert.equal(windows.length,count);
  for(const listener of chrome.windows.onRemoved.listeners)await listener(win.id);
  assert.equal(session[`panel:${id}`],undefined);assert.ok(session[`panel:${inputId}`]);
  await send({type:'panel-submit',id:inputId,value:'82000001'});await wait(()=>session.history[0]?.value==='82000001');
});
test('shortcut menu uses the report focused before opening even when a newer report exists and its own tab is focused',async()=>{
  await send({type:'stop'});barcodeSource(driverReport);const before=submittedQueries.length;
  await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));const id=menuId(),win=panel('shortcut-menu');
  assert.equal(session[`panel:${id}`].sourceId,2);
  const newer={id:nextId++,url:PDF_URL,windowId:1,status:'complete',active:false};tabs.set(newer.id,newer);session[`pdf:${newer.id}`]={text:driverReport.replace('123456789','987654321')};
  const launcher={id:nextId++,url:win.url,windowId:win.id,status:'complete',active:true};for(const tab of tabs.values())tab.active=false;tabs.set(launcher.id,launcher);
  await send({type:'shortcut-menu-run',id,command:'barcode',sourceId:newer.id});await wait(barcodeData);
  assert.match(barcodeData().payload,/DAQ123456789/);assert.doesNotMatch(barcodeData().payload,/DAQ987654321/);
  assert.ok(removedWindows.includes(win.id));assert.equal(session[`panel:${id}`],undefined);assert.equal(submittedQueries.length,before);
});
test('shortcut menu rejects invalid actions, expired IDs and input-panel IDs; valid actions use the normal prompt',async()=>{
  await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));const id=menuId();
  for(const command of ['help','constructor','not-a-command'])await assert.rejects(send({type:'shortcut-menu-run',id,command}),/Unknown shortcut menu action/);
  await assert.rejects(send({type:'shortcut-menu-run',id:'expired',command:'license'}),/expired/);
  await send({type:'shortcut-menu-run',id,command:'license'});await wait(()=>panel('input'));
  const inputId=new URL(panel('input').url).searchParams.get('id');assert.equal(session[`panel:${inputId}`].command,'license');
  await assert.rejects(send({type:'shortcut-menu-run',id:inputId,command:'barcode'}),/expired/);
  await send({type:'stop'});
});
test('Stop cancels a menu still capturing its source and prevents its late window from appearing',async()=>{
  const original=chrome.tabs.query;let release,started=false;const before=windows.length;
  chrome.tabs.query=async options=>{started=true;return new Promise(resolve=>{release=()=>resolve([...tabs.values()].filter(tab=>!options.active||tab.active));});};
  try {
    await send({type:'run',command:'help'});await wait(()=>started);await send({type:'stop'});release();
    await new Promise(resolve=>setTimeout(resolve,20));assert.equal(windows.length,before);assert.equal(panel('shortcut-menu'),undefined);
  } finally {chrome.tabs.query=original;}
});

test('shortcut menu timeout preference persists, reaches new menus, and survives private-state reset',async()=>{
  await send({type:'stop'});
  assert.deepEqual(await send({type:'shortcut-menu-settings',noTimeout:true}),{alwaysOnTop:false,noTimeout:true});
  assert.equal((await send({type:'state'})).shortcutMenuNoTimeout,true);
  await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));
  assert.equal(session[`panel:${menuId()}`].noTimeout,true);
  await send({type:'clear-saved-user-info',confirmed:true});
  assert.equal((await send({type:'state'})).shortcutMenuNoTimeout,true);
  assert.deepEqual(await send({type:'shortcut-menu-settings',noTimeout:'true'}),{alwaysOnTop:false,noTimeout:false});
  await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));
  assert.equal(session[`panel:${menuId()}`].noTimeout,false);
  await send({type:'stop'});
});

test('always-on-top menu enables no timeout and retains it when pinning is turned off',async()=>{
  assert.deepEqual(await send({type:'shortcut-menu-settings',alwaysOnTop:true}),{alwaysOnTop:true,noTimeout:true});
  await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));
  assert.equal(session[`panel:${menuId()}`].alwaysOnTop,true);
  assert.equal(session[`panel:${menuId()}`].noTimeout,true);
  assert.deepEqual(await send({type:'shortcut-menu-settings',noTimeout:false}),{alwaysOnTop:true,noTimeout:true});
  assert.deepEqual(await send({type:'shortcut-menu-settings',alwaysOnTop:false}),{alwaysOnTop:false,noTimeout:true});
  assert.equal((await send({type:'state'})).shortcutMenuAlwaysOnTop,false);
  await send({type:'shortcut-menu-settings',noTimeout:false});await send({type:'stop'});
});

/** Report pin state through the owning document's authenticated message route. */
const pinMenu = (id,pinned) => send({type:'shortcut-menu-pin-state',id,pinned},`shortcut-menu.html?id=${id}`);
test('pinned launcher survives external hotkeys and repeated menu actions; Stop closes it',async()=>{
  await send({type:'stop'});await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));
  const id=menuId(),win=panel('shortcut-menu');await pinMenu(id,true);
  await chrome.commands.onCommand.listeners[0]('plate');await wait(()=>panel('input'));
  const first=panel('input');assert.equal(session[`panel:${new URL(first.url).searchParams.get('id')}`].command,'plate');
  assert.ok(session[`panel:${id}`]);assert.equal(removedWindows.includes(win.id),false);
  await chrome.commands.onCommand.listeners[0]('license');await wait(()=>panel('input')!==first);
  assert.ok(removedWindows.includes(first.id));assert.ok(session[`panel:${id}`]);
  for(const command of ['customer','plate']) {
    const previous=panel('input');await send({type:'shortcut-menu-run',id,command});await wait(()=>panel('input')!==previous);
    assert.ok(session[`panel:${id}`]);assert.equal(removedWindows.includes(win.id),false);
  }
  await send({type:'stop'});assert.equal(session[`panel:${id}`],undefined);assert.ok(removedWindows.includes(win.id));
});
test('pin state rejects other documents; unpinned launchers still close for a new search',async()=>{
  await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));const id=menuId(),win=panel('shortcut-menu');
  await assert.rejects(send({type:'shortcut-menu-pin-state',id,pinned:true}),/Unknown shortcut menu/);
  await pinMenu(id,true);await pinMenu(id,false);
  await chrome.commands.onCommand.listeners[0]('plate');await wait(()=>panel('input'));
  assert.equal(session[`panel:${id}`],undefined);assert.ok(removedWindows.includes(win.id));await send({type:'stop'});
});
test('closing a pinned menu leaves the current search prompt usable; private-state reset closes pinned menus',async()=>{
  await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));let id=menuId(),win=panel('shortcut-menu');await pinMenu(id,true);
  await chrome.commands.onCommand.listeners[0]('plate');await wait(()=>panel('input'));const input=panel('input');
  for(const listener of chrome.windows.onRemoved.listeners)await listener(win.id);
  assert.ok(session[`panel:${new URL(input.url).searchParams.get('id')}`]);
  await send({type:'run',command:'help'});await wait(()=>panel('shortcut-menu'));id=menuId();win=panel('shortcut-menu');await pinMenu(id,true);
  await send({type:'clear-saved-user-info',confirmed:true});assert.equal(session[`panel:${id}`],undefined);assert.ok(removedWindows.includes(win.id));
});
