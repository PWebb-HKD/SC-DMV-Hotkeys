import {test} from 'node:test';
import assert from 'node:assert/strict';
import {licenseStatus} from '../extension/status-alerts.js';
import {spokenStatus} from '../extension/audio-alerts.js';
import {statusRecordings} from '../extension/voice-recordings.js';
import {susp, viol, validHeader, mixedSuspensions, statusNow} from './suspension-fixtures.js';
const result = text => licenseStatus(text, statusNow);
test('separate active and pending buckets group DUI/DUAC together and preserve DUS/DUI line order', () => {
  const r = result(mixedSuspensions);
  assert.equal(r.activeSuspensions, 3); assert.equal(r.pendingReinstatement, 2); assert.equal(r.priorDuiDuac, 3);
  assert.deepEqual(r.sections[0].lines.slice(0,4), ['0 Prior DUS convictions within 5 years','3 Prior DUI/DUAC convictions within 10 years','3 active suspensions','2 pending reinstatement']);
  assert.deepEqual(r.sections[0].columns, [
    {title:'Active Suspensions',items:['DUI/DUAC × 2','Failure to Pay Traffic Ticket × 1']},
    {title:'Pending Reinstatement',items:['Driving Under Suspension × 1','DUI/DUAC × 1']}
  ]);
});
test('end and reinstatement dates have exclusive buckets with today completed and future outstanding', () => {
  for (const [end,met,active,pending] of [
    ['INDEFINITE','INDEFINITE',1,0],['11/18/2026','INDEFINITE',1,0],
    ['11/17/2026','INDEFINITE',0,1],['01/01/2026','11/18/2026',0,1],
    ['01/01/2026','11/17/2026',0,0],['01/01/2026','NOT INDEFINITE',0,0],
    ['02/30/2026','INDEFINITE',0,0],['','INDEFINITE',0,0],['01/01/2026','',0,0]
  ]) {
    const r = result('Status - DL: SUSPENDED '+susp('Example',{end,met}));
    assert.equal(r.activeSuspensions,active,`${end}/${met}`); assert.equal(r.pendingReinstatement,pending,`${end}/${met}`);
    assert.equal(r.sections[0].columns.length,pending?2:1);
  }
});
test('ten-year DUI/DUAC window is inclusive, excludes future/old/invalid dates, and prefers VIOL dates', () => {
  const r = result(['Status - DL: SUSPENDED',
    viol('Driving Under the Influence','A','11/17/2016'), susp('Driving Under the Influence',{ticket:'A'}),
    viol('Unlawful Alcohol Concentration','B','11/17/2026'),
    viol('Driving Under the Influence','C','11/16/2016'), susp('Driving Under the Influence',{ticket:'C'}),
    viol('Driving Under the Influence','D','11/18/2026'),
    susp('Unlawful Alcohol Concentration',{ticket:'E',causal:'11/17/2016'}),
    susp('Driving Under the Influence',{ticket:'F',causal:'11/16/2016'}),
    viol('Driving Under the Influence','G','02/30/2026'), susp('Driving Under the Influence',{ticket:'G'}),
    viol('Driving Under Suspension','H','01/01/2025'),
    viol('Implied Consent','I','01/01/2025')].join('\n'));
  assert.equal(r.priorDuiDuac,3);
});
test('ticket deduplication is case-insensitive, order-independent, and never guesses missing tickets', () => {
  const a = susp('Driving Under the Influence',{ticket:'TEST-A'}), b = viol('Driving Under the Influence','test-a','01/01/2024');
  for (const blocks of [[a,b],[b,a,a,b]]) assert.equal(result('Status - DL: SUSPENDED '+blocks.join(' ')).priorDuiDuac,1);
  const withoutTicket = susp('Driving Under the Influence',{ticket:''});
  assert.equal(result('Status - DL: SUSPENDED '+withoutTicket+' '+withoutTicket).priorDuiDuac,2);
});
test('IID warning applies to every status and old/completed DUI blocks without changing voice or status', () => {
  const block = susp('Driving Under the Influence',{end:'01/01/2010',met:'01/01/2010',causal:'01/01/2009',iid:'Y'});
  for (const header of [validHeader,validHeader.replace('12/31/2027','01/01/2020'),'Status - DL: SUSPENDED',validHeader.replace('DL D Renewal','ID D Renewal'),validHeader.replace('Driver License No: 123456789','Driver License No: '),'Unreadable status']) {
    const original=result(header), r=result(header+' '+block);
    assert.equal(r.sections[0].title,original.sections[0].title);assert.equal(r.tone,original.tone);
    assert.deepEqual(r.sections[0].warnings,['IGNITION INTERLOCK DEVICE REQUIRED']);
    assert.equal(r.iidRequired,true);assert.equal(r.autoCloseMs,90000);
    assert.equal(spokenStatus(r),spokenStatus(original));assert.deepEqual(statusRecordings(r),statusRecordings(original));
  }
});
test('IID flags stay bound to DUI/DUAC suspension blocks and do not leak between blocks', () => {
  const n=susp('Driving Under the Influence',{iid:'N'}), y=susp('Other reason',{iid:'Y'});
  for (const blocks of [n+'\n'+y,y+'\n'+n,viol('Driving Under the Influence','A','01/01/2025')+' IID Required: Y',n.replace('IID Required: N','IID Required: YES')]) {
    const r=result(validHeader+' '+blocks);assert.equal(r.iidRequired,undefined);assert.equal(r.autoCloseMs,10000);
  }
  assert.equal(result(validHeader+' '+susp('Unlawful Alcohol Concentration',{iid:'Y'})).iidRequired,true);
});

test('line breaks and page headers inside offense blocks preserve date and ticket associations', () => {
  const original = result(mixedSuspensions);
  const paginated = mixedSuspensions.replace('Causal: 01/15/2024', '\f Certification for Court Page 2 of 3 Driver License No: 123456789 Name: SYNTHETIC, PERSON Causal: 01/15/2024');
  assert.deepEqual(result(paginated), original);
  assert.deepEqual(result(mixedSuspensions.replace(/\s+/g,' ')), original);
});

test('active reasons put Habitual Offender then Driving Under Suspension ahead of larger groups', () => {
  const blocks = [susp('Habitual Offender'), susp('Driving Under Suspension'),
    ...Array.from({length:4},()=>susp('Failure to Pay Traffic Ticket')),
    ...Array.from({length:2},()=>susp('Other reason'))];
  const r=result('Status - DL: SUSPENDED '+blocks.join(' '));
  assert.deepEqual(r.sections[0].columns[0].items,['Habitual Offender × 1','Driving Under Suspension × 1','Failure to Pay Traffic Ticket × 4','Other reason × 2']);
  assert.equal(r.activeSuspensions,8);
});
