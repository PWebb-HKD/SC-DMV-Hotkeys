// Pure normalization, report identifiers, URL recognition.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize, ownerNumbers, driverLicense, driverIdentity, isPdf, isPortal} from '../extension/core.js';
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
