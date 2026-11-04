// Render PDF417 in Chrome and independently decode it to verify scanner-readable payloads.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join, extname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dependency} from './runtime.mjs';
import {reportBarcode} from '../extension/barcode-data.js';
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
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
const out = join(root, 'tests/tmp/barcodes'); await mkdir(out, {recursive: true});
try {
  for (const [kind, source] of [['driver', driverReport.replace('Race: W', 'Race: WHITE')], ['vehicle', vehicleReport.replace('123 EXAMPLE ROAD, COLUMBIA SC 292010123', '123 EXAMPLE DR ROCK HILL SC, 297321234')], ['id', driverReport.replace('DL (R) D Modify', 'ID (R) Renewal').replace('Race: W', 'Race: HISP')], ['blank-number', driverReport.replace('Driver License No: 123456789', 'Driver License No:')]]) {
    const data = reportBarcode(source), page = await browser.newPage({viewport: {width: 1020, height: 800}});
    await page.addInitScript(data => {
      window.closedByUser = false; window.close = () => {window.closedByUser = true;};
      window.chrome = {runtime: {connect: () => ({postMessage() {}}), sendMessage: async () => ({ok: true, value: data})}};
    }, data);
    await page.goto(`http://127.0.0.1:${server.address().port}/barcode.html?id=fixture`);
    await page.waitForFunction(() => document.querySelector('#barcode').width > 400);
    assert.equal(await page.locator('#error').textContent(), '');
    assert.equal(await page.locator('#scanArea').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    assert.equal(await page.locator('#scanArea').evaluate(el => getComputedStyle(el).paddingTop), '32px');
    await page.screenshot({path: join(out, `${kind}-popup.png`), fullPage: true});
    for (const scale of ['2', '3', '4']) {
      await page.locator('#scale').selectOption(scale);
      const image = await page.locator('#barcode').evaluate(canvas => canvas.toDataURL('image/png').split(',')[1]);
      await writeFile(join(out, `${kind}-${scale}.png`), Buffer.from(image, 'base64'));
    }
    await writeFile(join(out, `${kind}.txt`), data.payload, 'ascii');
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.closedByUser), true);
    await page.close();
  }
  const python = process.env.CODEX_PYTHON || 'C:/Users/prest/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
  const decode = spawnSync(python, ['-c', `import sys,pathlib
sys.path.insert(0,'tests/tmp/python')
import zxingcpp
from PIL import Image
root=pathlib.Path('tests/tmp/barcodes')
for kind in ['driver','vehicle','id','blank-number']:
 expected=(root/(kind+'.txt')).read_bytes()
 for scale in [2,3,4]:
  codes=zxingcpp.read_barcodes(Image.open(root/f'{kind}-{scale}.png'),formats=zxingcpp.BarcodeFormat.PDF417)
  assert len(codes)==1 and codes[0].bytes==expected, (kind,scale,'barcode bytes differ')
  print('PASS exact PDF417 decode:',kind,'scale',scale)
`], {cwd: root, encoding: 'utf8', windowsHide: true});
  assert.equal(decode.status, 0, decode.stderr || decode.stdout); console.log(decode.stdout.trim());
  console.log('PASS white padding, local CSP-safe rendering, size changes, and Escape dismissal.');
} finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
