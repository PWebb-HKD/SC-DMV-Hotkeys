/** Check actual PDF glyph positions and parser output, not just the layout generator's commands. */
import assert from 'node:assert/strict';
import {dependency} from './runtime.mjs';
import {startDemoServer} from '../demo/server.mjs';
import {ALL_DEMO_CASES,recordText} from '../demo/cases.mjs';
import {reportBarcode} from '../extension/barcode-data.js';
import {licenseStatus,plateStatus} from '../extension/status-alerts.js';
import {ownerNumbers} from '../extension/core.js';
const {chromium}=dependency('playwright'),site=await startDemoServer();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true});
try{
  const page=await browser.newPage();await page.goto(site.url);
  for(const record of ALL_DEMO_CASES){
    const result=await page.evaluate(async id=>{
      const {getDocument,GlobalWorkerOptions}=await import('/extension/vendor/pdf.mjs');GlobalWorkerOptions.workerSrc='/extension/vendor/pdf.worker.mjs';
      const bytes=await(await fetch('/SCTRNS/Member/Transactions/ViewAttachment.aspx?case='+id)).arrayBuffer();
      const doc=await getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,standardFontDataUrl:'/extension/vendor/standard_fonts/'}).promise;
      const pages=[];
      try{for(let n=1;n<=doc.numPages;n++){const content=await(await doc.getPage(n)).getTextContent();pages.push(content.items.filter(item=>'str' in item).map(item=>({text:item.str,x:item.transform[4],y:item.transform[5],width:item.width})));}}
      finally{await doc.destroy();}
      const extracted=await(await import('/demo/report-tools.js')).extractDemoPdf(id);return {pages,text:extracted.text};
    },record.id);
    for(const [index,items] of result.pages.entries()){
      for(const item of items.filter(item=>item.text.trim())){
        assert.ok(item.x>=39&&item.x+item.width<=574,`${record.id} page ${index+1}: horizontal overflow for ${item.text}`);
        assert.ok(item.y>=32&&item.y<=753,`${record.id} page ${index+1}: text overlaps page edge`);
      }
      const text=items.map(item=>item.text).join(' ').replace(/\s+/g,' ');assert.match(text,/DEMONSTRATION - SYNTHETIC DATA/);assert.match(text,/NOT A GOVERNMENT RECORD/);
      assert.equal((text.match(/\b(?:SUSP|REVO):/g)||[]).length,(text.match(/\b(?:Suspension|Revocation) Beg:/g)||[]).length,'An offense must stay on the page with its dates');
    }
    if(record.recordType==='plate'){
      assert.deepEqual(plateStatus(result.text),plateStatus(recordText(record.id)));
      const first=result.pages[0],vin=first.find(item=>item.text.trim()==='VIN:'),year=first.find(item=>item.text.trim()==='Year:');
      assert.ok(vin&&year&&year.x-vin.x>200&&vin.y===year.y,'Vehicle fields must occupy aligned columns');
    }else if(record.recordType==='license')assert.deepEqual(licenseStatus(result.text),licenseStatus(recordText(record.id)));
    else assert.deepEqual(ownerNumbers(result.text),ownerNumbers(recordText(record.id)));
    if(record.recordType!=='residence')assert.deepEqual(reportBarcode(result.text),reportBarcode(recordText(record.id)));
    console.log('PASS '+record.id+' formatted PDF fits its pages and retains exact status/barcode/customer parsing');
  }
  console.log(`${ALL_DEMO_CASES.length} formatted PDF layout/parser checks passed.`);
}finally{await browser.close();await site.close();}
