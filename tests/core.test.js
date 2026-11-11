// Pure normalization, report identifiers, URL recognition.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize, ownerNumbers, isResidenceReport, driverLicense, driverIdentity, isPdf, isPortal, isPortalErrorPage, loginSucceeded, MEMBER, ROOT} from '../extension/core.js';
test('plate and DL limits ignore whitespace and reject oversize input', () => {
  assert.equal(normalize('plate', 'ab cd 1234'), 'ABCD1234');
  assert.throws(() => normalize('plate', 'ABCDEFGHI'), /more than 8/);
  assert.equal(normalize('license', '123 456 789'), '123456789');
  assert.throws(() => normalize('license', '1234567890'), /more than 9/);
  assert.equal(normalize('plate', '  '), '');
});
test('customer identifiers preserve meaning and drop leading zeroes', () => {
  assert.equal(normalize('customer', '000 012 345 678'), '12345678');
  assert.equal(normalize('customer', '0 0 0'), '0');
  assert.throws(() => normalize('customer', '12x34'), /only numbers/);
  assert.throws(() => normalize('customer', '000123456789'), /more than 8/);
});
test('PDF owner collection deduplicates normalized IDs in document order', () => {
  const text = 'Owner Number: 00001234\nCustomer Number: 1 2 3 4\nOwner Number:\n87654321\nOwner Number: 123456789';
  assert.deepEqual(ownerNumbers(text), ['1234', '87654321']);
  assert.throws(() => ownerNumbers('No identifiers here'), /No Customer\/Owner/);
  assert.throws(() => ownerNumbers('Driver License No: 123456789 Name: TEST, PERSON Customer Number: 1234'), /driver record/);
});
test('license parser requires the complete labeled sequence and maximum length', () => {
  assert.equal(driverLicense('Driver License No: 123 456 789 Name: DOE, JANE'), '123456789');
  assert.equal(driverLicense('Driver License No: 1234567890 Name: DOE'), null);
  assert.equal(driverLicense('License: 12345'), null);
});
test('identity parser preserves multi-part surnames and validates DOB', () => {
  const prefix = 'Driver License No: 123456789 ';
  assert.deepEqual(driverIdentity(prefix + 'Name: DE LA CRUZ-SMITH, JANE\nDOB: 02/29/2000'), {lastName: 'DE LA CRUZ-SMITH', dob: '02/29/2000'});
  assert.throws(() => driverIdentity(prefix + 'Name: DOE, JANE DOB: 02/29/2001'), /invalid date/);
  assert.throws(() => driverIdentity(prefix + 'Name: DOE, JANE'), /DOB/);
  assert.throws(() => driverIdentity('Name: DOE, JANE DOB: 01/01/2000'), /driver record/);
});
test('PDF tabs never count as reusable portal tabs', () => {
  const url = 'https://www.scdmvonline.com/SCTRNS/Member/Transactions/ViewAttachment.aspx#page=1';
  assert.equal(isPdf(url), true); assert.equal(isPortal(url), false);
  assert.equal(isPortal('https://www.scdmvonline.com/SCTRNS/Member/logon.aspx'), true);
  assert.equal(isPortal('https://www.scdmvonline.com.evil.test/'), false);
});

test('SCUTTIES extracts the family name without trailing given-name suffixes', () => {
  for (const suffix of ['JR', 'SR', 'II', 'III', 'IV']) {
    assert.deepEqual(driverIdentity(`Driver License No: 123456789 Name: DE LA CRUZ-SMITH, JOHN PAUL ${suffix} DOB: 01/02/2000`), {lastName: 'DE LA CRUZ-SMITH', dob: '01/02/2000'});
  }
});

test('SCUTTIES drops suffixes attached to the surname while retaining compound surnames', () => {
  for (const suffix of ['JR', 'SR', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'jr.', 'Sr.']) {
    assert.deepEqual(driverIdentity(`Driver License No: 123456789 Name: DE LA CRUZ-SMITH ${suffix}, JOHN PAUL DOB: 01/02/2000`), {lastName: 'DE LA CRUZ-SMITH', dob: '01/02/2000'});
  }
});

test('registrant/lessee numbers are customer IDs in report order with canonical deduplication',()=>{
  const text='Owner Number: 00001111\nRegistrant/Lessee Number: 00002222\nRegistrant/Lessee Name: EXAMPLE, PERSON\nCustomer Number: 2222\nRegistrant / Lessee Number: 3 3 3 3\nRegistrant/Lessee Number: 123456789\nRegistrant/Lessee Number:\nRegistrant/Lessee Name: OTHER, PERSON\nOwner Number: 4444';
  assert.deepEqual(ownerNumbers(text),['1111','2222','3333','4444']);
  assert.deepEqual(ownerNumbers('Registrant/Lessee Number: 00001234'),['1234']);
});


test('multi-page residence reports may repeat Driver License No headers without becoming driver records',()=>{
  const report='Customers at Same Residence\nCustomer Number: 00000111 FICTIONAL, FIRST\nCustomer Number: 222 FICTIONAL, SECOND\nPage 1 of 2\fCustomers at Same Residence\nCustomer No: 999 Driver License No: 123456789\nCustomer Number: 222 FICTIONAL, SECOND\nCustomer Number: 333 FICTIONAL, THIRD';
  assert.equal(isResidenceReport(report),true);assert.deepEqual(ownerNumbers(report),['111','222','333']);
  assert.throws(()=>ownerNumbers('Driver License No: 123456789 Name: FICTIONAL, PERSON\nCustomer Number: 111\nNotes: Customers at Same Residence'),/driver record/);
});

test('the dedicated DMV error page is not a successful login redirect',()=>{
  assert.equal(isPortalErrorPage(MEMBER+'ErrorPage.aspx?source=fixture'),true);
  assert.equal(isPortalErrorPage(MEMBER+'ERRORPAGE.ASPX'),true);
  assert.equal(loginSucceeded(MEMBER+'ErrorPage.aspx'),false);
  assert.equal(loginSucceeded(MEMBER+'Disclaimer.aspx'),true);
  assert.equal(isPortalErrorPage(ROOT+'.unrelated.test/SCTRNS/Member/ErrorPage.aspx'),false);
});

test('DL and customer zero padding is removed before length checks without weakening significant-digit limits',()=>{
  for(const [kind,limit] of [['license',9],['customer',8]]) {
    const significant='123456789'.slice(0,limit);
    assert.equal(normalize(kind,'000 '+significant),significant);assert.equal(normalize(kind,'0000'),'0');
    assert.throws(()=>normalize(kind,'000'+significant+'1'),new RegExp('more than '+limit));
    assert.throws(()=>normalize(kind,'00012A'),/only numbers/);
  }
  assert.equal(normalize('plate','0ABC123'),'0ABC123');
  assert.equal(driverLicense('Driver License No: 000123456789 Name: FICTIONAL, PERSON'),'123456789');
  assert.equal(driverLicense('Driver License No: 0001234567891 Name: FICTIONAL, PERSON'),null);
});

test('C0 is a customer-only prefix and is removed before numeric and length validation',()=>{
  for(const input of ['C012345678','c00012345678',' C 0 1234 5678 '])assert.equal(normalize('customer',input),'12345678');
  assert.equal(normalize('customer','C0'),'');assert.equal(normalize('customer','C0000'),'0');assert.equal(normalize('plate','C0123456'),'C0123456');
  for(const input of ['C12345678','0C01234','C012A'])assert.throws(()=>normalize('customer',input),/only numbers/);
  assert.throws(()=>normalize('customer','C000123456789'),/more than 8/);assert.throws(()=>normalize('license','C012345678'),/only numbers/);
});

test('customer collection canonicalizes C0-prefixed numbers and keeps numeric duplicates once',()=>{assert.deepEqual(ownerNumbers('Customer Number: C0001234\nOwner Number: 0001234\nCustomer Number: C012A\nRegistrant/Lessee Number: C05678'),['1234','5678']);});
