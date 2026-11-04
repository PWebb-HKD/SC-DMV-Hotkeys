import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blacklistEntry, validateBlacklist, checkBlacklist, driverIdentifiers, BlacklistedSearchError} from '../extension/blacklist.js';
test('blacklist identifiers use DMV lengths, category-specific canonical values, and numeric DL/customer values',()=>{
  assert.deepEqual(blacklistEntry('plate',' ab c123 '),{kind:'plate',value:'ABC123'});
  assert.deepEqual(blacklistEntry('customer','00001234'),{kind:'customer',value:'1234'});
  assert.deepEqual(blacklistEntry('license','001234567'),{kind:'license',value:'001234567'});
  for(const [kind,value] of [['plate','ABCDEFGHI'],['license','1234567890'],['customer','123456789'],['customer','ABC'],['license','ABC'],['plate','<x>'],['plate',''],['other','123']])assert.throws(()=>blacklistEntry(kind,value));
  const entries=validateBlacklist([{kind:'plate',value:'ab123'},{kind:'plate',value:'AB123'},{kind:'customer',value:'00123'}]);
  assert.equal(entries.length,2);
  assert.throws(()=>checkBlacklist(entries,'plate','ab 123'),BlacklistedSearchError);
  assert.throws(()=>checkBlacklist(entries,'customer','000123'),BlacklistedSearchError);
  assert.doesNotThrow(()=>checkBlacklist(entries,'license','123'));
});
test('driver identifiers include both DL and customer number without treating them as interchangeable',()=>{
  assert.deepEqual(driverIdentifiers('Customer No: 00001234 Driver License No: 001234567 Name: EXAMPLE, PERSON'),[{kind:'license',value:'001234567'},{kind:'customer',value:'1234'}]);
  assert.deepEqual(driverIdentifiers('Customer No: 1234 Driver License No: Name: EXAMPLE, PERSON'),[{kind:'customer',value:'1234'}]);
});
