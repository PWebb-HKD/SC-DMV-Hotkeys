// Pure field mappings and exact framing using synthetic reports; do not add real identifying data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {driverBarcode, vehicleBarcode, reportBarcode, frameAamva, ownerAddress, raceEthnicity, VehiclePartyError} from '../extension/barcode-data.js';
import {driverReport, vehicleReport} from './barcode-fixtures.js';
import {COMMANDS} from '../extension/core.js';
const fields = payload => Object.fromEntries(payload.slice(33).replace(/\r$/, '').split('\n').map(field => [field.slice(0, 3), field.slice(3)]));
const registrationFields = payload => Object.fromEntries(payload.slice(31).replace(/\r$/, '').split('\n').map(field => [field.slice(0, 3), field.slice(3)]));
// Only field identifiers/framing from the supplied screenshots; no real personal data.
const official = JSON.parse(readFileSync(new URL('./sc-barcode-layouts.json', import.meta.url)));
test('driver import translates demographics and uses the current class rather than Prior class', () => {
  const result = driverBarcode(driverReport), f = fields(result.payload);
  assert.equal(result.payload.slice(0, 31), '@\n\x1e\rANSI 636005090001DL0031' + String(result.payload.length - 31).padStart(4, '0'));
  assert.equal(f.DCA, 'D'); assert.equal(f.DAQ, '123456789'); assert.equal(f.DAQ === '12345678', false);
  assert.equal(f.DCS, 'EXAMPLE-SAMPLE'); assert.equal(f.DAC, 'JANE'); assert.equal(f.DAD, 'MARIE');
  assert.equal(f.DBB, '02292000'); assert.equal(f.DBD, '04142026'); assert.equal(f.DBA, '06202030');
  assert.equal(f.DBC, '2'); assert.equal(f.DAU, '065 in'); assert.equal(f.DAW, '140'); assert.equal(f.DAY, 'BRO');
  assert.equal(f.DCF, '1234567890123456789'); assert.equal(f.DAK, '292010123  '); assert.equal(f.DCB, 'NONE'); assert.equal(f.DCD, 'NONE');
  assert.deepEqual(Object.keys(f), official.driver.fields);
  assert.equal(f.DCK, ''); assert.equal(f.DCR, ''); assert.equal(f.DDK, '');
  assert.equal(COMMANDS.barcode.key, 'Alt+B');
});
test('ID records encode class I and retain ID document type', () => {
  const result = driverBarcode(driverReport.replace('DL (R) D Modify', 'ID (R) Renewal'));
  assert.equal(result.payload.slice(21, 23), 'ID'); assert.equal(fields(result.payload).DCA, 'I');
});
test('full race labels map to legacy version-09 DCL codes with three-character padding', () => {
  for (const [label, code] of [['WHITE','W'],['W','W'],['WHT','W'],['WHI','W'],['BLACK','BK'],['B','BK'],['BK','BK'],['BLK','BK'],['AFRICAN AMERICAN','BK'],['ASIAN','AP'],['ASN','AP'],['ASI','AP'],['AP','AP'],['PACIFIC ISLANDER','AP'],['NATIVE AMERICAN','AI'],['AI','AI'],['HISPANIC','H'],['HISP','H'],['hisp','H'],['HISPAN','H'],['H','H'],['UNKNOWN','U'],['UNK','U'],['U','U']]) {
    assert.equal(raceEthnicity(label), code);
    assert.equal(fields(driverBarcode(driverReport.replace('Race: W', `Race: ${label}`)).payload).DCL, code.padEnd(3, ' '));
  }
  const unknown = driverBarcode(driverReport.replace('Race: W', 'Race: NOT A RECOGNIZED LABEL'));
  assert.equal(fields(unknown.payload).DCL, undefined);
  assert.match(unknown.warnings.join(' '), /Race\/ethnicity.*not recognized/);
});
test('blank printed dates, beginner permits and original functions retain current class', () => {
  const result = driverBarcode(driverReport.replace('DL (R) D Modify', 'BP (R) D Original').replace('04/16/2026 ', ''));
  assert.equal(fields(result.payload).DCA, 'D'); assert.equal(fields(result.payload).DBA, '06202030');
});
test('missing current credentials never borrow prior class, dates, or identifier', () => {
  const result = driverBarcode(driverReport.replace(/Current.*?\n/, ''));
  assert.equal(fields(result.payload).DCA, 'unavl'); assert.equal(fields(result.payload).DBA, 'unavl');
});
test('absent driver numbers encode an empty DAQ without substituting the customer number', () => {
  for (const replacement of ['Driver License No:', 'Driver License No:   ', '']) {
    const result = reportBarcode(driverReport.replace('Driver License No: 123456789', replacement));
    assert.equal(result.kind, 'driver'); assert.equal(fields(result.payload).DAQ, '');
    assert.match(result.payload, /\nDAQ\nDCF/);
    assert.doesNotMatch(result.payload, /DAQ12345678|DAQunavl|DAQNONE/);
    assert.match(result.summary, /No license number/);
  }
});
test('invalid nonempty numbers, invalid birth date, and ambiguous addresses still fail', () => {
  assert.throws(() => driverBarcode(driverReport.replace('Driver License No: 123456789', 'Driver License No: INVALID')), /number is invalid/);
  assert.throws(() => driverBarcode(driverReport.replace('02/29/2000', '02/29/2001')), /date of birth/);
  assert.throws(() => vehicleBarcode(vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123', 'UNPARSEABLE ADDRESS')), /separated reliably/);
});
test('registration maps expiration, plate, VIN, owner and vehicle fields with exact subfile byte offsets', () => {
  const result = vehicleBarcode(vehicleReport), text = result.payload;
  assert.equal(text.slice(0, 19), '@\n\x1e\rAAMVA6360050101');
  const entry = text.slice(19, 29), offset = +entry.slice(2, 6), length = +entry.slice(6);
  assert.equal(entry.slice(0, 2), 'RG'); assert.equal(offset, 29); assert.equal(offset + length, text.length); assert.equal(text.at(-1), '\r');
  const f = registrationFields(text);
  assert.deepEqual(Object.keys(f), [...official.vehicle.fields, 'VAM']);
  assert.equal(f.RBB, '20260414'); assert.equal(f.RAG, '20990101'); assert.equal(f.RBT, '20300620');
  assert.equal(f.RAM, 'TEST123  '); assert.equal(f.RBD, 'EXAMPLE-SAMPLE'); assert.equal(f.RBE, 'JANE MARIE');
  assert.equal(f.RBL, 'SC'); assert.equal(f.RBI, '123 EXAMPLE ROAD'); assert.equal(f.RBK, 'COLUMBIA'); assert.equal(f.RBM, '292010123');
  assert.equal(f.VAD, '1HGCM82633A004352'); assert.equal(f.VAK, 'HOND'); assert.equal(f.VAL, '2003'); assert.equal(f.VAO, 'SD'); assert.equal(f.VAM, 'ACCORD'); assert.equal(f.RBU, '');
  assert.doesNotMatch(text, /RBC|IFJ|IR\d{8}|VH\d{8}/);
});
test('temporary registrations retain separate plate and decal expiration fields', () => {
  const result = vehicleBarcode(vehicleReport.replace('ABC PRIVATE PASSENGER', 'T45V TEMPORARY PLATE-VEHICLE'));
  assert.match(result.payload, /RAG20990101/); assert.doesNotMatch(result.payload, /RAG20300620/);
});
test('T45V plate numbers exclude a space-separated display year without changing other plate numbers', () => {
  const temporary = vehicleReport.replace('ABC PRIVATE PASSENGER', 'T45V TEMPORARY PLATE-VEHICLE');
  const report = temporary.replace('Plate Number: TEST123', 'Plate Number: XPZ1107U 2026');
  const result = vehicleBarcode(report);
  assert.equal(registrationFields(result.payload).RAM, 'XPZ1107U ');
  assert.match(result.summary, /^XPZ1107U ·/); assert.doesNotMatch(result.summary, /2026/);
  assert.equal(registrationFields(vehicleBarcode(temporary.replace('TEST123', 'ABCD2026')).payload).RAM, 'ABCD2026 ');
  assert.equal(registrationFields(vehicleBarcode(temporary).payload).RAM, 'TEST123  ');
  assert.equal(registrationFields(vehicleBarcode(vehicleReport.replace('Plate Number: TEST123', 'Plate Number: ABCD 2026')).payload).RAM, 'ABCD 2026');
});
test('the confirmed SC registration profile preserves both official screenshot date fields', () => {
  const text = vehicleReport.replace('Plate Exp Date: 01/01/2099', 'Plate Exp Date: 02/29/2028').replace('Decal Exp Date: 06/20/2030', 'Decal Exp Date: 02/28/2027');
  const f = registrationFields(vehicleBarcode(text).payload);
  assert.equal(f.RAG, '20280229'); assert.equal(f.RBT, '20270228');
});
test('registration does not replace missing issue date with the title date; companies use the business-name field', () => {
  const text = vehicleReport.replace('Date of Issue: 04/14/2026', 'Date of Issue:').replace('Owner Name: EXAMPLE-SAMPLE, JANE MARIE', 'Owner Name: EXAMPLE COMPANY LLC');
  const f = registrationFields(vehicleBarcode(text).payload);
  assert.equal(f.RBB, ''); assert.equal(f.BBC, 'EXAMPLE COMPANY LLC'); assert.equal(f.RBD, ''); assert.equal(f.RBE, '');
});
test('driver restriction flags do not invent actual restriction codes or copy sample metadata', () => {
  const f = fields(driverBarcode(driverReport.replace('N N 1234567890123456789', 'Y Y 1234567890123456789')).payload);
  assert.equal(f.DCB, 'unavl'); assert.equal(f.DCD, 'unavl'); assert.equal(f.DCR, ''); assert.equal(f.DCK, ''); assert.equal(f.DAX, '');
});
test('owner address supports the SC comma-after-state layout and multiword cities', () => {
  const address = ownerAddress('123 EXAMPLE DR ROCK HILL SC, 297321234');
  assert.deepEqual(address, {street: '123 EXAMPLE DR', city: 'ROCK HILL', state: 'SC', zip: '297321234', inferred: true});
  const result = vehicleBarcode(vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123', '123 EXAMPLE DR ROCK HILL SC, 297321234'));
  assert.match(result.payload, /RBI123 EXAMPLE DR\nRBKROCK HILL\nRBLSC\nRBM297321234/);
  assert.match(result.warnings[0], /Verify owner address/);
});
test('address splitting preserves units, PO boxes, and existing comma formats without guessing ambiguous cities', () => {
  assert.equal(ownerAddress('123 EXAMPLE DR APT 4 ROCK HILL SC, 29732').street, '123 EXAMPLE DR APT 4');
  assert.equal(ownerAddress('PO BOX 123 ROCK HILL SC, 29732').city, 'ROCK HILL');
  assert.equal(ownerAddress('123 EXAMPLE ROAD, COLUMBIA, SC, 29201').city, 'COLUMBIA');
  assert.equal(ownerAddress('123 EXAMPLE ROAD, COLUMBIA SC 29201').city, 'COLUMBIA');
  assert.equal(ownerAddress('123 UNKNOWN ROCK HILL SC, 29732'), null);
  assert.equal(ownerAddress('123 EXAMPLE DR SOME WAY CITY SC, 29732'), null);
});
test('record detection rejects unrelated documents; non-ASCII input cannot corrupt subfile offsets', () => {
  assert.equal(reportBarcode(driverReport).kind, 'driver'); assert.equal(reportBarcode(vehicleReport).kind, 'vehicle');
  assert.throws(() => reportBarcode('unrelated text'), /No driver or vehicle/);
  assert.throws(() => frameAamva([{type: 'DL', fields: [['DCS', '\u4e2d']]}]), /ASCII/);
});

for (const plateClass of ['T45V TEMPORARY PLATE-VEHICLE', 'E45V EVR TEMPORARY PLATE-VEHICLE', 'E60V EVR TEMPORARY PLATE-VEHICLE']) {
  test(`${plateClass}: blank decal dates inherit plate expiry and display years are excluded`, () => {
    const temporary = vehicleReport.replace('ABC PRIVATE PASSENGER', plateClass)
      .replace('TEST123', 'TEST1234 2026');
    for (const blank of ['', '   ']) {
      const result = vehicleBarcode(temporary.replace('06/20/2030', blank + '\nGVW: 0 Empty Weight: 1 Equip Number: Annual Fee: $0.00'));
      const f = registrationFields(result.payload);
      assert.equal(f.RAG, '20990101'); assert.equal(f.RBT, f.RAG);
      assert.equal(f.RAM, 'TEST1234 ');
      assert.doesNotMatch(result.warnings.join(' '), /Decal expiration is unavailable/);
    }
    assert.equal(registrationFields(vehicleBarcode(temporary).payload).RBT, '20300620');
    const invalid = vehicleBarcode(temporary.replace('06/20/2030', '02/30/2030'));
    assert.equal(registrationFields(invalid.payload).RBT, '');
    assert.match(invalid.warnings.join(' '), /Decal expiration is unavailable/);
    assert.throws(() => vehicleBarcode(temporary.replace('01/01/2099', '')), /plate expiration/);
  });
}
test('ordinary plates do not inherit plate expiry when the decal date is blank', () => {
  const result = vehicleBarcode(vehicleReport.replace('06/20/2030', ''));
  assert.equal(registrationFields(result.payload).RBT, '');
  assert.match(result.warnings.join(' '), /Decal expiration is unavailable/);
});

test('driver suffixes have their own DCU field rather than becoming middle or family names', () => {
  for (const suffix of ['JR', 'SR', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']) {
    for (const name of [`EXAMPLE-SAMPLE, JANE MARIE ${suffix}`, `EXAMPLE-SAMPLE, JANE MARIE, ${suffix}.`, `EXAMPLE-SAMPLE ${suffix}, JANE MARIE`]) {
      const result = driverBarcode(driverReport.replace('EXAMPLE-SAMPLE, JANE MARIE', name));
      const f = fields(result.payload);
      assert.equal(f.DCS, 'EXAMPLE-SAMPLE'); assert.equal(f.DAC, 'JANE'); assert.equal(f.DAD, 'MARIE');
      assert.equal(f.DCU, suffix); assert.ok(result.summary.includes(`JANE ${suffix}`));
      const entry = result.payload.slice(21, 31);
      assert.equal(+entry.slice(6), result.payload.length - 31);
    }
  }
  const noMiddle = fields(driverBarcode(driverReport.replace('JANE MARIE', 'JANE jr.')).payload);
  assert.equal(noMiddle.DAD, 'NONE'); assert.equal(noMiddle.DCU, 'JR');
  const ordinary = fields(driverBarcode(driverReport).payload);
  assert.equal(ordinary.DAD, 'MARIE'); assert.equal(ordinary.DCU, undefined);
});

test('registrant/lessee fields terminate the owner address without replacing owner barcode identity',()=>{
  for(const label of ['Registrant/Lessee','Registrant / Lessee']){
    const text=vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123', '123 EXAMPLE DR ROCK HILL SC, 297321234')
      .replace('Last Transaction: RENEWAL', `${label} Number: 00002222\n${label} Name: OTHER, PERSON\n${label} Address: 456 OTHER ROAD, OTHER CITY SC 29202\nLast Transaction: RENEWAL`);
    const result=vehicleBarcode(text),f=registrationFields(result.payload);
    assert.equal(f.RBI,'123 EXAMPLE DR');assert.equal(f.RBK,'ROCK HILL');assert.equal(f.RBL,'SC');assert.equal(f.RBM,'297321234');
    assert.equal(f.RBD,'EXAMPLE-SAMPLE');assert.equal(f.RBE,'JANE MARIE');
    assert.doesNotMatch(result.payload,/00002222|OTHER/);
  }
});

test('vehicle barcode uses only the first party regardless of number category or later duplicate party labels',()=>{
  const original='Owner Number: 12345678 Owner Name: EXAMPLE-SAMPLE, JANE MARIE\nOwner Address: 123 EXAMPLE ROAD, COLUMBIA SC 292010123';
  for(const type of ['Owner','Customer','Registrant/Lessee','Registrant / Lessee']){
    const first=`${type} Number: 1111 ${type} Name: FIRST, PERSON ${type} Address: 123 FIRST ROAD, COLUMBIA SC 29201`;
    const later='Owner Number: 2222 Owner Name: LATER, OWNER Owner Address: 456 LATER ROAD, CHARLESTON SC 29401 Registrant/Lessee Number: 3333 Registrant/Lessee Name: LATER, LESSEE Registrant/Lessee Address: 789 OTHER ROAD, GREENVILLE SC 29601';
    const result=vehicleBarcode(vehicleReport.replace(original,first+' '+later)),f=registrationFields(result.payload);
    assert.equal(f.RBD,'FIRST');assert.equal(f.RBE,'PERSON');assert.equal(f.RBI,'123 FIRST ROAD');assert.equal(f.RBK,'COLUMBIA');
    assert.doesNotMatch(result.payload,/LATER|LESSEE|456|789 OTHER/);
  }
});
test('an incomplete first party never borrows a name or address from a later complete party',()=>{
  const original='Owner Number: 12345678 Owner Name: EXAMPLE-SAMPLE, JANE MARIE\nOwner Address: 123 EXAMPLE ROAD, COLUMBIA SC 292010123';
  for(const first of ['Owner Number: 1111 Owner Name: FIRST, PERSON Owner Address:', 'Owner Number: 1111 Owner Name: Owner Address: 123 FIRST ROAD, COLUMBIA SC 29201']){
    const later='Owner Number: 2222 Owner Name: LATER, OWNER Owner Address: 456 LATER ROAD, CHARLESTON SC 29401';
    assert.throws(()=>vehicleBarcode(vehicleReport.replace(original,first+' '+later)),/first listed party/);
  }
});

test('incomplete party errors expose an explicit next-party choice without automatically using later parties',()=>{
  const original='Owner Number: 12345678 Owner Name: EXAMPLE-SAMPLE, JANE MARIE\nOwner Address: 123 EXAMPLE ROAD, COLUMBIA SC 292010123';
  const next='Registrant/Lessee Number: 2222 Registrant/Lessee Name: NEXT, PERSON Registrant/Lessee Address: 456 NEXT ROAD, CHARLESTON SC 29401';
  const multiple=vehicleReport.replace(original,'Owner Number: 1111 Owner Name: FIRST, PERSON Owner Address: '+next);
  assert.throws(()=>vehicleBarcode(multiple),error=>error instanceof VehiclePartyError&&error.hasNext&&error.nextPartyIndex===1);
  const f=registrationFields(vehicleBarcode(multiple,{partyIndex:1}).payload);
  assert.equal(f.RBD,'NEXT');assert.equal(f.RBE,'PERSON');assert.equal(f.RBI,'456 NEXT ROAD');
  const only=vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS');
  assert.throws(()=>vehicleBarcode(only),error=>error instanceof VehiclePartyError&&!error.hasNext);
  const duplicate=vehicleReport.replace(original,'Owner Number: 1111 Owner Name: FIRST, PERSON Owner Address: '+next.replace('2222','00001111'));
  assert.throws(()=>vehicleBarcode(duplicate),error=>error instanceof VehiclePartyError&&!error.hasNext);
});

test('explicit generate-with-blanks preserves known first-party fields and never borrows from later parties',()=>{
  const noAddress=vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS');
  const result=vehicleBarcode(noAddress,{allowIncompleteParty:true}),f=registrationFields(result.payload);
  assert.equal(f.RBD,'EXAMPLE-SAMPLE');assert.equal(f.RBE,'JANE MARIE');
  for(const key of ['RBI','RBK','RBL','RBM'])assert.equal(f[key],'');
  assert.match(result.warnings.join(' '),/address fields are blank/);assert.equal(f.RAM,'TEST123  ');
  const noName=vehicleReport.replace('Owner Name: EXAMPLE-SAMPLE, JANE MARIE','Owner Name:');
  const missing=vehicleBarcode(noName,{allowIncompleteParty:true}),g=registrationFields(missing.payload);
  assert.equal(g.RBD,'');assert.equal(g.RBE,'');assert.equal(g.RBI,'123 EXAMPLE ROAD');
  assert.match(missing.warnings.join(' '),/name fields are blank/);
  assert.throws(()=>vehicleBarcode(noAddress.replace('VIN: 1HGCM82633A004352','VIN: INVALID'),{allowIncompleteParty:true}),/VIN is invalid/);
});

test('partially missing person names require explicit blank-field approval and retain the known component',()=>{
  for(const [name,family,given] of [['EXAMPLE,','EXAMPLE',''],[', PERSON','','PERSON']]){
    const text=vehicleReport.replace('EXAMPLE-SAMPLE, JANE MARIE',name);
    assert.throws(()=>vehicleBarcode(text),VehiclePartyError);
    const result=vehicleBarcode(text,{allowIncompleteParty:true}),f=registrationFields(result.payload);
    assert.equal(f.RBD,family);assert.equal(f.RBE,given);assert.equal(f.RBI,'123 EXAMPLE ROAD');
    assert.match(result.warnings.join(' '),/missing name fields are blank/);
  }
});

test('a missing numbered-party heading offers blanks without treating unbound names as the owner',()=>{
  const text=vehicleReport.replace('Owner Number: 12345678','');
  assert.throws(()=>vehicleBarcode(text),error=>error instanceof VehiclePartyError&&!error.hasNext);
  const result=vehicleBarcode(text,{allowIncompleteParty:true}),f=registrationFields(result.payload);
  for(const key of ['RBD','RBE','RBI','RBK','RBL','RBM'])assert.equal(f[key],'');
  assert.equal(f.RAM,'TEST123  ');assert.match(result.warnings.join(' '),/fields are blank/);
});

test('a separate mailing address cannot contaminate the first owner address on a personalized tag',()=>{
  const report=vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123', '123 EXAMPLE DR ROCK HILL SC, 297321234 Mailing Address: PO BOX 456 COLUMBIA SC, 292010123')
    .replace('Plate Class: ABC PRIVATE PASSENGER','Plate Class: PR PERSONALIZED PLATE');
  const f=registrationFields(vehicleBarcode(report).payload);
  assert.equal(f.RBI,'123 EXAMPLE DR');assert.equal(f.RBK,'ROCK HILL');assert.equal(f.RBM,'297321234');assert.equal(f.RAM,'TEST123  ');
  assert.equal(f.RBD,'EXAMPLE-SAMPLE');assert.equal(f.RBE,'JANE MARIE');assert.ok(!Object.values(f).some(v=>v.includes('PO BOX 456')));
});

test('party relationship labels terminate owner names without borrowing a later party',()=>{
  for(const category of ['Owner','Customer','Registrant/Lessee']) {
    const report=vehicleReport.replaceAll('Owner ',category+' ')
      .replace(`${category} Name: EXAMPLE-SAMPLE, JANE MARIE`,`${category} Name: EXAMPLE-SAMPLE, JANE MARIE\n${category} Relationship: AND`)
      .replace('Last Transaction: RENEWAL','Owner Number: 22222222 Owner Name: LATER, PERSON Last Transaction: RENEWAL');
    const f=registrationFields(vehicleBarcode(report).payload);
    assert.equal(f.RBD,'EXAMPLE-SAMPLE');assert.equal(f.RBE,'JANE MARIE');assert.equal(f.RBI,'123 EXAMPLE ROAD');assert.equal(f.RBK,'COLUMBIA');
    assert.ok(!Object.values(f).some(value=>/RELATIONSHIP|LATER|PERSON/.test(value)));
    // Even when the user explicitly selects a later party, do not inherit the first address.
    assert.throws(()=>vehicleBarcode(report,{partyIndex:1}),error=>error instanceof VehiclePartyError&&!error.hasNext);
  }
});
