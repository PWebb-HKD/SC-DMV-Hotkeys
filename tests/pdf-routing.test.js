// The browser redirect must precede native rendering and apply only to top-level DMV attachments.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDF_URL, attachmentUrl} from '../extension/core.js';
import {pdfDarkRule, darkResultSource} from '../extension/pdf-routing.js';
const reader=`chrome-extension://${'a'.repeat(32)}/reader.html`;
test('dark routing matches only the DMV PDF endpoint and preserves the entire URL inside the fragment',()=>{
  const rule=pdfDarkRule(reader),pattern=new RegExp(rule.condition.regexFilter,'i');
  assert.deepEqual(rule.condition.resourceTypes,['main_frame']);
  for(const source of [PDF_URL,PDF_URL+'?record=1&format=2',PDF_URL.replace('ViewAttachment','viewattachment')]) {
    assert.equal(pattern.test(source),true);
    const redirected=rule.action.redirect.regexSubstitution.replace('\\0',source);
    assert.equal(darkResultSource(redirected,reader),source);assert.equal(attachmentUrl(redirected),source);
  }
  for(const source of [PDF_URL+'/other',PDF_URL.replace('https:','http:'),PDF_URL.replace('www.scdmvonline.com','www.scdmvonline.com.example.org'),'https://example.org/?url='+PDF_URL,PDF_URL.replace('ViewAttachment.aspx','DrvRec/Page2.aspx')])assert.equal(pattern.test(source),false);
  assert.equal(darkResultSource(reader+'?pdf=1#https://example.org/report.pdf',reader),null);
  assert.equal(darkResultSource(reader.replace('a'.repeat(32),'b'.repeat(32))+'?pdf=1#'+PDF_URL,reader),null);
});
