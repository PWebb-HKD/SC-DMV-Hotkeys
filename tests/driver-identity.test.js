import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driverName,safeDriverIdentity} from '../extension/driver-identity.js';
test('driver name comes from the first report header and is bounded without interpreting text',()=>{
 assert.equal(driverName('Driver License No: Name: SYNTHETIC, DRIVER Address: EXAMPLE'), 'SYNTHETIC, DRIVER');
 assert.equal(driverName('Driver License No: 123 Name: <b>EXAMPLE</b> DOB: 01/01/2000'),'<b>EXAMPLE</b>');
 assert.equal(driverName('Driver License No: 123 Name: EXAMPLE License Information Current'),'EXAMPLE');
 assert.equal(driverName('Driver License No: 123 License Information VIOL: Example Court Name: OTHER Address: ROAD'),'');
 assert.equal(driverName('Owner Name: COMPANY Address: ROAD'),'');
 assert.equal(driverName('Driver License No: 123 Name: '+ 'X'.repeat(151)+' Address: EXAMPLE'),'');
});
test('identity accepts only bounded inline PNGs and placeholder flags suppress image display',()=>{
 assert.deepEqual(safeDriverIdentity({name:'EXAMPLE',photo:'data:image/png;base64,AAAA'}),{name:'EXAMPLE',photo:'data:image/png;base64,AAAA'});
 for(const photo of ['https://example.invalid/photo','javascript:alert(1)','data:image/svg+xml;base64,AAAA','data:image/png;base64,'+'A'.repeat(700000)])assert.equal(safeDriverIdentity({name:'EXAMPLE',photo}).photo,'');
 assert.deepEqual(safeDriverIdentity({name:'EXAMPLE',photo:'data:image/png;base64,AAAA',noPhoto:true}),{name:'EXAMPLE',photo:'',noPhoto:true});
 assert.equal(safeDriverIdentity({}),undefined);
});
