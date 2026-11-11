// Render PDF417 in Chrome and independently decode it to verify scanner-readable payloads.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join, extname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dependency} from './runtime.mjs';
import {reportBarcode, reportBarcodeDraft, vehicleBarcode} from '../extension/barcode-data.js';
import {barcodeEditorModel, editedBarcode} from '../extension/barcode-editor.js';
import {driverReport, vehicleReport} from './barcode-fixtures.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    const body = await readFile(join(root, 'extension', path));
    res.writeHead(200, {'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Content-Security-Policy': "script-src 'self'; object-src 'self'"}); res.end(body);
  } catch {res.writeHead(404); res.end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const {chromium} = dependency('playwright');
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
const out = join(root, 'tests/tmp/barcodes'); await mkdir(out, {recursive: true});
try {
  for (const [kind, source] of [['driver', driverReport.replace('Race: W', 'Race: WHITE')], ['suffix', driverReport.replace('JANE MARIE', 'JANE MARIE JR')], ['blank-owner', vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS')], ['next-owner', vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNPARSEABLE ADDRESS').replace('Last Transaction: RENEWAL','Registrant/Lessee Number: 2222 Registrant/Lessee Name: NEXT, PERSON Registrant/Lessee Address: 456 NEXT ROAD, CHARLESTON SC 29401 Last Transaction: RENEWAL')], ['first-registrant', vehicleReport.replaceAll('Owner ', 'Registrant/Lessee ').replace('Last Transaction: RENEWAL', 'Owner Number: 2222 Owner Name: LATER, PERSON Owner Address: 456 OTHER ROAD, OTHER CITY SC 29202 Last Transaction: RENEWAL')], ['vehicle', vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123', '123 EXAMPLE DR ROCK HILL SC, 297321234')], ['id', driverReport.replace('DL (R) D Modify', 'ID (R) Renewal').replace('Race: W', 'Race: HISP')], ['blank-number', driverReport.replace('Driver License No: 123456789', 'Driver License No:')], ['edited-driver',driverReport], ['edited-vehicle',vehicleReport], ['draft-driver',driverReport.replace('123 EXAMPLE ROAD','X'.repeat(50))], ['draft-vehicle',vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123','UNSPLIT ADDRESS')]]) {
    const data = kind.startsWith('draft-') ? reportBarcodeDraft(source,{error:'Needs correction'}) : kind === 'blank-owner' ? vehicleBarcode(source,{allowIncompleteParty:true}) : kind === 'next-owner' ? vehicleBarcode(source,{partyIndex:1}) : reportBarcode(source), page = await browser.newPage({viewport: {width: 1020, height: 800}});
    await page.addInitScript(data => {
      window.closedByUser = false; window.close = () => {window.closedByUser = true;};
      window.chrome = {runtime: {connect: () => ({postMessage() {}}), sendMessage: async () => ({ok: true, value: data})}};
    }, data);
    await page.goto(`http://127.0.0.1:${server.address().port}/barcode.html?id=fixture`);
    await page.locator('#editor:not([hidden])').waitFor();
    const model = barcodeEditorModel(data);
    assert.equal(await page.locator('#fields input:not([readonly])').count(),0);
    assert.equal(await page.getByLabel('Last Name',{exact:true}).inputValue(),model.values[model.kind==='driver'?'DCS':'RBD']);
    assert.equal(await page.locator('#fields input').count(),model.descriptors.length);
    let expected = data.payload;
    if(kind.startsWith('edited-') || kind.startsWith('draft-')) {
      if(kind.startsWith('draft-')) assert.equal(await page.locator('#scanArea').isVisible(),false);
      await page.getByRole('button',{name:'Edit Data',exact:true}).click();
      assert.equal(await page.locator('#fields input[readonly]').count(),0);
      const corrections = model.kind==='driver' ? {DCS:'CORRECTED',DAC:'ALEX',DCU:'JR',DAG:'456 CORRECTED LANE',DBB:'2000-02-28',DAK:'12345-6789'} : {RBD:'CORRECTED',RBE:'FIRST MIDDLE',RBI:'123 CORRECTED ROAD',RBK:'NEW CITY',RBL:'SC',RBM:'12345',RAM:'NEW123',VAL:'2024',RAG:'2035-12-31'};
      const streetKey = model.kind==='driver'?'DAG':'RBI';
      await page.locator('#field-'+streetKey).fill('X'.repeat(36));
      assert.equal(await page.locator('#scanArea').isVisible(),false);
      assert.equal(await page.locator('#field-'+streetKey).getAttribute('aria-invalid'),'true');
      await page.locator('#scale').selectOption('4');
      assert.equal(await page.locator('#scanArea').isVisible(),false);
      for(const [key,value] of Object.entries(corrections)) await page.locator('#field-'+key).fill(value);
      expected = editedBarcode(model,{...model.values,...corrections}).payload;
      assert.ok(expected);
      await page.getByRole('button',{name:'Lock Data',exact:true}).click();
      assert.equal(await page.locator('#fields input:not([readonly])').count(),0);
    }
    await page.waitForFunction(() => !document.querySelector('#scanArea').hidden && document.querySelector('#barcode').width > 400);
    assert.equal(await page.locator('#error').textContent(), '');
    assert.equal(await page.locator('#scanArea').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    assert.equal(await page.locator('#scanArea').evaluate(el => getComputedStyle(el).paddingTop), '32px');
    await page.screenshot({path: join(out, `${kind}-popup.png`), fullPage: true});
    for (const scale of ['2', '3', '4']) {
      await page.locator('#scale').selectOption(scale);
      const image = await page.locator('#barcode').evaluate(canvas => canvas.toDataURL('image/png').split(',')[1]);
      await writeFile(join(out, `${kind}-${scale}.png`), Buffer.from(image, 'base64'));
    }
    await writeFile(join(out, `${kind}.txt`), expected, 'ascii');
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.closedByUser), true);
    await page.close();
  }
  // Select an explicit Python override or the platform command, never a developer-specific path.
  const python = process.env.PYTHON || process.env.CODEX_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const decode = spawnSync(python, ['-c', `import sys,pathlib
sys.path.insert(0,'tests/tmp/python')
import zxingcpp
from PIL import Image
root=pathlib.Path('tests/tmp/barcodes')
for kind in ['driver','suffix','blank-owner','next-owner','first-registrant','vehicle','id','blank-number','edited-driver','edited-vehicle','draft-driver','draft-vehicle']:
 expected=(root/(kind+'.txt')).read_bytes()
 for scale in [2,3,4]:
  codes=zxingcpp.read_barcodes(Image.open(root/f'{kind}-{scale}.png'),formats=zxingcpp.BarcodeFormat.PDF417)
  assert len(codes)==1 and codes[0].bytes==expected, (kind,scale,'barcode bytes differ')
  print('PASS exact PDF417 decode:',kind,'scale',scale)
`], {cwd: root, encoding: 'utf8', windowsHide: true});
  assert.equal(decode.status, 0, decode.stderr || decode.stdout); console.log(decode.stdout.trim());
  console.log('PASS read-only labeled fields, edit/lock controls, invalid-edit hiding, recovery from parsing errors, live updates, white padding, size changes, and Escape dismissal.');
} finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
