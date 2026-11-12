// Verify corrections against wire fields and directory boundaries, not just UI state.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportBarcode, reportBarcodeDraft, vehicleBarcode} from '../extension/barcode-data.js';
import {barcodeEditorModel, editedBarcode} from '../extension/barcode-editor.js';
import {driverReport, vehicleReport} from './barcode-fixtures.js';
const modelFor = source => barcodeEditorModel(reportBarcode(source));
/** Decode the rebuilt payload through the editor's validated directory reader. */
function fields(payload, kind) {return Object.fromEntries(barcodeEditorModel({payload,kind}).fields);}

test('untouched driver, ID, business, temporary, and approved-blank barcodes round-trip byte for byte',()=>{
  const data = [reportBarcode(driverReport),reportBarcode(driverReport.replace('DL (R) D Modify','ID (R) Renewal')),
    reportBarcode(vehicleReport),reportBarcode(vehicleReport.replace('EXAMPLE-SAMPLE, JANE MARIE','SYNTHETIC BUSINESS LLC')),
    reportBarcode(vehicleReport.replace('ABC PRIVATE PASSENGER','60 DAY TEMPORARY')),
    vehicleBarcode(vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','NO ADDRESS'),{allowIncompleteParty:true})];
  for (const original of data) {
    const model = barcodeEditorModel(original), result = editedBarcode(model,model.values);
    assert.deepEqual(result.errors,{});assert.equal(result.payload,original.payload);
  }
});
test('driver corrections convert readable data, insert suffix, and preserve credential inventory',()=>{
  const model = modelFor(driverReport), result = editedBarcode(model,{...model.values,DCS:'Updated',DAC:'Alex',DAD:'Lee',DCU:'JR',DAG:'456 Updated Lane',DAK:'12345-6789',DBB:'2000-02-28',DAU:'72',DAW:'85',DAY:'Blue',DBC:'Male',DCL:'Black'});
  assert.deepEqual(result.errors,{});
  const f = fields(result.payload,'driver');
  assert.equal(f.DCS,'UPDATED');assert.equal(f.DAC,'ALEX');assert.equal(f.DAD,'LEE');assert.equal(f.DCU,'JR');
  assert.equal(f.DAG,'456 UPDATED LANE');assert.equal(f.DAK,'123456789  ');assert.equal(f.DBB,'02282000');
  assert.equal(f.DAU,'072 in');assert.equal(f.DAW,'085');assert.equal(f.DAY,'BLU');assert.equal(f.DBC,'1');assert.equal(f.DCL,'BK ');
  for(const key of ['DCF','DCK','DCM','DCR','DDE','DDG']) assert.equal(f[key],Object.fromEntries(model.fields)[key]);
  assert.match(result.payload,/DADLEE\nDCUJR\n/);
});
test('vehicle corrections retain registration formatting and validate dates and field lengths',()=>{
  const model = modelFor(vehicleReport), result = editedBarcode(model,{...model.values,RAM:'NEW123',RBD:'Corrected',RBE:'First Middle',RBI:'456 TEST ST',RBK:'NEW CITY',RBL:'NC',RBM:'12345',VAK:'FORD',VAL:'2024',VAM:'F150',VAO:'TK',RAG:'2035-12-31',RBT:'2035-12-31'});
  assert.deepEqual(result.errors,{});const f = fields(result.payload,'vehicle');
  assert.equal(f.RAM,'NEW123   ');assert.equal(f.RAG,'20351231');assert.equal(f.RBT,'20351231');assert.equal(f.RBD,'CORRECTED');assert.equal(f.VAK,'FORD');assert.equal(f.RBL,'NC');
});
test('invalid edits return labeled-field errors without returning a stale payload',()=>{
  const model = modelFor(driverReport);
  for(const [key,value] of [['DAG','X'.repeat(36)],['DAQ','1234567890'],['DAQ','123A'],['DBB','2025-02-29'],['DAJ','South Carolina'],['DAK','123'],['DAU','120'],['DAY','purple'],['DCL','unrecognized'],['DCS','BAD\nNAME'],['DAC','']]) {
    const result = editedBarcode(model,{...model.values,[key]:value});
    assert.ok(result.errors[key],`${key} should reject ${JSON.stringify(value)}`);assert.equal(result.payload,undefined);
  }
  const vehicle = modelFor(vehicleReport);
  for(const [key,value] of [['VAD','IOQ123'],['VAL','24'],['RAM','A'.repeat(10)],['RAG',''],['RBM','ABC12']]) assert.ok(editedBarcode(vehicle,{...vehicle.values,[key]:value}).errors[key]);
});
test('clearing optional suffix and dates does not invent metadata or substitute customer numbers',()=>{
  const model = modelFor(driverReport.replace('JANE MARIE','JANE MARIE JR'));
  const result = editedBarcode(model,{...model.values,DCU:'',DAQ:'',DBD:'',DBA:''});
  const f = fields(result.payload,'driver');assert.equal(f.DCU,'');assert.equal(f.DAQ,'');assert.equal(f.DBD,'unavl');assert.equal(f.DBA,'unavl');
});
test('driver parsing failures retain oversized values and current credential fields for correction',()=>{
  const raw = driverReport.replace('123 EXAMPLE ROAD','X'.repeat(50));
  assert.throws(()=>reportBarcode(raw),/35-character/);
  const draft = reportBarcodeDraft(raw,{error:'Address too long'}), model = barcodeEditorModel(draft);
  assert.equal(draft.payload,undefined);assert.equal(model.values.DAG,'X'.repeat(50));assert.equal(model.values.DBD,'2026-04-14');assert.equal(model.values.DCA,'D');assert.equal(model.values.DAU,'65');
  assert.equal(editedBarcode(model,model.values).payload,undefined);
  const fixed = editedBarcode(model,{...model.values,DAG:'123 CORRECTED ROAD'});
  assert.deepEqual(fixed.errors,{});assert.equal(fields(fixed.payload,'driver').DCF,'1234567890123456789');
});
test('draft preserves malformed dates, names, and non-ASCII data instead of failing before editing',()=>{
  const raw = driverReport.replace('EXAMPLE-SAMPLE, JANE MARIE','UNSPLIT NAME').replace('02/29/2000','02/31/2000').replace('Race: W','Race: 漢');
  const model = barcodeEditorModel(reportBarcodeDraft(raw));
  assert.equal(model.values.DCS,'UNSPLIT NAME');assert.equal(model.values.DBB,'02/31/2000');assert.equal(model.values.DCL,'漢');
  const fixed = editedBarcode(model,{...model.values,DCS:'NAME',DAC:'FIRST',DBB:'2000-02-29',DCL:'Unknown'});
  assert.deepEqual(fixed.errors,{});assert.ok(fixed.payload);
});
test('vehicle recovery isolates selected party, retains unsplit address, and permits explicit corrections',()=>{
  const raw = vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNSPLIT ADDRESS').replace('Last Transaction:','Owner Number: 9999 Owner Name: LATER, PERSON Owner Address: 456 NEXT ROAD, NEXT CITY NC 12345 Last Transaction:');
  const model = barcodeEditorModel(reportBarcodeDraft(raw));
  assert.equal(model.values.RBI,'UNSPLIT ADDRESS');assert.equal(model.values.RBK,'');assert.equal(model.values.RBD,'EXAMPLE-SAMPLE');
  const fixed = editedBarcode(model,{...model.values,RBI:'123 FIXED STREET',RBK:'FIXED CITY',RBL:'SC',RBM:'12345'});
  assert.deepEqual(fixed.errors,{});assert.doesNotMatch(fixed.payload,/LATER|NEXT/);
  const next = barcodeEditorModel(reportBarcodeDraft(raw,{partyIndex:1}));assert.equal(next.values.RBD,'LATER');
  assert.throws(()=>reportBarcodeDraft('Unrecognized document'),/No driver or vehicle/);
});
test('malformed framing is rejected rather than silently changing barcode fields',()=>{
  const data = reportBarcode(driverReport);
  for(const payload of [data.payload.replace('DL0031','DL0032'),data.payload.slice(0,-1),'UNFRAMED DATA']) assert.throws(()=>barcodeEditorModel({...data,payload}));
});


test('owner corrections support business/person changes without encoding conflicting names',()=>{
  const person = modelFor(vehicleReport);
  assert.ok(editedBarcode(person,{...person.values,BBC:'SYNTHETIC LLC'}).errors.BBC);
  const business = editedBarcode(person,{...person.values,RBD:'',RBE:'',BBC:'SYNTHETIC LLC'});
  assert.deepEqual(business.errors,{});assert.match(business.payload,/BBCSYNTHETIC LLC\nRBD\nRBE\n/);
  const original = modelFor(vehicleReport.replace('EXAMPLE-SAMPLE, JANE MARIE','SYNTHETIC LLC'));
  const converted = editedBarcode(original,{...original.values,BBC:'',RBD:'PERSON',RBE:'FIRST'});
  assert.deepEqual(converted.errors,{});assert.equal(fields(converted.payload,'vehicle').BBC,'');assert.equal(fields(converted.payload,'vehicle').RBD,'PERSON');
});


test('drafts with approved blanks remain correctable without forcing owner data to be re-entered',()=>{
  const draft=reportBarcodeDraft(vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS').replace('TEST123','TOO-LONG-PLATE'),{allowIncompleteParty:true});
  const model=barcodeEditorModel(draft);assert.equal(model.values.RBI,'');
  const corrected=editedBarcode(model,{...model.values,RAM:'NEW123'});assert.deepEqual(corrected.errors,{});
  for(const key of ['RBI','RBK','RBL','RBM'])assert.equal(fields(corrected.payload,'vehicle')[key],'');
});


test('recovery keeps driver-profile precedence when the report also mentions a VIN',()=>{
  const draft=reportBarcodeDraft(driverReport.replace('123 EXAMPLE ROAD','X'.repeat(50))+' Citation VIN: 1HGCM82633A004352');
  assert.equal(draft.kind,'driver');assert.equal(barcodeEditorModel(draft).values.DAG,'X'.repeat(50));
  assert.throws(()=>reportBarcodeDraft('Customer No: 12345678 Name: INCOMPLETE RESIDENCE'),/No driver or vehicle/);
});

test('multiracial values have a readable label, round-trip unchanged, and accept manual corrections',()=>{
  const original=reportBarcode(driverReport.replace('Race: W','Race: MLT RA'));
  const model=barcodeEditorModel(original);
  assert.equal(model.values.DCL,'Multiracial');
  assert.equal(editedBarcode(model,model.values).payload,original.payload);
  const white=modelFor(driverReport);
  for(const label of ['Multiracial','Multi racial','Multi-racial','MLT RA','MR']) {
    const result=editedBarcode(white,{...white.values,DCL:label});
    assert.deepEqual(result.errors,{});assert.equal(fields(result.payload,'driver').DCL,'MR ');
  }
});
