/**
 * Temporary extension tab that extracts PDF text with bundled PDF.js. It receives a
 * single authorized job from the worker and returns text/errors by job ID. Reading
 * PDF bytes avoids depending on the browser viewer DOM; this is not an OCR engine.
 */
import {getDocument, GlobalWorkerOptions} from './vendor/pdf.mjs';
GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.mjs');
const id = new URL(location.href).searchParams.get('id');
// A live port with heartbeat messages keeps the pending worker job reachable.
const port = chrome.runtime.connect({name: 'panel'});
const heartbeat = setInterval(() => { try { port.postMessage({type: 'heartbeat'}); } catch {} }, 15000);
try {
  const response = await chrome.runtime.sendMessage({type: 'reader-start', id});
  if (!response?.ok) throw new Error(response?.error || 'PDF request expired.');
  let {base64, url} = response.value;
  let data;
  if (base64) { data = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); base64 = null; }
  else {
    const result = await fetch(url, {credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(25000)});
    if (!result.ok) throw new Error(`PDF download failed (${result.status}).`);
    data = new Uint8Array(await result.arrayBuffer());
    if (data.length > 24 * 1024 * 1024) throw new Error('PDF exceeds the 24 MB extraction limit.');
    if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-')) throw new Error('The attachment is not a PDF. Sign in and run the search again.');
  }
  const doc = await getDocument({data, isEvalSupported: false, disableFontFace: true, useSystemFonts: true, cMapUrl: chrome.runtime.getURL('vendor/cmaps/'), cMapPacked: true, standardFontDataUrl: chrome.runtime.getURL('vendor/standard_fonts/'), wasmUrl: chrome.runtime.getURL('vendor/wasm/')}).promise;
  const lines = [];
  try {
    if (doc.numPages > 300) throw new Error('This report exceeds the 300-page extraction limit.');
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
  } finally { await doc.destroy(); }
  const text = lines.join('\n');
  if (text.length > 1000000) throw new Error('PDF text exceeds the extraction limit.');
  await chrome.runtime.sendMessage({type: 'reader-result', id, text});
} catch (error) {
  await chrome.runtime.sendMessage({type: 'reader-result', id, error: error.name === 'PasswordException' ? 'This PDF requires a document password. Open an accessible report or enter the number manually.' : error.message});
} finally { clearInterval(heartbeat); }
