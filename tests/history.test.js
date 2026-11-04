// Validate replayable saved queries without trusting arbitrary popup values.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COMMANDS, historySearch} from '../extension/core.js';
test('selected-customer command is removed',()=>{
  assert.equal(COMMANDS.selected,undefined);
});
test('history replay preserves query type and normalizes its stored number',()=>{
  assert.deepEqual(historySearch({kind:'plate',value:'abc 123'}),{kind:'plate',value:'ABC123'});
  assert.deepEqual(historySearch({kind:'license',value:'123456789'}),{kind:'license',value:'123456789'});
  assert.deepEqual(historySearch({kind:'customer',value:'00001234'}),{kind:'customer',value:'1234'});
  assert.deepEqual(historySearch({kind:'address',value:'987654321'}),{kind:'address',value:'987654321'});
});
test('SCUTTIES history supports saved identities and older display-only entries',()=>{
  const identity={lastName:'DE LA CRUZ-SMITH',dob:'02/29/2000'};
  assert.deepEqual(historySearch({kind:'scutties',identity}),{kind:'scutties',identity});
  assert.deepEqual(historySearch({kind:'scutties',value:'DE LA CRUZ-SMITH · 02/29/2000'}),{kind:'scutties',identity});
  assert.throws(()=>historySearch({kind:'scutties',value:'DOE · 02/29/2001'}),/invalid date/);
  assert.throws(()=>historySearch({kind:'scutties',value:'DOE'}),/missing/);
});
test('malformed or unsupported history cannot start a query',()=>{
  assert.throws(()=>historySearch({kind:'selected',value:'1234'}),/cannot be rerun/);
  assert.throws(()=>historySearch({kind:'plate',value:''}),/no search number/);
  assert.throws(()=>historySearch({kind:'customer',value:'ABC'}),/only numbers/);
});
