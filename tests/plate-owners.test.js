// Owner names/addresses stay paired within their registration blocks and report order.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plateStatus,recordStatus} from '../extension/status-alerts.js';
import {spokenStatus} from '../extension/audio-alerts.js';
import {vehicleReport} from './barcode-fixtures.js';
const now=new Date('2026-10-28T16:00:00Z');
const original='Owner Number: 12345678 Owner Name: EXAMPLE-SAMPLE, JANE MARIE\nOwner Address: 123 EXAMPLE ROAD, COLUMBIA SC 292010123';
const owner={number:'12345678',name:'EXAMPLE-SAMPLE, JANE MARIE',address:'123 EXAMPLE ROAD, COLUMBIA SC 292010123'};
test('plate alerts include the registered name and complete address without vehicle metadata',()=>{
  const result=plateStatus(vehicleReport,now);
  assert.deepEqual(result.owners,[owner]);assert.equal(result.sections[0].title,'TAG VALID');
  assert.equal(result.autoCloseMs,30000);
});
test('multiple owner/customer/registrant identities retain document order, Unicode and their own fields',()=>{
  const parties='Owner Number: 100 Owner Name: FIRST, OWNER Owner Relationship: PRIMARY Owner Address: 100 FIRST ROAD, COLUMBIA SC 29201\n'+
    'Customer Number: C0200 Customer Name: SECOND, PERSON Customer Address: 200 SECOND ROAD, CHARLESTON SC 29401\n'+
    'Registrant / Lessee Number: 300 Registrant / Lessee Name: CAFÉ & SONS LLC Registrant / Lessee Relationship: LESSEE Registrant / Lessee Address: 300 THIRD ROAD, FLORENCE SC 29501';
  const report=vehicleReport.replace(original,parties);
  assert.deepEqual(plateStatus(report,now).owners,[
    {number:'100',name:'FIRST, OWNER',address:'100 FIRST ROAD, COLUMBIA SC 29201'},
    {number:'200',name:'SECOND, PERSON',address:'200 SECOND ROAD, CHARLESTON SC 29401'},
    {number:'300',name:'CAFÉ & SONS LLC',address:'300 THIRD ROAD, FLORENCE SC 29501'}]);
  assert.deepEqual(plateStatus(report.replace(/ /g,'\n\t'),now).owners,plateStatus(report,now).owners);
});
test('missing names/addresses never borrow mailing or a following party identity',()=>{
  const report=vehicleReport.replace(original,'Owner Number: 100 Owner Name: FIRST, OWNER Owner Address: Mailing Address: 999 OTHER ROAD, OTHER CITY SC 99999\n'+
    'Owner Number: 200 Owner Name: Owner Address: 200 SECOND ROAD, CHARLESTON SC 29401\n'+
    'Owner Number: 300 Owner Name: Owner Address:');
  assert.deepEqual(plateStatus(report,now).owners,[{number:'100',name:'FIRST, OWNER',address:''},{number:'200',name:'',address:'200 SECOND ROAD, CHARLESTON SC 29401'},{number:'300',name:'',address:''}]);
});
test('registered identities remain on expired, suspended and unavailable tag alerts and stay out of voice',()=>{
  for(const report of [vehicleReport,vehicleReport.replace('06/20/2030','01/01/2020'),
    vehicleReport.replace('Document obtained','Enforcement Description: Insurance suspension Enforcement Statute: 56-1-460\nDocument obtained'),
    vehicleReport.replace('Plate Class: ABC PRIVATE PASSENGER','Plate Class:')]) {
    const result=recordStatus('plate',report,now);assert.deepEqual(result.owners,[owner]);
    assert.doesNotMatch(spokenStatus(result),/EXAMPLE|ROAD|COLUMBIA|29201/);
  }
});
test('owner parsing excludes footer/enforcement text and unrelated driver reports',()=>{
  const suffix=' Owner Number: 999 Owner Name: NOT A REGISTERED OWNER Owner Address: WRONG';
  assert.deepEqual(plateStatus(vehicleReport+suffix,now).owners,[owner]);
  const enforcement=vehicleReport.replace('Document obtained', 'Enforcement Description: Something '+suffix+' Enforcement Statute: 1-2-3 Document obtained');
  assert.deepEqual(plateStatus(enforcement,now).owners,[owner]);
  assert.equal(plateStatus('Driver License No: 1 Name: DRIVER Owner Number: 2 Owner Name: WRONG Owner Address: WRONG',now).owners,undefined);
  assert.equal(plateStatus(vehicleReport.replace(original,''),now).owners,undefined);
});

test('an omitted co-owner address uses the first owner address, while explicit blanks and lessees stay independent',()=>{
  const report=vehicleReport.replace('Last Transaction:', 'Owner Number: 2222 Owner Name: SHARED, OWNER '+
    'Owner Number: 3333 Owner Name: BLANK, OWNER Owner Address: '+
    'Registrant/Lessee Number: 4444 Registrant/Lessee Name: DISTINCT LESSEE LLC Last Transaction:');
  const owners=plateStatus(report,now).owners;
  assert.equal(owners[1].address,owner.address);assert.equal(owners[2].address,'');assert.equal(owners[3].address,'');
  assert.deepEqual(owners.map(owner=>owner.number),['12345678','2222','3333','4444']);
});
test('short lessee address labels bound the business name and retain the lessee address',()=>{
  for(const label of ['Lessee Address','Registrant Address']) {
    const report=vehicleReport.replace('Last Transaction:', `Registrant/Lessee Number: 2222 Registrant/Lessee Name: SYNTHETIC LESSEE LLC ${label}: 200 LEASE ROAD, FLORENCE SC 29501 Last Transaction:`);
    const second=plateStatus(report,now).owners[1];
    assert.deepEqual(second,{number:'2222',name:'SYNTHETIC LESSEE LLC',address:'200 LEASE ROAD, FLORENCE SC 29501'});
  }
});
test('saved owner customer numbers use normal normalization and omit malformed identifiers',()=>{
  const text=vehicleReport.replace('Owner Number: 12345678','Owner Number: C000001234');
  assert.equal(plateStatus(text,now).owners[0].number,'1234');
  for(const value of ['','INVALID','123456789']) {
    const first=plateStatus(vehicleReport.replace('Owner Number: 12345678',`Owner Number: ${value}`),now).owners[0];
    assert.equal(first.number,undefined);assert.equal(first.name,owner.name);
  }
});
