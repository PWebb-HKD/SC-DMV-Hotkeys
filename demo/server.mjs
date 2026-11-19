/** Loopback-only static practice portal. No proxy, live DMV connection or request logging. */
import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ALL_DEMO_CASES,DEMO_PATHS,demoCase,recordText} from './cases.mjs';
import {demoPage} from './pages.mjs';
import {syntheticPdf} from './pdf.mjs';
import {SCUTTIES_CASES} from './scutties-cases.mjs';
const extensionRoot=fileURLToPath(new URL('../extension/',import.meta.url));
const assets=new Map(['portal.js','scutties.js','scenarios.js','preview-bridge.js','report-tools.js','style.css'].map(name=>['/demo/'+name,new URL('./public/'+name,import.meta.url)]));
assets.set('/demo/scenario-data.js',new URL('./scenarios.mjs',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.wasm':'application/wasm'};
/** Wrap only this HTTP preview, keeping production extension files byte-for-byte unchanged. */
function previewHtml(source) {
  const additions='<style>.demo-preview-banner{position:sticky;top:0;z-index:50;background:#fff0bf;color:#513a00;font:700 12px/1.5 system-ui;text-align:center;padding:9px}</style><script src="/demo/preview-bridge.js"></script>';
  return source.replace('</head>',additions+'</head>').replace(/<body([^>]*)>/,'<body$1><div class="demo-preview-banner" role="note">DEMONSTRATION — SYNTHETIC DATA · Local preview of production rendering code</div>');
}
export async function startDemoServer(port=0) {
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Use a port number from 0 to 65535.');
  const server=createServer(async(req,res)=>{
    const ownPort=server.address().port,allowedHosts=new Set([`127.0.0.1:${ownPort}`,`localhost:${ownPort}`]);
    const reply=(status,type,body,extra={})=>{
      res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; object-src 'self' blob:; frame-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",...extra});
      res.end(req.method==='HEAD'?undefined:body);
    };
    // Prevent other origins from using this local service as a proxy or data endpoint.
    const allowedOrigins=new Set([...allowedHosts].map(host=>'http://'+host));
    if(!allowedHosts.has(req.headers.host)||req.headers.origin&&!allowedOrigins.has(req.headers.origin))return reply(403,'text/plain','Local demonstration access only.');
    if(!['GET','HEAD'].includes(req.method))return reply(405,'text/plain','Only static demonstration requests are supported.',{Allow:'GET, HEAD'});
    try {
      const url=new URL(req.url,`http://${req.headers.host}`),path=decodeURIComponent(url.pathname);
      if(path==='/api/cases')return reply(200,'application/json',JSON.stringify(ALL_DEMO_CASES));
      if(path==='/api/paths')return reply(200,'application/json',JSON.stringify(DEMO_PATHS));
      if(path==='/api/scutties')return reply(200,'application/json',JSON.stringify(SCUTTIES_CASES));
      if(path===DEMO_PATHS.pdf){
        const record=demoCase(url.searchParams.get('case'));
        if(!record)return reply(404,'text/plain','Unknown demonstration record.');
        if(url.searchParams.get('failure')==='unavailable')return reply(503,'text/plain','DEMONSTRATION: The report service is unavailable. Return to the search form and try again.');
        return reply(200,'application/pdf',syntheticPdf(recordText(record.id),{image:record.photo}),{'Content-Disposition':`inline; filename="DEMONSTRATION-${record.id}.pdf"`});
      }
      const page=demoPage(path);if(page)return reply(path===DEMO_PATHS.error?503:200,types['.html'],page);
      if(assets.has(path))return reply(200,types[extname(path)],await readFile(assets.get(path)));
      if(path.startsWith('/extension/')){
        const relative=path.slice('/extension/'.length);
        if(relative.split('/').some(part=>part.startsWith('.'))||!['.html','.js','.mjs','.css','.png','.bcmap','.pfb','.ttf','.wasm','.txt'].includes(extname(relative)))return reply(404,'text/plain','Not found.');
        const file=await realpath(resolve(extensionRoot,relative));
        if(!file.startsWith(extensionRoot.endsWith(sep)?extensionRoot:extensionRoot+sep))return reply(404,'text/plain','Not found.');
        const body=await readFile(file);
        if(['/extension/panel.html','/extension/barcode.html'].includes(path)){
          const selected=demoCase(url.searchParams.get('demo'));
          if(!selected||selected.recordType==='residence')return reply(400,'text/plain','Choose a plate or driver demonstration record from the practice portal.');
          return reply(200,types['.html'],previewHtml(body.toString()));
        }
        return reply(200,types[extname(file)]||'application/octet-stream',body);
      }
      return reply(404,'text/plain','Not found.');
    } catch(error){return reply(error instanceof URIError?400:404,'text/plain','Invalid or unavailable demonstration resource.');}
  });
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});
  return {server,url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((accept,reject)=>server.close(error=>error?reject(error):accept()))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.length&&!(args.length===2&&args[0]==='--port'&&/^\d+$/.test(args[1])))throw new Error('Usage: node demo/server.mjs [--port 4173]');
  const {url}=await startDemoServer(args.length?Number(args[1]):4173);
  console.log(`SC DMV Hotkeys demonstration: ${url}\nDemo User ID: demo · Password: demo\nSynthetic data only. Press Ctrl+C to stop.`);
}
