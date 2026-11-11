/**
 * Results viewer or temporary extraction tab that reads PDF text with bundled PDF.js. It receives a
 * single authorized job from the worker and returns text/errors by job ID. Reading
 * PDF bytes avoids depending on the browser viewer DOM; this is not an OCR engine.
 */
import {installNativePrint} from './pdf-print.js';
import {openDarkViewer} from './pdf-dark-view.js';
import {getDocument, GlobalWorkerOptions} from './vendor/pdf.mjs';
GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.mjs');
const params = new URL(location.href).searchParams;
let id = params.get('id'), loadingTask;
// Cancellation covers both the job handshake and PDF loading; a late job ID may already be cancelled.
const controller = new AbortController(), cancelledIds = new Set();
const printReady=Promise.withResolvers();printReady.promise.catch(()=>{});
if(params.get('dark')==='1')installNativePrint(printReady.promise,controller.signal);
chrome.runtime.onMessage.addListener(message => {
  if(message.target !== 'pdf-reader' || message.type !== 'reader-cancel')return;
  if(!id)cancelledIds.add(message.id);
  if(message.id===id){controller.abort();loadingTask?.destroy();}
});
// A live port with heartbeat messages keeps the pending worker job reachable.
const port = chrome.runtime.connect({name: 'panel'});
const heartbeat = setInterval(() => { try { port.postMessage({type: 'heartbeat'}); } catch {} }, 15000);
try {
  const direct = params.get('pdf') === '1';
  if(direct && id)throw new Error('Run the DMV search again to reopen this report.');
  const response = await chrome.runtime.sendMessage({type: direct ? 'reader-direct-start' : 'reader-start', id});
  if (!response?.ok) throw new Error(response?.error || 'PDF request expired.');
  let {base64, url} = response.value;
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
  let viewReady = false, viewerError;
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
      page.cleanup();
    }
    if (new URL(location.href).searchParams.get('dark') === '1') {
      try { document.body.classList.add('pdf-viewer'); await openDarkViewer(doc,controller.signal); viewReady = true; }
      catch (error) { viewerError = error.message; }
    }
  } finally { if (!viewReady) await doc.destroy(); }
  const text = lines.join('\n');
  if (text.length > 1000000) throw new Error('PDF text exceeds the extraction limit.');
  // Printing owns this loaded document and must not depend on a live background capture.
  if(viewReady)printReady.resolve({doc,text});else printReady.reject(new Error(viewerError||'The PDF viewer could not be opened.'));
  const result=await chrome.runtime.sendMessage({type: 'reader-result', id, text, viewReady, viewerError});
  if(!result?.ok)throw new Error(result?.error||'The captured report is no longer available.');
} catch (error) {
  printReady.reject(error);
  document.getElementById('reading').hidden=false;
  document.getElementById('readingNote').textContent=controller.signal.aborted || error.name==='AbortError'?'Report loading stopped. Run the search again to reopen it.':error.message;
  await chrome.runtime.sendMessage({type: 'reader-result', id, error: controller.signal.aborted ? 'Report loading stopped. Run the search again to reopen it.' : error.name === 'PasswordException' ? 'This PDF requires a document password. Open an accessible report or enter the number manually.' : error.message});
} finally { clearInterval(heartbeat); }
