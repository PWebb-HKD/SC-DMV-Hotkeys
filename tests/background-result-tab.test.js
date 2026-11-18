import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reusableBackgroundResult} from '../extension/background-search.js';
import {PDF_URL} from '../extension/core.js';
const reader='chrome-extension://'+'a'.repeat(32)+'/reader.html';
const query=`${reader}?pdf=1&query=1&id=12345678-1234-1234-1234-123456789abc&dark=0#${PDF_URL}`;
const tab=(id,more={})=>({id,windowId:1,url:query,active:false,...more});
const tracked={pdfCreated:{1:10,2:20,3:30},pdfSources:{1:PDF_URL,2:PDF_URL,3:PDF_URL}};
test('adopts the newest previously tracked query viewer, including viewers from the previous patch',()=>{
  assert.equal(reusableBackgroundResult([tab(1,{active:true}),tab(2)],1,reader,tracked,1).id,2);
  assert.equal(reusableBackgroundResult([tab(1),tab(2,{windowId:2})],1,reader,tracked).id,1);
  const tied={...tracked,pdfCreated:{1:20,2:20}};
  assert.equal(reusableBackgroundResult([tab(1),tab(2)],1,reader,tied,1).id,1);
});
test('never replaces navigated, moving, untracked, native print or other-extension pages',()=>{
  const excluded=[tab(1,{url:'https://example.test/'}),tab(2,{pendingUrl:'https://example.test/'}),tab(3,{windowId:2}),
    tab(4),tab(1,{url:query.replace('query=1','query=0')}),tab(1,{url:query.replace('a'.repeat(32),'b'.repeat(32))}),
    tab(1,{url:'blob:'+reader+'/native-print'}),tab(1,{url:query.replace('12345678-1234-1234-1234-123456789abc','expired')}),tab(1,{url:PDF_URL})];
  assert.equal(reusableBackgroundResult(excluded,1,reader,tracked),undefined);
  assert.equal(reusableBackgroundResult([tab(1)],1,reader,{...tracked,pdfSources:{1:PDF_URL+'?other=1'}}),undefined);
  assert.equal(reusableBackgroundResult([],1,reader,tracked),undefined);
});
