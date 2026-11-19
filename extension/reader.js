/**
 * Results viewer or temporary extraction tab that reads PDF text with bundled PDF.js. It receives a
 * single authorized job from the worker and returns text/errors by job ID. Reading
 * PDF bytes avoids depending on the browser viewer DOM; this is not an OCR engine.
 */
import {extractDriverIdentity} from './driver-photo.js';
import {installNativePrint} from './pdf-print.js';
import {openDarkViewer} from './pdf-dark-view.js';
import {getDocument, GlobalWorkerOptions} from './vendor/pdf.mjs';
import {markDemo} from './demo-label.js';
GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.mjs');
const params = new URL(location.href).searchParams;
let id = params.get('id'), loadingTask, resultSent = false;
// Cancellation covers both the job handshake and PDF loading; a late job ID may already be cancelled.
const controller = new AbortController(), cancelledIds = new Set();
const printReady=Promise.withResolvers();printReady.promise.catch(()=>{});
if(params.get('dark')==='1'||params.get('query')==='1')installNativePrint(printReady.promise,controller.signal);
chrome.runtime.onMessage.addListener(message => {
  if(message.target !== 'pdf-reader' || message.type !== 'reader-cancel')return;
  if(!id)cancelledIds.add(message.id);
  if(message.id===id){controller.abort();loadingTask?.destroy();}
});
// A live port with heartbeat messages keeps the pending worker job reachable.
const port = chrome.runtime.connect({name: 'panel'});
const heartbeat = setInterval(() => { try { port.postMessage({type: 'heartbeat'}); } catch {} }, 15000);
/** Viewer failures are local once parsing has completed; never reuse an expired reader job. */
function showError(message) {
  document.getElementById('reading').hidden=false;
  document.getElementById('readingNote').textContent=message;
}
try {
  const direct = params.get('pdf') === '1' && params.get('query') !== '1';
  if(direct && id)throw new Error('Run the DMV search again to reopen this report.');
  const response = await chrome.runtime.sendMessage({type: direct ? 'reader-direct-start' : 'reader-start', id});
  if (!response?.ok) throw new Error(response?.error || 'PDF request expired.');
  let {base64, url, includeDriverIdentity = false} = response.value;
  markDemo(response.value.demo===true);
  if(direct) {
    id=response.value.id;
    const locationUrl=new URL(location.href);locationUrl.searchParams.set('id',id);history.replaceState(null,'',locationUrl);
    if(cancelledIds.has(id))controller.abort();
  }
  controller.signal.throwIfAborted();
  // Prefer authorized captured bytes; otherwise fetch the current job source with size/type limits.
  let data;
  if (base64) { data = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); base64 = null; }
  else {
    const result = await fetch(url, {credentials: 'include', cache: 'no-store', signal: AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});
    if (!result.ok) throw new Error(`PDF download failed (${result.status}).`);
    data = new Uint8Array(await result.arrayBuffer());
    if (data.length > 24 * 1024 * 1024) throw new Error('PDF exceeds the 24 MB extraction limit.');
    if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-')) throw new Error('The attachment is not a PDF. Sign in and run the search again.');
  }
  // Disable dynamic evaluation and load fonts, character maps, and workers from packaged assets only.
  loadingTask = getDocument({data, isEvalSupported: false, disableFontFace: true, useSystemFonts: true, cMapUrl: chrome.runtime.getURL('vendor/cmaps/'), cMapPacked: true, standardFontDataUrl: chrome.runtime.getURL('vendor/standard_fonts/'), wasmUrl: chrome.runtime.getURL('vendor/wasm/')});
  const doc = await loadingTask.promise;
  const lines = [];
  let retainDocument = false, driverIdentity;
  try {
    if (doc.numPages > 300) throw new Error('This report exceeds the 300-page extraction limit.');
    // Preserve reading-order line boundaries so adjacent numeric columns do not become one identifier.
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n), content = await page.getTextContent();
      let line = '', lastY = null;
      // Some PDF producers omit hasEOL. A significant Y change is a line boundary,
      // preserving number columns needed by ownerNumbers() instead of flattening them.
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform?.[5];
        if (lastY != null && y != null && Math.abs(y - lastY) > 3 && line) { lines.push(line); line = ''; }
        line += `${item.str} `; lastY = y;
        if (item.hasEOL) { lines.push(line); line = ''; lastY = null; }
      }
      if (line) lines.push(line);
      if (n === 1 && includeDriverIdentity) driverIdentity = await extractDriverIdentity(page, lines.join('\n'), controller.signal);
      page.cleanup();
    }
    const text = lines.join('\n');
    if (text.length > 1000000) throw new Error('PDF text exceeds the extraction limit.');
    controller.signal.throwIfAborted();
    // Send analysis before starting display rendering. PDF.js display tasks use
    // requestAnimationFrame, which may pause in an inactive/minimized tab.
    resultSent = true;
    const acknowledgement = chrome.runtime.sendMessage({type:'reader-result',id,text,...(driverIdentity ? {driverIdentity} : {})});
    if (params.get('dark') === '1'||params.get('query') === '1') {
      retainDocument = true;
      // Printing owns the loaded bytes and does not wait for painting or the worker ACK.
      printReady.resolve({doc,text});
      document.body.classList.add('pdf-viewer');
      document.body.dataset.pdfView='loading';
      openDarkViewer(doc,controller.signal,params.get('dark') !== '0').then(()=>{
        document.body.dataset.pdfView='ready';
      },error=>{
        document.body.dataset.pdfView='error';
        if(!controller.signal.aborted)showError(`PDF view unavailable: ${error.message}`);
      });
    } else printReady.reject(new Error('This reader is for text extraction only.'));
    const result=await acknowledgement;
    if(!result?.ok)throw new Error(result?.error||'The captured report is no longer available.');
  } finally { if (!retainDocument) await doc.destroy(); }
} catch (error) {
  printReady.reject(error);
  const message=controller.signal.aborted || error.name==='AbortError'?'Report loading stopped. Run the search again to reopen it.':error.name==='PasswordException'?'This PDF requires a document password. Open an accessible report or enter the number manually.':error.message;
  showError(message);
  if(resultSent){controller.abort();loadingTask?.destroy();}
  else await chrome.runtime.sendMessage({type:'reader-result',id,error:message});
} finally { clearInterval(heartbeat); }
