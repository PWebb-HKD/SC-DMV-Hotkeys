// Worker integration harness: queue commits, cancellation, panels, history, and settings races.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MEMBER, PDF_URL, isPdf} from '../extension/core.js';
import {driverReport} from './barcode-fixtures.js';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(fn){this.listeners=this.listeners.filter(x=>x!==fn);}});
const local={history:[{id:'old-persistent',kind:'plate',value:'OLD123',at:1}]}, session={history:[],lastQuery:Date.now(),portalId:1,pdfCreated:{2:100},'pdf:2':{text:'Owner Number: 00001234\nCustomer Number: 87654321\nOwner Number: 1234'}};
const tabs=new Map([[1,{id:1,url:`${MEMBER}Transactions/DrvRec/Page2.aspx`,status:'complete',windowId:1,active:false}],[2,{id:2,url:PDF_URL,status:'complete',windowId:1,active:true}]]);
const windows=[], submissions=[];
let nextId=3, invalid=false, blockSubmitted=false, captureBlocked=false, onResultFocus=null;
let reportText='Driver License No: 123456789 Name: TEST, PERSON\nDOB: 01/01/2000';
let pauseAlertWindow=false,alertWindowRelease;
const removedWindows=[];
const store=data=>({get:async keys=>typeof keys==='string'?{[keys]:data[keys]}:Array.isArray(keys)?Object.fromEntries(keys.map(k=>[k,data[k]])):{...data},set:async values=>Object.assign(data,values),remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete data[k];},setAccessLevel:async()=>{}});
const runtime={id:'a'.repeat(32),getURL:path=>`chrome-extension://${'a'.repeat(32)}/${path}`,onMessage:event(),onConnect:event(),onStartup:event(),onInstalled:event()};
globalThis.chrome={
  runtime,storage:{local:store(local),session:store(session)},
  tabs:{
    query:async opts=>[...tabs.values()].filter(t=>!opts.active||t.active).map(t=>({...t})),
    get:async id=>({...tabs.get(id)}),
    create:async opts=>{const tab={id:nextId++,url:opts.url,status:'complete',windowId:1,active:!!opts.active};tabs.set(tab.id,tab);return {...tab};},
    update:async(id,update)=>{const tab=tabs.get(id);Object.assign(tab,update);if(update.active){for(const t of tabs.values())if(t.id!==id)t.active=false;if(onResultFocus&&isPdf(tab.url)){const hook=onResultFocus;onResultFocus=null;queueMicrotask(hook);}}return {...tab};},
    remove:async()=>{},onCreated:event(),onUpdated:event(),onRemoved:event()
  },
  windows:{get:async()=>({id:1,state:'normal'}),update:async()=>{},onRemoved:event(),create:async data=>{const win={id:windows.length+10,...data};windows.push(win);if(pauseAlertWindow&&session[`panel:${new URL(data.url).searchParams.get('id')}`]?.type==='record-alert')await new Promise(resolve=>{alertWindowRelease=resolve;});return win;},remove:async id=>{removedWindows.push(id);}},
  scripting:{executeScript:async({target,args:[op,args]})=>{
    const tab=tabs.get(target.tabId); let result=true;
    if(op==='state')result={url:tab.url,present:true,enabled:true,presentSelectors:args.selectors?.map(()=>true)||[],errors:invalid&&tab.url.includes('Page1.aspx')?['Invalid customer number']:[]};
    if(op==='extensionLogin'&&args.submit)tab.url=`${MEMBER}Disclaimer.aspx`;
    if(op==='fill')submissions.push(args.value);
    if(op==='click'&&args.selector==='#btnFooterNavNext') {if(!invalid&&!blockSubmitted)tab.url=tab.url.replace('Page1.aspx','Page2.aspx');}
    if(op==='fetchPdf'&&captureBlocked)return new Promise(()=>{});
    if(op==='click'&&args.selector==='#downloadButton'){
      const pdf={id:nextId++,url:PDF_URL,status:'complete',windowId:1,openerTabId:tab.id,active:false};tabs.set(pdf.id,pdf);
      if(captureBlocked)session.pdfCreated[pdf.id]=Date.now();
      else session[`pdf:${pdf.id}`]={text:reportText,capturedAt:Date.now()};
    }
    return [{result}];
  }},commands:{onCommand:event(),getAll:async()=>[]},permissions:{contains:async()=>true}
};
await import('../extension/background.js');
const send=message=>new Promise((resolve,reject)=>runtime.onMessage.listeners[0](message,{id:runtime.id,url:runtime.getURL('popup.html')},r=>r.ok?resolve(r.value):reject(new Error(r.error))));
async function wait(fn){const end=Date.now()+4000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Queue test timed out.');}
test('startup removes persistent history without changing current session history',async()=>{
  assert.deepEqual((await send({type:'state'})).history,[]);
  assert.equal(local.history,undefined);
});

test('queue starts with first unique number, preserves failed item, advances once and offers restart',async()=>{
  await send({type:'run',command:'owners'});
  await wait(()=>session.queue?.index===1);
  assert.deepEqual(session.queue.values,['1234','87654321']);assert.equal(submissions[0],'1234');
  // A page validation failure must not consume the next queue item.
  invalid=true;await send({type:'run',command:'next'});
  await wait(()=>windows.some(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type==='notice'));
  assert.equal(session.queue.index,1);assert.equal(session.history.length,1);
  invalid=false;await send({type:'run',command:'next'});await wait(()=>session.queue.index===2);
  assert.equal(submissions.at(-1),'87654321');assert.equal(session.history.length,2);
  await send({type:'run',command:'next'});
  await wait(()=>windows.some(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type==='restart'));
  const restart=windows.find(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type==='restart');
  await send({type:'panel-submit',id:new URL(restart.url).searchParams.get('id'),value:true});
  await wait(()=>session.queue.index===1&&session.history.length===3);
  assert.equal(submissions.at(-1),'1234');
  assert.equal(tabs.get(1).url.includes('Page2.aspx'),true);
});
function panel(type) { return windows.findLast(w=>session[`panel:${new URL(w.url).searchParams.get('id')}`]?.type===type); }
async function input(value,command='customer') {
  await send({type:'run',command}); await wait(()=>panel('input'));
  await send({type:'panel-submit',id:new URL(panel('input').url).searchParams.get('id'),value});
}
test('previous moves back through the saved queue; Next returns forward and failures preserve the cursor',async()=>{
  session.queue={values:['101','202','303'],index:3};
  const before=submissions.length;await send({type:'run',command:'previous'});await wait(()=>session.queue.index===2);
  assert.equal(submissions.at(-1),'202');
  invalid=true;await send({type:'run',command:'previous'});await wait(()=>panel('notice'));
  assert.equal(session.queue.index,2);invalid=false;
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
test('record alerts are off by default and their toggle is stored only in session memory',async()=>{
  assert.equal((await send({type:'state'})).alertsEnabled,undefined);
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
  assert.equal(result.sections[0].title,'VALID LICENSE');assert.equal(result.autoCloseMs,10000);
  await send({type:'alerts',enabled:false});assert.equal(panel('record-alert'),undefined);assert.ok(removedWindows.includes(current.id));
});
test('disabling alerts or replacing a query suppresses a pending PDF analysis',async()=>{
  await send({type:'alerts',enabled:true});captureBlocked=true;
  const before=session.history[0].id;await input('44000002');await wait(()=>session.history[0].id!==before);
  await send({type:'alerts',enabled:false});captureBlocked=false;
  await input('44000003');await wait(()=>session.history[0].value==='44000003');
  assert.equal(panel('record-alert'),undefined);
});
test('browser startup resets the session alert preference',async()=>{
  await send({type:'alerts',enabled:true});
  for(const listener of runtime.onStartup.listeners)await listener();
  assert.equal(session.alertsEnabled,false);
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

test('speech runs with visual alerts off and startup resets session audio options',async()=>{
  const spoken=[];
  chrome.tts={stop(){},getVoices:cb=>cb([{voiceName:'Microsoft David Desktop',lang:'en-US'}]),speak(text,options,callback){spoken.push(text);callback();queueMicrotask(()=>options.onEvent({type:'end'}));}};
  await send({type:'audio-settings',speechEnabled:true,voiceSource:'microsoft',repeatSpeech:true,voiceGender:'male'});
  assert.equal(session.speechEnabled,true);assert.equal(local.speechEnabled,undefined);
  reportText='Plate Class: ABC Decal Exp Date: 12/31/2099';
  await input('SPEECH1','plate');await wait(()=>spoken.length===2);
  assert.deepEqual(spoken,['Valid tag','Valid tag']);assert.equal(panel('record-alert'),undefined);
  await send({type:'audio-settings',suspendedClipEnabled:true});
  for(const listener of runtime.onStartup.listeners)await listener();
  assert.equal(session.speechEnabled,false);assert.equal(session.suspendedClipEnabled,false);
  assert.equal(session.repeatSpeech,false);
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
  const savedVault={ciphertext:'test-vault'};local.vault=savedVault;
  session.history=Array.from({length:20},(_,i)=>({id:'session-'+i,kind:'customer',value:String(80000000+i),at:i}));
  await input('70000001');await wait(()=>session.history[0].value==='70000001');
  assert.equal(session.history.length,20);assert.equal(session.history.at(-1).id,'session-18');
  assert.equal(local.history,undefined);
  assert.deepEqual((await send({type:'state'})).history,session.history);
  await send({type:'clear-history'});assert.equal(session.history,undefined);
  assert.deepEqual(local.vault,savedVault);assert.deepEqual(session.queue,previousQueue);
  await assert.rejects(send({type:'rerun',search:{id:'session-0'}}),/no longer in recent history/);
  session.history=previousHistory;delete local.vault;
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
test('failed second-customer lookup on Collect retries that customer on Next',async()=>{
  session['pdf:2']={text:'Customers at Same Residence\nCustomer Number: 52000001\nCustomer Number: 52000002'};
  for(const tab of tabs.values())tab.active=tab.id===2;
  invalid=true;await send({type:'run',command:'owners'});await wait(()=>panel('notice'));
  assert.equal(session.queue.index,1);assert.deepEqual(session.queue.values,['52000001','52000002']);
  invalid=false;await send({type:'run',command:'next'});await wait(()=>session.queue.index===2);
  assert.equal(submissions.at(-1),'52000002');
});
test('Collect starts at first for single-customer residences and other PDF report types',async()=>{
  for(const text of ['Customers at Same Residence\nCustomer Number: 53000001', 'Owner Number: 53000001\nOwner Number: 53000002', 'Other report\nCustomer Number: 53000001\nCustomer Number: 53000002']){
    session['pdf:2']={text};for(const tab of tabs.values())tab.active=tab.id===2;
    const before=submissions.length;await send({type:'run',command:'owners'});await wait(()=>submissions.length>before&&session.queue.index===1);
    assert.equal(submissions.at(-1),'53000001');
  }
});

test('pause blocks every keyboard action except its toggle while toolbar actions remain usable',async()=>{
  const command=chrome.commands.onCommand.listeners[0];
  assert.equal(await send({type:'toggle-shortcuts'}),true);
  const before={windows:windows.length,submissions:submissions.length,queue:structuredClone(session.queue),history:structuredClone(session.history)};
  for(const name of ['plate','license','customer','owners','next','previous','address','scutties','barcode'])await command(name);
  assert.equal(windows.length,before.windows);assert.equal(submissions.length,before.submissions);
  assert.deepEqual(session.queue,before.queue);assert.deepEqual(session.history,before.history);
  assert.equal((await send({type:'state'})).shortcutsPaused,true);
  await send({type:'run',command:'customer'});await wait(()=>panel('input'));
  await send({type:'stop'});
  await command('toggleShortcuts');assert.equal(session.shortcutsPaused,false);
  await command('customer');await wait(()=>panel('input'));
  await send({type:'stop'});
  await Promise.all([command('toggleShortcuts'),command('toggleShortcuts')]);
  assert.equal(session.shortcutsPaused,false,'Two rapid toggles must restore the original state');
});
test('pausing shortcut actions does not cancel an in-progress search',async()=>{
  session.queue={values:['54000001','54000002'],index:1};
  blockSubmitted=true;const before=submissions.length;
  await send({type:'run',command:'next'});await wait(()=>submissions.length>before);
  await chrome.commands.onCommand.listeners[0]('toggleShortcuts');
  assert.equal(session.shortcutsPaused,true);
  const portal=tabs.get(session.portalId);portal.url=portal.url.replace('Page1.aspx','Page2.aspx');blockSubmitted=false;
  await wait(()=>session.queue.index===2);
  assert.equal(submissions.at(-1),'54000002');
  await chrome.commands.onCommand.listeners[0]('toggleShortcuts');
  assert.equal(session.shortcutsPaused,false);
});
