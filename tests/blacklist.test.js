import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blacklistEntry, validateBlacklist, checkBlacklist, driverIdentifiers, BlacklistedSearchError} from '../extension/blacklist.js';
test('blacklist identifiers use DMV lengths, category-specific canonical values, and numeric DL/customer values',()=>{
  assert.deepEqual(blacklistEntry('plate',' ab c123 '),{kind:'plate',value:'ABC123'});
  assert.deepEqual(blacklistEntry('customer','00001234'),{kind:'customer',value:'1234'});
  assert.deepEqual(blacklistEntry('license','001234567'),{kind:'license',value:'1234567'});
  for(const [kind,value] of [['plate','ABCDEFGHI'],['license','1234567890'],['customer','123456789'],['customer','ABC'],['license','ABC'],['plate','<x>'],['plate',''],['other','123']])assert.throws(()=>blacklistEntry(kind,value));
  const entries=validateBlacklist([{kind:'plate',value:'ab123'},{kind:'plate',value:'AB123'},{kind:'customer',value:'00123'}]);
  assert.equal(entries.length,2);
  assert.throws(()=>checkBlacklist(entries,'plate','ab 123'),BlacklistedSearchError);
  assert.throws(()=>checkBlacklist(entries,'customer','000123'),BlacklistedSearchError);
  assert.doesNotThrow(()=>checkBlacklist(entries,'license','123'));
});
test('driver identifiers include both DL and customer number without treating them as interchangeable',()=>{
  assert.deepEqual(driverIdentifiers('Customer No: 00001234 Driver License No: 001234567 Name: EXAMPLE, PERSON'),[{kind:'license',value:'1234567'},{kind:'customer',value:'1234'}]);
  assert.deepEqual(driverIdentifiers('Customer No: 1234 Driver License No: Name: EXAMPLE, PERSON'),[{kind:'customer',value:'1234'}]);
});

test('legacy padded DL/customer entries block both input forms and deduplicate on validation',()=>{
  const entries=validateBlacklist([{kind:'license',value:'000123456789'},{kind:'license',value:'123456789'},{kind:'customer',value:'00012345678'},{kind:'customer',value:'12345678'}]);
  assert.deepEqual(entries,[{kind:'license',value:'123456789'},{kind:'customer',value:'12345678'}]);
  for(const [kind,value] of [['license','000 123456789'],['license','123456789'],['customer','00012345678'],['customer','12345678']])assert.throws(()=>checkBlacklist(entries,kind,value),BlacklistedSearchError);
});

test('C0-prefixed customer searches cannot bypass numeric blacklist entries',()=>{
  const entries=validateBlacklist([{kind:'customer',value:'C0012345678'},{kind:'customer',value:'12345678'}]);
  assert.deepEqual(entries,[{kind:'customer',value:'12345678'}]);
  for(const value of ['12345678','00012345678','C012345678','c00012345678'])assert.throws(()=>checkBlacklist(entries,'customer',value),BlacklistedSearchError);
});

test('SCUTTIES protection canonicalizes a C0-prefixed customer heading',()=>{assert.deepEqual(driverIdentifiers('Customer No: C0012345678 Driver License No: 000123456789 Name: FICTIONAL, PERSON'),[{kind:'license',value:'123456789'},{kind:'customer',value:'12345678'}]);});
