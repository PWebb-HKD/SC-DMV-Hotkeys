/* Local preview only. Serve this adapter solely in the mock site's HTTP views;
 * it never ships inside extension/ and cannot access an installed extension. */
(()=>{
  const plate=new URL(location.href).searchParams.get('demo');let snapshot;
  async function load() {
    if(!/^DEMO00[1-6]$/.test(plate||''))throw new Error('Choose a predefined demonstration record.');
    const {getDocument,GlobalWorkerOptions}=await import('/extension/vendor/pdf.mjs');
    GlobalWorkerOptions.workerSrc='/extension/vendor/pdf.worker.mjs';
    const response=await fetch('/SCTRNS/Member/Transactions/ViewAttachment.aspx?case='+plate);
    if(!response.ok)throw new Error('The demonstration PDF is unavailable.');
    const doc=await getDocument({data:new Uint8Array(await response.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,cMapUrl:'/extension/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/extension/vendor/standard_fonts/',wasmUrl:'/extension/vendor/wasm/'}).promise;
    let text='';
    try {for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);for(const item of (await page.getTextContent()).items)if('str' in item)text+=item.str+(item.hasEOL?'\n':' ');text+='\n';}}
    finally {await doc.destroy();}
    if(!text.includes('DEMONSTRATION - SYNTHETIC DATA'))throw new Error('The PDF must contain the synthetic-data label.');
    if(location.pathname.endsWith('/panel.html')){
      const {plateStatus}=await import('/extension/status-alerts.js');
      return {...plateStatus(text),subject:'DEMONSTRATION · Plate: '+plate};
    }
    const {reportBarcode}=await import('/extension/barcode-data.js');return reportBarcode(text);
  }
  window.chrome={runtime:{connect:()=>({postMessage(){}}),getURL:path=>new URL('/extension/'+path,location.origin).href,sendMessage:async message=>{
    if(message.type==='stop-audio')return {ok:true,value:true};
    if(message.type!=='panel-data')return {ok:false,error:'This plate-only prototype does not run customer follow-up searches.'};
    try {snapshot??=load();return {ok:true,value:await snapshot};}catch(error){return {ok:false,error:error.message};}
  }}};
})();
