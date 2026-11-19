/** Extract only a predefined local synthetic report, using the packaged production PDF.js. */
import {extensionUrl,reportUrl} from './data-source.js';
export async function extractDemoPdf(id,{includeIdentity=false,reportFailure=false}={}){
  if(!/^[A-Z0-9]{1,32}$/.test(id||''))throw new Error('Choose a predefined demonstration record.');
  const {getDocument,GlobalWorkerOptions}=await import(extensionUrl('vendor/pdf.mjs'));
  GlobalWorkerOptions.workerSrc=extensionUrl('vendor/pdf.worker.mjs');
  const response=await fetch(reportUrl(id,reportFailure));
  if(!response.ok)throw new Error('The demonstration PDF is unavailable.');
  const doc=await getDocument({data:new Uint8Array(await response.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,
    cMapUrl:extensionUrl('vendor/cmaps/'),cMapPacked:true,standardFontDataUrl:extensionUrl('vendor/standard_fonts/'),wasmUrl:extensionUrl('vendor/wasm/')}).promise;
  let text='',driverIdentity;
  try {
    if(doc.numPages>20)throw new Error('The demonstration report is too long.');
    for(let n=1;n<=doc.numPages;n++){
      const page=await doc.getPage(n);
      for(const item of (await page.getTextContent()).items)if('str' in item)text+=item.str+(item.hasEOL?'\n':' ');
      text+='\n';
      if(n===1&&includeIdentity){const {extractDriverIdentity}=await import(extensionUrl('driver-photo.js'));driverIdentity=await extractDriverIdentity(page,text);}
    }
    if(!text.includes('DEMONSTRATION - SYNTHETIC DATA'))throw new Error('The PDF must contain the synthetic-data label.');
    return {text,pages:doc.numPages,...(driverIdentity?{driverIdentity}:{})};
  } finally {await doc.destroy();}
}
