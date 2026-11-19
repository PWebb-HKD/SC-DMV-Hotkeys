/** Fresh extracted runtime, real browser/PDF.js and explicit Chrome API substitutes. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildWebstore} from '../tools/build-webstore.mjs';
import {demoExtension} from './helpers/demo-extension.mjs';
const output=fileURLToPath(new URL('../output/reviewer/',import.meta.url)),temporary=await mkdtemp(join(tmpdir(),'scdmv-fresh-'));
const archive=await buildWebstore({output});
execFileSync('python3',['-c',`import sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 z.extractall(sys.argv[2])`,archive.path,temporary]);
const f=await demoExtension({runtimeRoot:temporary,fresh:true}),frames=[];
await mkdir(join(output,'walkthrough-frames'),{recursive:true});
const wait=async fn=>{const end=Date.now()+25000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,30));}throw new Error('Fresh package check timed out: '+f.session['demo:status']);};
const capture=async(page,caption)=>{const path=join(output,'walkthrough-frames',`${frames.length}.png`);await page.screenshot({path});frames.push({path,caption});};
const run=async(command,value)=>{
  const previous=f.session['demo:history']?.[0]?.id;await f.send({type:'run',command});const input=await wait(()=>f.panel('input'));
  await input.page.locator('#value').fill(value);await input.page.locator('#submit').click();
  await wait(()=>f.session['demo:history']?.[0]?.id!==previous);const alert=await wait(()=>f.panel('record-alert'));
  await alert.page.locator('h2.record-status-title').waitFor();return alert;
};
const report=()=>wait(()=>[...f.pages.values()].findLast(r=>r.tab.url.includes('reader.html')&&f.session['demo:pdf:'+r.tab.id]?.text));
try{
  assert.equal(f.local.vault,undefined);assert.equal((await f.state()).demoMode,false);
  await f.page.locator('#settingsTab').click();await f.page.locator('#demoModeToggle').click();
  await f.page.locator('#demoBanner').waitFor();await f.send({type:'alerts',enabled:true});await f.send({type:'driver-identity-settings',enabled:true});
  await f.send({type:'pdf-display-settings',enabled:false});await capture(f.page,'Enable the bundled Demo Mode. No server, extra host grant or live account.');
  await f.send({type:'reviewer-guide'});const guide=await wait(()=>[...f.pages.values()].find(r=>r.tab.url.endsWith('reviewer-guide.html')));
  await guide.page.locator('h1').waitFor();await capture(guide.page,'The packaged guide lists fictional searches and expected outcomes.');
  let status=await run('license','100000101');await status.page.locator('.record-driver-photo').waitFor();
  await capture(status.page,'Normal DL search: valid license, fictional name and synthetic portrait.');
  let pdf=await report();await pdf.page.waitForFunction(()=>document.body.dataset.pdfView==='ready');
  assert.equal(await pdf.page.locator('body').getAttribute('data-pdf-colors'),'light');await pdf.page.locator('.pdf-sheet canvas[data-ready=true]').first().waitFor();
  assert.equal(await pdf.page.locator('#pdfPrint').isEnabled(),true);await capture(pdf.page,'Dark mode off still uses the bundled viewer, with light colors and Print.');
  await pdf.page.locator('#pdfColors').click();assert.equal(await pdf.page.locator('body').getAttribute('data-pdf-colors'),'dark');await pdf.page.locator('.pdf-sheet canvas[data-ready=true]').first().waitFor();
  await capture(pdf.page,'The same viewer changes colors without loading a different report.');
  status=await run('license','100000111');await status.page.locator('.record-suspension-details summary').first().click();
  await status.page.locator('.record-suspension-details[open]').waitFor();await capture(status.page,'Suspensions: active and pending totals, grouped reasons and expandable dates.');
  status=await run('plate','DEMO005');assert.equal(await status.page.locator('.record-owner-search').count(),2);
  await capture(status.page,'Vehicle results list both owners. Each name starts its saved customer search.');
  await status.page.locator('.record-owner-search').nth(1).click();await wait(()=>f.session['demo:history']?.[0]?.value==='10000002');await wait(()=>f.panel('record-alert'));
  await run('license','100000101');pdf=await report();await f.activate(pdf.tab);await f.send({type:'run',command:'scutties'});
  const scutties=await wait(()=>[...f.pages.values()].find(r=>r.tab.url.endsWith('/SCUTTIES/Search.html')));
  await scutties.page.locator('#scutties-rows tr').nth(2).waitFor();await capture(scutties.page,'SCUTTIES uses the ordinary Search action and fictional citation results.');
  await scutties.page.locator('#scutties-rows button').first().click();await scutties.page.locator('#display:not([hidden])').waitFor();
  await capture(scutties.page,'View opens occurrence-specific, read-only synthetic citation details.');
  await f.activate(pdf.tab);await f.send({type:'run',command:'barcode'});
  const barcode=await wait(()=>[...f.pages.values()].find(r=>r.tab.url.includes('barcode.html')));await barcode.page.locator('#scanArea').waitFor();
  await capture(barcode.page,'Barcode uses the selected report and is labeled as synthetic data.');
  assert.equal(f.local.vault,undefined);assert.deepEqual(f.errors,[]);assert.ok(f.requests.filter(u=>/^https?:/.test(u)).every(u=>u.startsWith(f.base)));
  console.log('Fresh extracted ZIP: defaults, guide, normal driver/vehicle/owner/SCUTTIES/barcode flows, light/dark custom viewer and local-only requests passed (Chrome APIs simulated).');
  if(process.argv.includes('--video')){
    // Compose actual UI captures with readable captions. This is deliberately labeled, not native-install evidence.
    const page=await f.context.newPage();await page.setViewportSize({width:1280,height:900});
    const videoFrames=join(output,'walkthrough-video');await mkdir(videoFrames,{recursive:true});
    for(let i=0;i<frames.length;i++){
      const {path,caption}=frames[i],data=(await readFile(path)).toString('base64');
      await page.setContent('<style>body{margin:0;background:#122435;color:white;font:22px Arial}header{height:80px;box-sizing:border-box;padding:18px 30px;font-size:18px;color:#dce9f5}img{display:block;width:100%;height:700px;object-fit:contain}footer{padding:20px 30px}</style><header>AUTOMATED SYNTHETIC UI WALKTHROUGH · Chrome APIs simulated · Not a native installation test</header><img alt="Fictional extension demonstration"><footer></footer>');
      await page.locator('img').evaluate((el,src)=>el.src=src,'data:image/png;base64,'+data);await page.locator('footer').evaluate((el,text)=>el.textContent=text,caption);
      await page.locator('img').evaluate(el=>el.decode());await page.screenshot({path:join(videoFrames,`${String(i).padStart(2,'0')}.png`)});
    }
    execFileSync('ffmpeg',['-y','-framerate','1/6','-i',join(videoFrames,'%02d.png'),'-c:v','libx264','-r','24','-pix_fmt','yuv420p','-movflags','+faststart',join(output,'SC-DMV-Hotkeys-1.8.43-demo-walkthrough.mp4')],{stdio:'pipe'});
    await writeFile(join(output,'walkthrough-captions.txt'),frames.map((frame,i)=>`${i*6}s: ${frame.caption}`).join('\n')+'\n');
    console.log('Created 60-second captioned synthetic UI walkthrough.');
  }
}finally{await f.close();await rm(temporary,{recursive:true,force:true});}
