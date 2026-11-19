/** Build the self-contained synthetic portal. Inputs are fresh demo source and invented records only. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {ALL_DEMO_CASES,DEMO_PATHS,recordText} from '../demo/cases.mjs';
import {SCUTTIES_CASES} from '../demo/scutties-cases.mjs';
import {demoPage} from '../demo/pages.mjs';
import {syntheticPdf} from '../demo/pdf.mjs';
const root=new URL('../extension/demo/',import.meta.url),check=process.argv.includes('--check'),inventory=[];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function emit(path,value){
  const bytes=Buffer.from(value),url=new URL(path,root);inventory.push({path,bytes:bytes.length,sha256:digest(bytes)});
  if(check){if(!(await readFile(url)).equals(bytes))throw new Error('Rebuild packaged demo: '+path);}
  else{await mkdir(dirname(fileURLToPath(url)),{recursive:true});await writeFile(url,bytes);}
}
const pathFor=path=>path==='/'?'index.html':path.replace(/^\//,'').replace(/\.aspx$/i,'.html');
const relativePaths=Object.fromEntries(Object.entries(DEMO_PATHS).map(([key,value])=>[key,key==='pdf'?'reports/':pathFor(value)]));
const mapped=path=>'/demo/'+pathFor(path);
for(const path of ['/',...Object.values(DEMO_PATHS).filter(p=>p!==DEMO_PATHS.pdf)]){
  let html=demoPage(path).replace('data-demo-page=', 'data-demo-packaged="true" data-demo-page=');
  for(const original of Object.values(DEMO_PATHS).sort((a,b)=>b.length-a.length))html=html.split(original).join(mapped(original));
  html=html.replaceAll('href="/"','href="/demo/index.html"').replaceAll('/demo/style.css','/demo/public/style.css').replaceAll('/demo/portal.js','/demo/public/portal.js');
  html=html.replace('Local preview','Packaged preview').replace('Previews extract the PDF with the bundled PDF.js and use the existing extension parsing and rendering code.','Use the extension toolbar or assigned hotkeys for automatic status alerts, barcode generation and follow-up searches.');
  html=html.replace('These local views simulate worker messages. Installed-extension permissions, global hotkeys and native background-window behavior are not demonstrated.','This practice portal is packaged with the extension. Use its normal commands and settings to exercise the shared workflows with fictional data.');
  html=html.replace('Demo-only preference, off by default. Avery has a synthetic portrait; Drew and Remy have a no-photo placeholder that should be hidden in the alert.','Enable Show driver photo and name in the extension Settings to test photos and placeholder suppression.');
  html=html.replace('Installed-extension integration is planned separately.','Use the extension’s normal commands in Demo Mode to practice these workflows.');
  html=html.replace("Fictional records only. Demo state stays in this tab's session; production extension storage is not used.","Fictional records only. Site selections stay in this tab; extension demo workflows use separate demo state. Live credentials are not used.");
  html=html.replace('</body>','<script type="module" src="/demo/bridge.js"></script></body>');
  await emit(pathFor(path),html);
}
const catalog=`// Generated synthetic catalogs; no private records or Node runtime dependency.\nexport const records=${JSON.stringify(ALL_DEMO_CASES)};\nexport const citations=${JSON.stringify(SCUTTIES_CASES)};\nconst root=new URL('./',import.meta.url);\nexport const paths=Object.fromEntries(Object.entries(${JSON.stringify(relativePaths)}).map(([key,value])=>[key,new URL(value,root).href]));\n`;
await emit('catalog.mjs',catalog);
await emit('report-ids.js','// Generated allowlist of packaged synthetic reports.\nexport const DEMO_REPORT_IDS='+JSON.stringify([...ALL_DEMO_CASES.map(r=>r.id),'UNAVAILABLE'])+';\n');
for(const name of ['portal.js','scutties.js','scenarios.js','data-source.js','report-tools.js','style.css']){
  let source=await readFile(new URL('../demo/public/'+name,import.meta.url),'utf8');source=source.replaceAll("from '/extension/core.js'","from '../../core.js'");await emit('public/'+name,source);
}
await emit('public/scenario-data.js',await readFile(new URL('../demo/scenarios.mjs',import.meta.url)));
for(const record of ALL_DEMO_CASES)await emit('reports/'+record.id+'.pdf',syntheticPdf(recordText(record.id),{image:record.photo}));
await emit('reports/UNAVAILABLE.pdf','%PDF-1.4\n% DEMONSTRATION - SYNTHETIC DATA\n% Deliberately incomplete PDF for the unavailable-report scenario.\n');
const manifest=JSON.stringify({format:1,generatedFrom:'demo/',files:inventory},null,2)+'\n';
if(check){if(await readFile(new URL('build-manifest.json',root),'utf8')!==manifest)throw new Error('Rebuild demo manifest.');}
else await writeFile(new URL('build-manifest.json',root),manifest);
console.log(`Packaged demo ${check?'verified':'built'}: ${inventory.length} files.`);
