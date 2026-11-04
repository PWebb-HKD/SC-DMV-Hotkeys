// Calendar-date status rules and suspension summaries on synthetic report text.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plateStatus, licenseStatus, recordStatus, parseReportDate, reportToday, expirationAge} from '../extension/status-alerts.js';
import {loginSucceeded, ROOT, LOGIN} from '../extension/core.js';
const NOW = new Date('2026-10-28T16:00:00Z');
const HEADER = 'Type Class Function Issued Expires Printed Date Restr.Endor.Document Identifier';
const titles = alert => alert.sections.map(section => section.title).filter(Boolean);
const vehicle = (expiration, extra = '', type = 'ABC PRIVATE PASSENGER') => `Plate Class: ${type}\nPlate Exp Date: 01/01/2000\nDecal Exp Date: ${expiration}\n${extra}`;
const current = (type = 'DL (C)', expiry = '10/28/2026') => `License Information ${HEADER} Current (ACN / DDN) ${type} Renewal 01/01/2020 ${expiry} 01/01/2020`;
const driver = (body = current(), number = '123456789') => `Status - DL: NO SUSPENSION\nDriver License No:${number} Name: FICTIONAL, PERSON\n${body}`;
const suspension = (reason, {begin = '01/01/2020', end = 'INDEFINITE', met = 'NO'} = {}) => `SUSP: ${reason} Special Driving Privilege: NONE Suspension Beg: ${begin} Suspension End: ${end} Causal: 01/01/2020 Post: 01/02/2020 Reinstatement Requirements Met: ${met} Reinstatement Fee Paid: NO`;
const violation = (date, description = 'Driving Under Suspension') => `VIOL: 123 - ${description} Ticket#: FICTIONAL Violation: ${date}`;

test('login success accepts any other exact HTTPS SCDMV origin URL, excluding login and lookalike hosts', () => {
  assert.equal(loginSucceeded(`${ROOT}/SCTRNS/Member/Home.aspx`), true);
  assert.equal(loginSucceeded(`${ROOT}/`), true);
  assert.equal(loginSucceeded(LOGIN), false);
  assert.equal(loginSucceeded(`${LOGIN}?error=1`), false);
  assert.equal(loginSucceeded('https://www.scdmvonline.com.evil.test/home'), false);
  assert.equal(loginSucceeded('http://www.scdmvonline.com/home'), false);
});
test('report dates validate leap years and use South Carolina calendar days', () => {
  assert.equal(parseReportDate('02/29/2024').day, 29);
  assert.equal(parseReportDate('02/29/2025'), null);
  assert.equal(parseReportDate('13/01/2025'), null);
  assert.equal(reportToday(new Date('2026-10-29T03:30:00Z')).day, 28);
});
test('expiration duration reports calendar years, months, and days without DST drift', () => {
  assert.deepEqual({...expirationAge(parseReportDate('09/27/2025'), reportToday(NOW)), text: ''}, {years: 1, months: 1, days: 1, totalDays: 396, text: ''});
  assert.equal(expirationAge(parseReportDate('01/31/2026'), parseReportDate('03/01/2026')).text, '1 month, 1 day (29 days total)');
  assert.equal(expirationAge(parseReportDate('02/29/2024'), parseReportDate('02/28/2025')).years, 1);
});
test('ordinary plates use Decal Exp Date; an expiration of today remains valid', () => {
  const valid = plateStatus(vehicle('10/28/2026'), NOW);
  assert.deepEqual(titles(valid), ['TAG VALID']); assert.equal(valid.autoCloseMs, 10000);
  assert.deepEqual(titles(plateStatus(vehicle('10/27/2026'), NOW)), ['EXPIRED']);
});
test('T45V temporary plates use Plate Exp Date instead of Decal Exp Date', () => {
  const text = 'Plate Class: T45V TEMPORARY PLATE-VEHICLE Plate Exp Date: 11/01/2026 Decal Exp Date: 01/01/2000';
  assert.deepEqual(titles(plateStatus(text, NOW)), ['TAG VALID']);
  assert.deepEqual(titles(plateStatus(text.replace('11/01/2026', '10/27/2026'), NOW)), ['EXPIRED']);
});
test('plate expiration and suspension combine in one red alert with the description and statute', () => {
  const result = plateStatus(vehicle('09/27/2025', 'Enforcement Description: Failure to maintain insurance Enforcement Statute: 1 – 22 – 3333'), NOW);
  assert.deepEqual(titles(result), ['TAG SUSPENDED', 'EXPIRED']);
  assert.deepEqual(result.sections[0].lines, ['Failure to maintain insurance', 'Statute: 1-22-3333']);
  assert.match(result.sections[1].lines[0], /1 year, 1 month, 1 day/); assert.equal(result.autoCloseMs, 90000);
});
test('missing expiry never produces a valid plate, and malformed statutes do not hide a suspension', () => {
  assert.equal(plateStatus('Plate Class: ABC', NOW).tone, 'warning');
  const result = plateStatus(vehicle('11/01/2026', 'Enforcement Description: Suspended registration Enforcement Statute: 12345-1-2'), NOW);
  assert.deepEqual(titles(result), ['TAG SUSPENDED']); assert.match(result.sections[0].lines[1], /could not be read/);
});
test('active suspensions are grouped without three-digit codes and sorted by descending count', () => {
  const text = ['Status - DL:SUSPENDED',
    ...Array.from({length: 3}, () => suspension('018 - Failure to Stop for Blue Light')),
    ...Array.from({length: 2}, () => suspension('036 - Controlled Substance Violation')),
    ...Array.from({length: 5}, () => suspension('097 - Failure to Pay Traffic Ticket')),
    suspension('097 - Failure to Pay Traffic Ticket', {begin: '10/29/2026'}),
    suspension('018 - Failure to Stop for Blue Light', {end: '10/28/2026'})].join('\n');
  const result = licenseStatus(text, NOW);
  assert.equal(result.activeSuspensions, 10);
  assert.deepEqual(result.sections[0].items, ['Failure to Pay Traffic Ticket × 5', 'Failure to Stop for Blue Light × 3', 'Controlled Substance Violation × 2']);
});
test('suspension rules cover start today, future starts, indefinite requirements, and end-date boundaries', () => {
  const text = ['Status - DL: SUSPENDED',
    suspension('001 - Start Today', {begin: '10/28/2026', end: '10/29/2026'}),
    suspension('002 - End Today', {end: '10/28/2026'}),
    suspension('003 - Requirements Indefinite', {end: '01/01/2020', met: 'INDEFINITE'}),
    suspension('004 - Future Start', {begin: '10/29/2026'}),
    suspension('005 - Past End', {end: '10/27/2026'}),
    suspension('006 - Not Indefinite', {end: '10/27/2026', met: 'NOT INDEFINITE'})].join(' ');
  const result = licenseStatus(text, NOW); assert.equal(result.activeSuspensions, 2);
  assert.deepEqual(result.sections[0].items, ['Requirements Indefinite × 1', 'Start Today × 1']);
});
test('suspension grouping ignores Ticket#: and its entire suffix', () => {
  const text = ['Status - DL: SUSPENDED',
    suspension('043 - Owner Operating an Uninsured Motor Vehicle Ticket#: 12345'),
    suspension('043 - Owner Operating an Uninsured Motor Vehicle Ticket #: ABC678 extra text'),
    suspension('043 - Owner Operating an Uninsured Motor Vehicle ticket#:'),
    suspension('043 - Owner Operating an Uninsured Motor Vehicle')].join('\n');
  const result = licenseStatus(text, NOW);
  assert.equal(result.activeSuspensions, 4);
  assert.deepEqual(result.sections[0].items, ['Owner Operating an Uninsured Motor Vehicle × 4']);
});

test('traffic-ticket suspensions without Special Driving Privilege or reinstatement fields remain evaluable', () => {
  const blocks = ['06/08/2021', '09/06/2018', '06/22/2015'].map((date, index) =>
    `SUSP: 097 - Failure to Pay Traffic Ticket Ticket#: TEST${index}
     Suspension Beg: ${date} Suspension End: INDEFINITE
     Causal: 01/01/2015 Post: 01/02/2015
     Ticket Paid: Compliance Received:
     ACD: D56 Court Name: FICTIONAL COURT
     Status: Active Reason: Last Change: 01/02/2015`);
  const result = licenseStatus(['Status - DL: SUSPENDED', ...blocks, suspension('018 - Failure to Stop for Blue Light')].join('\n'), NOW);
  assert.equal(result.activeSuspensions, 4);
  assert.deepEqual(result.sections[0].items, ['Failure to Pay Traffic Ticket × 3', 'Failure to Stop for Blue Light × 1']);
  assert.doesNotMatch(result.sections[0].lines.join(' '), /could not be evaluated/);
});

test('DUS priors include the five-year anniversary and today but exclude older, future, and other violations', () => {
  const text = ['Status - DL: SUSPENDED', suspension('001 - Example'), violation('10/28/2021'), violation('10/27/2021'), violation('10/28/2026'), violation('10/29/2026'), violation('01/01/2025', 'Speeding')].join('\n');
  const result = licenseStatus(text, NOW); assert.equal(result.priorDus, 2);
  assert.equal(result.sections[0].lines[0], '2 Prior DUS convictions within 5 years');
});
test('a suspended report with no active matching entries stays red and explains the empty tally', () => {
  const result = licenseStatus(`Status - DL:SUSPENDED ${suspension('001 - Expired', {end: '10/28/2026'})}`, NOW);
  assert.equal(result.activeSuspensions, 0); assert.deepEqual(titles(result), ['LICENSE SUSPENDED']);
  assert.match(result.sections[0].lines.join(' '), /No active/);
});
test('no-suspension reports use the first license-number occurrence, including an empty first occurrence', () => {
  const text = driver(current(), ' ') + ' Driver License No: 999999999 Name: OTHER, PERSON';
  assert.deepEqual(titles(licenseStatus(text, NOW)), ['NOT LICENSED']);
});
test('ID-only classes ignore single-letter parentheses', () => {
  for (const type of ['ID', 'ID (A)', 'ID(A)', '(A) ID']) assert.deepEqual(titles(licenseStatus(driver(current(type)), NOW)), ['NOT LICENSED ID ONLY']);
});
test('current licenses use the second Renewal date, with today valid and yesterday expired', () => {
  assert.deepEqual(titles(licenseStatus(driver(current('DL (C)', '10/28/2026')), NOW)), ['VALID LICENSE']);
  assert.deepEqual(titles(licenseStatus(driver(current('DL (C)', '10/27/2026')), NOW)), ['LICENSE EXPIRED']);
  assert.equal(licenseStatus(driver(), NOW).autoCloseMs, 10000);
});
test('Current expiration accepts Modify, Duplicate, and a missing Printed Date', () => {
  for (const row of [
    'DL D Modify 04/14/2026 06/20/2027 04/16/2026 N N DOCUMENT DL Barcode Unavailable',
    'DL D Renewal 09/20/2022 09/20/2030 N N DOCUMENT',
    'DL (R) D Duplicate 05/05/2025 04/09/2032 N N DOCUMENT',
  ]) {
    const report = driver(`License Information ${HEADER} Current (ACN / DDN) ${row} Prior DL D Renewal 01/01/2000 01/01/2001`);
    assert.deepEqual(titles(licenseStatus(report, NOW)), ['VALID LICENSE']);
  }
  const expired = driver(`License Information ${HEADER} Current DL D Original 01/01/2000 10/27/2026 N N DOCUMENT`);
  assert.deepEqual(titles(licenseStatus(expired, NOW)), ['LICENSE EXPIRED']);
  const missing = driver(`License Information ${HEADER} Current DL D Duplicate 01/01/2020 N N DOCUMENT Prior DL D Renewal 01/01/2020 01/01/2030`);
  assert.equal(licenseStatus(missing, NOW).tone, 'warning');
});

test('absence of Current means no longer licensed, while Prior never overrides an existing Current row', () => {
  const prior = `License Information ${HEADER} Prior DL Renewal 01/01/2010 01/01/2015 01/01/2010`;
  assert.deepEqual(titles(licenseStatus(driver(prior), NOW)), ['NO LONGER LICENSED IN SC']);
  assert.deepEqual(titles(licenseStatus(driver(''), NOW)), ['NO LONGER LICENSED IN SC']);
  assert.deepEqual(titles(licenseStatus(driver(`${current()} ${prior}`), NOW)), ['VALID LICENSE']);
});
test('unreadable status or current expiration produces an unavailable alert, not a green result', () => {
  assert.equal(licenseStatus('Unreadable report', NOW).tone, 'warning');
  assert.equal(licenseStatus(driver(current('DL', '02/30/2026')), NOW).tone, 'warning');
  assert.equal(licenseStatus(driver() + ' Status - DL:SUSPENDED', NOW).tone, 'warning');
});
test('PDF whitespace changes are tolerated and residence/SCUTTIES result types do not get driver alerts', () => {
  assert.deepEqual(titles(licenseStatus(driver().replace(/ /g, '\n\t'), NOW)), ['VALID LICENSE']);
  assert.equal(recordStatus('address', driver(), NOW), null);
  assert.equal(recordStatus('scutties', driver(), NOW), null);
  assert.deepEqual(titles(recordStatus('customer', driver(), NOW)), ['VALID LICENSE']);
});

for (const plateClass of ['T45V TEMPORARY PLATE-VEHICLE', 'E60V EVR TEMPORARY PLATE-VEHICLE']) {
  test(`${plateClass}: status uses plate expiry with blank or conflicting decal dates`, () => {
    for (const decal of ['', '01/01/2000', '01/01/2099']) {
      const text = `Plate Class: ${plateClass} Vehicle Type: 4 Plate Exp Date: 10/28/2026 Decal Exp Date: ${decal}`;
      assert.deepEqual(titles(plateStatus(text, NOW)), ['TAG VALID']);
      assert.deepEqual(titles(plateStatus(text.replace('10/28/2026', '10/27/2026'), NOW)), ['EXPIRED']);
      assert.deepEqual(titles(plateStatus(text.replace('10/28/2026', ''), NOW)), ['STATUS UNAVAILABLE']);
    }
  });
}

test('plate popups include make/model/year/body from the vehicle heading for valid, expired and suspended tags',()=>{
  const heading='VIN: SYNTHETIC-VIN Year: 2026 Make: MERCEDES BENZ Model: EXAMPLE MODEL Body: 4D\nEmpty Weight: 3000 Title Number: 999';
  for(const [expiration,extra,tone] of [['11/01/2026','','success'],['10/27/2026','','danger'],['11/01/2026','Enforcement Description: Insurance suspension Enforcement Statute: 56-1-460','danger']]){
    const result=plateStatus(heading+'\n'+vehicle(expiration,extra),NOW);
    assert.equal(result.tone,tone);
    assert.deepEqual(result.vehicle,{make:'MERCEDES BENZ',model:'EXAMPLE MODEL',year:'2026',body:'4D'});
    assert.equal(JSON.stringify(result).includes('SYNTHETIC-VIN'),false);
    assert.equal(JSON.stringify(result.vehicle).includes('3000'),false);
  }
});
test('vehicle metadata respects heading boundaries and tolerates blank fields without guessing',()=>{
  const result=plateStatus('VIN: SYNTHETIC Year: 2026 Make: TEST Model: Body: Empty Weight: 3000 '+vehicle('11/01/2026'),NOW);
  assert.deepEqual(result.vehicle,{make:'TEST',model:'',year:'2026',body:''});
  assert.equal(plateStatus(vehicle('11/01/2026'),NOW).vehicle,undefined);
  assert.equal(plateStatus('VIN: SYNTHETIC Year: 2026 Make: TEST Model: EXAMPLE Body: 4S '+vehicle('11/01/2026'),NOW).vehicle,undefined);
});

test('vehicle summary never borrows fields from a later record when the first heading is incomplete',()=>{
  const text='VIN: FIRST Year: 2026 Model: FIRST MODEL Body: 4S Empty Weight: 3000 '+
    'VIN: SECOND Year: 2025 Make: SECOND MAKE Model: SECOND MODEL Body: 4D Empty Weight: 4000 '+vehicle('11/01/2026');
  assert.equal(plateStatus(text,NOW).vehicle,undefined);
});
