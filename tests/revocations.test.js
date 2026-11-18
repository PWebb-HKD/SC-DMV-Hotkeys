// Synthetic revocations only; private driving records and identifiers stay outside Git.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {licenseStatus, recordStatus} from '../extension/status-alerts.js';
import {driverName} from '../extension/driver-identity.js';
import {spokenStatus} from '../extension/audio-alerts.js';
import {statusRecordings} from '../extension/voice-recordings.js';
import {susp, revo, viol, validHeader, statusNow} from './suspension-fixtures.js';
const result = blocks => licenseStatus('Status - DL: SUSPENDED '+blocks, statusNow);

test('a ticketless REVO-only record counts an indefinite revocation in Active Suspensions', () => {
  const block='REVO: 038 - Delinquent Child Support Revocation Beg: 02/01/2024 Revocation End: INDEFINITE Causal: 01/15/2024 Post: 02/02/2024 Reinstatement Requirements Met: INDEFINITE Reinstatement Fee Paid: N';
  for (const text of [block, block.replaceAll(' ', '\n'), block.toLowerCase()]) {
    const r=result(text);
    assert.equal(r.sections[0].title,'LICENSE SUSPENDED');assert.equal(r.tone,'danger');
    assert.equal(r.activeSuspensions,1);assert.equal(r.pendingReinstatement,0);
    assert.deepEqual(r.sections[0].columns.map(c=>c.title),['Active Suspensions']);
    const group=r.sections[0].columns[0].groups[0];
    assert.equal(group.reason.toLowerCase(),'delinquent child support');assert.equal(group.count,1);
    const row=group.occurrences[0];
    assert.deepEqual({...row,reason:row.reason.toLowerCase(),end:row.end.toUpperCase()},
      {reason:'delinquent child support',ticket:'',begin:'02/01/2024',end:'INDEFINITE',violationDate:'01/15/2024',revocation:true});
    assert.doesNotMatch(r.sections[0].lines.join(' '),/No active|not be evaluated/);
    assert.equal(spokenStatus(r),'License suspended');
    assert.deepEqual(statusRecordings(r),statusRecordings(result(susp('Example'))));
    assert.equal(r.autoCloseMs,90000);
  }
  assert.deepEqual(recordStatus('customer','Status - DL: SUSPENDED '+block,statusNow),result(block));
});

test('revocations follow the same end/reinstatement date boundaries and unreadable rules as suspensions', () => {
  for (const [end,met,active,pending,unreadable] of [
    ['INDEFINITE','INDEFINITE',1,0,false],['11/18/2026','11/17/2026',1,0,false],
    ['11/17/2026','INDEFINITE',0,1,false],['01/01/2026','11/18/2026',0,1,false],
    ['01/01/2026','11/17/2026',0,0,false],['01/01/2026','01/01/2026',0,0,false],
    ['01/01/2026','NOT INDEFINITE',0,0,false],['','INDEFINITE',0,0,true],
    ['02/30/2026','INDEFINITE',0,0,true],['01/01/2026','',0,0,false]
  ]) {
    const r=result(revo('Example',{end,met}));
    assert.equal(r.activeSuspensions,active,`${end}/${met}`);assert.equal(r.pendingReinstatement,pending,`${end}/${met}`);
    assert.equal(r.sections[0].lines.some(line=>/not be evaluated/.test(line)),unreadable);
    const comparable=structuredClone(r);
    for(const c of comparable.sections[0].columns)for(const g of c.groups)for(const o of g.occurrences)delete o.revocation;
    assert.deepEqual(comparable,result(susp('Example',{end,met})));
  }
});

test('mixed SUSP/REVO reasons share existing buckets and priority order while retaining their own details', () => {
  const r=result([
    susp('Other',{ticket:'SYNTH-S'}),revo('Other',{ticket:'SYNTH-R'}),
    revo('Habitual Offender'),revo('Driving Under Suspension'),
    revo('Unlawful Alcohol Concentration',{ticket:'SYNTH-P',end:'01/01/2026'}),
    susp('Driving Under the Influence',{ticket:'SYNTH-P2',end:'01/01/2026'})].join('\n'));
  assert.equal(r.activeSuspensions,4);assert.equal(r.pendingReinstatement,2);
  const [active,pending]=r.sections[0].columns;
  assert.deepEqual(active.items,['Habitual Offender × 1','Driving Under Suspension × 1','Other × 2']);
  assert.deepEqual(pending.items,['DUI/DUAC × 2']);
  assert.deepEqual(active.groups[2].occurrences.map(o=>[o.ticket,o.revocation]),[['SYNTH-S',undefined],['SYNTH-R',true]]);
  assert.deepEqual(pending.groups[0].occurrences.map(o=>o.reason),['DUAC','DUI']);
});

test('blank revocation ticket and dates never borrow from adjacent suspension or violation blocks', () => {
  const incomplete=revo('Other',{ticket:''}).replace('Special Driving Privilege: NONE','').replace('Revocation Beg: 01/01/2025','Revocation Beg: ').replace('Causal: 01/15/2024','Causal: ');
  const r=result(incomplete+' '+susp('Other',{ticket:'SYNTH-NEXT'})+' '+viol('Driving Under Suspension','SYNTH-V','01/01/2025'));
  assert.deepEqual(r.sections[0].columns[0].groups[0].occurrences[0],{reason:'Other',ticket:'',begin:'',end:'INDEFINITE',violationDate:'',revocation:true});
  assert.equal(r.priorDus,1);
  // A missing VIOL date must not borrow a later date inside REVO.
  assert.equal(result(viol('Driving Under Suspension','SYNTH-V','')+' '+revo('Other')+' Violation: 01/01/2025').priorDus,0);
  const missingEnd=revo('Other',{end:''});
  assert.equal(result(missingEnd+' '+susp('Other')).activeSuspensions,1);
  assert.equal(result(revo('Other').replace('Revocation End:','Suspension End:')).activeSuspensions,0);
});

test('DUI/DUAC revocations deduplicate against VIOL/SUSP and use VIOL dates before causal dates', () => {
  const blocks=[revo('Driving Under the Influence',{ticket:'SYNTH-A',iid:'Y'}),
    susp('Unlawful Alcohol Concentration',{ticket:'synth-a'}),viol('Driving Under the Influence','SYNTH-A','01/01/2024'),
    revo('Unlawful Alcohol Concentration',{ticket:'SYNTH-B',causal:'11/17/2016'}),
    revo('Driving Under the Influence',{ticket:'SYNTH-C'}),viol('Driving Under the Influence','SYNTH-C','11/16/2016'),
    revo('Driving Under the Influence',{ticket:'SYNTH-F',causal:'11/18/2026'})];
  for(const ordered of [blocks,[...blocks].reverse()]) {
    const r=result(ordered.join(' '));assert.equal(r.priorDuiDuac,2);assert.equal(r.iidRequired,true);
  }
});

test('revocation IID flags remain scoped and preserve ordinary status and audio rules', () => {
  for(const header of [validHeader,validHeader.replace('12/31/2027','01/01/2020'),'Status - DL: SUSPENDED']) {
    const original=licenseStatus(header,statusNow);
    const r=licenseStatus(header+' '+revo('Driving Under the Influence',{iid:'Y',causal:'01/01/2000',end:'01/01/2001',met:'01/01/2001'}),statusNow);
    assert.deepEqual(r.sections[0].warnings,['IGNITION INTERLOCK DEVICE REQUIRED']);assert.equal(r.autoCloseMs,90000);
    assert.equal(r.sections[0].title,original.sections[0].title);assert.equal(spokenStatus(r),spokenStatus(original));
  }
  for(const blocks of [susp('Driving Under the Influence')+' '+revo('Other',{iid:'Y'}),
    revo('Driving Under the Influence')+' '+susp('Other',{iid:'Y'})]) {
    assert.equal(licenseStatus(validHeader+' '+blocks,statusNow).iidRequired,undefined);
  }
});

test('revocation markers delimit Current credentials, privileges and header identity', () => {
  assert.equal(licenseStatus(validHeader+' Special DL Privilege: EXAMPLE '+revo('Other'),statusNow).sections[0].qualifiers[0],'EXAMPLE');
  const broken=validHeader.replace('01/01/2025 12/31/2027','');
  assert.equal(licenseStatus(broken+' '+revo('Other')+' 01/01/2025 12/31/2027',statusNow).sections[0].title,'STATUS UNAVAILABLE');
  assert.equal(driverName('Driver License No: 123456789 REVO: Other Name: MUST NOT LEAK'),'');
});
