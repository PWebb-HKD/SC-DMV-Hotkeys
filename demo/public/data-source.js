/** The packaged practice site reads only bundled catalogs/PDFs; the development server keeps its HTTP endpoints. */
export const packaged=document.body.dataset.demoPackaged==='true';
const root=new URL('../',import.meta.url).href;
export async function demoData(kind){
  if(packaged){const data=await import('../catalog.mjs');return kind==='cases'?data.records:kind==='scutties'?data.citations:data.paths;}
  const response=await fetch('/api/'+kind);if(!response.ok)throw new Error('Demo catalog unavailable.');return response.json();
}
export const extensionUrl=path=>packaged?new URL('../../'+path,import.meta.url).href:'/extension/'+path;
export function reportUrl(id,failure=false){return packaged?root+'reports/'+(failure?'UNAVAILABLE':id)+'.pdf':'/SCTRNS/Member/Transactions/ViewAttachment.aspx?case='+encodeURIComponent(id)+(failure?'&failure=unavailable':'');}
