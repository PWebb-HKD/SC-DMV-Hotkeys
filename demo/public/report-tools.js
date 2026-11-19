/** Extract only a predefined local synthetic report, using the packaged production PDF.js. */
export async function extractDemoPdf(id){
  if(!/^[A-Z0-9]{1,32}$/.test(id||''))throw new Error('Choose a predefined demonstration record.');
  const {getDocument,GlobalWorkerOptions}=await import('/extension/vendor/pdf.mjs');
  GlobalWorkerOptions.workerSrc='/extension/vendor/pdf.worker.mjs';
  const response=await fetch('/SCTRNS/Member/Transactions/ViewAttachment.aspx?case='+encodeURIComponent(id));
  if(!response.ok)throw new Error('The demonstration PDF is unavailable.');
  const doc=await getDocument({data:new Uint8Array(await response.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,
    cMapUrl:'/extension/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/extension/vendor/standard_fonts/',wasmUrl:'/extension/vendor/wasm/'}).promise;
  let text='';
  try {
    if(doc.numPages>20)throw new Error('The demonstration report is too long.');
    for(let n=1;n<=doc.numPages;n++){
      const page=await doc.getPage(n);
      for(const item of (await page.getTextContent()).items)if('str' in item)text+=item.str+(item.hasEOL?'\n':' ');
      text+='\n';
    }
    if(!text.includes('DEMONSTRATION - SYNTHETIC DATA'))throw new Error('The PDF must contain the synthetic-data label.');
    return {text,pages:doc.numPages};
  } finally {await doc.destroy();}
}
