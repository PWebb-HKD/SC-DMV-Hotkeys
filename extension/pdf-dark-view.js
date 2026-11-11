/** Continuous PDF rendering with image-safe recoloring and persistent text-selection layers. */
import {OPS, TextLayer} from './vendor/pdf.mjs';
const unsafeImageOps = new Set(Object.entries(OPS).filter(([name]) => /paint.*Image/i.test(name) && !['paintImageXObject','paintInlineImageXObject'].includes(name)).map(([,value]) => value));
/** Recolor neutral raster pixels outside protected image bounds; leave colored pixels untouched. */
export function darkenPaper(context, coordinates) {
  const {width,height} = context.canvas, protectedPixels = new Uint8Array(width*height);
  for (let i=0; i<coordinates.length; i+=6) {
    const x0=coordinates[i]*width,y0=coordinates[i+1]*height,x1=coordinates[i+2]*width,y1=coordinates[i+3]*height,x2=coordinates[i+4]*width,y2=coordinates[i+5]*height;
    const x3=x1+x2-x0,y3=y1+y2-y0;
    // Conservatively protect rotated/clipped images, including rounding at edges.
    const left=Math.max(0,Math.floor(Math.min(x0,x1,x2,x3))-2),right=Math.min(width,Math.ceil(Math.max(x0,x1,x2,x3))+2);
    const top=Math.max(0,Math.floor(Math.min(y0,y1,y2,y3))-2),bottom=Math.min(height,Math.ceil(Math.max(y0,y1,y2,y3))+2);
    for(let y=top;y<bottom;y++)protectedPixels.fill(1,y*width+left,y*width+right);
  }
  const image=context.getImageData(0,0,width,height),data=image.data;
  for(let pixel=0;pixel<protectedPixels.length;pixel++) {
    if(protectedPixels[pixel])continue;
    const i=pixel*4,r=data[i],g=data[i+1],b=data[i+2];
    if(Math.max(r,g,b)-Math.min(r,g,b)>8)continue;
    const light=(r+g+b)/3/255;
    data[i]=Math.round(240*(1-light)+24*light);data[i+1]=Math.round(243*(1-light)+26*light);data[i+2]=Math.round(245*(1-light)+27*light);
  }
  context.putImageData(image,0,0);
}
/** Continuous scroll, rendering only nearby pages and never exposing a white render-in-progress. */
export async function openDarkViewer(doc, signal) {
  document.title = 'DMV PDF results';
  document.getElementById('reading').hidden = true;
  document.getElementById('pdfViewer').hidden = false;
  const pages = document.getElementById('pdfPages'), toggle = document.getElementById('pdfColors');
  const progress = document.getElementById('pdfProgress');
  let dark = true, generation = 0, currentTask, pumping = false, stopped = false;
  const first = await doc.getPage(1), initial = first.getViewport({scale:1}); first.cleanup();
  const sheets = Array.from({length:doc.numPages}, (_,index) => {
    const element = document.createElement('section'); element.className = 'pdf-sheet';
    element.style.width = `${Math.min(1600,initial.width*1.5)}px`; element.style.aspectRatio = `${initial.width}/${initial.height}`;
    element.setAttribute('aria-label', `PDF page ${index+1} of ${doc.numPages}`);
    const label = document.createElement('span'); label.className = 'pdf-page-label'; label.textContent = `Page ${index+1}`;element.append(label);
    pages.append(element);return {number:index+1,element,near:index===0,ready:false};
  });
  // Keep lightweight text layers in the document even when distant raster pages
  // are released, so selections across pages and Select All do not lose text.
  const pendingText = new Set();
  // Resize retained selection surfaces to the current sheet width without rebuilding their text spans.
  const resizeText = sheet => {
    if(sheet.textSurface)sheet.textSurface.style.transform=`scale(${sheet.element.getBoundingClientRect().width/sheet.viewportWidth})`;
  };
  const resizeObserver = new ResizeObserver(entries => {
    for(const entry of entries)resizeText(sheets.find(sheet=>sheet.element===entry.target));
  });
  // Build each selectable text layer once and keep it even when its distant canvas is evicted.
  const prepareText = (sheet,page,viewport) => {
    if(sheet.textPromise)return sheet.textPromise;
    sheet.textPromise=(async()=>{
      const content=await page.getTextContent();
      if(stopped)return;
      const surface=document.createElement('div');surface.className='pdf-text-surface';
      surface.style.width=`${viewport.width}px`;surface.style.height=`${viewport.height}px`;
      const layer=document.createElement('div');layer.className='textLayer';
      layer.style.setProperty('--total-scale-factor',viewport.scale);
      layer.style.setProperty('--scale-round-x','1px');layer.style.setProperty('--scale-round-y','1px');
      surface.append(layer);
      const task=new TextLayer({textContentSource:content,container:layer,viewport});pendingText.add(task);
      try {await task.render();} finally {pendingText.delete(task);}
      if(stopped)return;
      sheet.viewportWidth=viewport.width;sheet.textSurface=surface;
      sheet.element.style.width=`${viewport.width}px`;sheet.element.style.aspectRatio=`${viewport.width}/${viewport.height}`;
      sheet.element.append(surface);resizeText(sheet);resizeObserver.observe(sheet.element);
    })();
    return sheet.textPromise;
  };
  // Keep image rendering usable when a page cannot create a selection layer.
  const textError = (sheet,error) => {
    if(!stopped)sheet.element.querySelector('.pdf-page-label').textContent=`Page ${sheet.number}: text selection unavailable (${error.message})`;
  };
  // Bound raster dimensions and scale to avoid unbounded memory usage on large-format reports.
  const viewportFor = page => {
    const initial=page.getViewport({scale:1});return page.getViewport({scale:Math.min(1.5,1600/initial.width,2400/initial.height)});
  };
  // Report document-wide page count and the active color mode in the viewer header.
  const status = () => {progress.textContent = `${doc.numPages} ${doc.numPages===1?'page':'pages'} · ${dark?'Dark':'Original'} colors`;};
  // Render one nearby page off-DOM and publish it only if its generation and visibility still match.
  const render = async (sheet, token) => {
    const page = await doc.getPage(sheet.number);
    if (stopped || token !== generation) return;
    const viewport = viewportFor(page);
    sheet.element.style.width = `${viewport.width}px`;sheet.element.style.aspectRatio = `${viewport.width}/${viewport.height}`;
    // Keep the actual canvas detached until rendering and recoloring both finish.
    const canvas = document.createElement('canvas');canvas.className = 'pdf-page';
    canvas.width = Math.ceil(viewport.width);canvas.height = Math.ceil(viewport.height);
    canvas.setAttribute('aria-label', `PDF page ${sheet.number} of ${doc.numPages}`);
    currentTask = page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff',recordImages:true});
    try {
      await currentTask.promise;
      if(stopped || token !== generation || !sheet.near)return;
      let originalOnly = false;
      if(dark) {
        const ops = await page.getOperatorList();
        originalOnly = ops.fnArray.some(op=>unsafeImageOps.has(op));
        const coordinates = page.imageCoordinates;
        const hasImages = ops.fnArray.some(op=>op===OPS.paintImageXObject || op===OPS.paintInlineImageXObject);
        if(hasImages && !coordinates?.length)originalOnly = true;
        if(!originalOnly)darkenPaper(canvas.getContext('2d'),coordinates||[]);
      }
      if(stopped || token !== generation || !sheet.near)return;
      sheet.element.append(canvas);
      await prepareText(sheet,page,viewport).catch(error=>textError(sheet,error));
      if(stopped || token !== generation || !sheet.near){canvas.remove();return;}
      canvas.dataset.ready = 'true';sheet.ready = true;
      if(originalOnly)sheet.element.querySelector('.pdf-page-label').textContent = `Page ${sheet.number} — original colors retained to protect images`;
    } catch(error) {
      if(!stopped && token === generation) {sheet.ready=true;sheet.element.querySelector('.pdf-page-label').textContent=`Page ${sheet.number}: ${error.message}`;}
    } finally {currentTask=null;page.cleanup();}
  };
  // Serialize raster work while allowing viewport changes to queue newly nearby pages.
  const pump = async () => {
    if(pumping || stopped)return;
    pumping=true;
    try {
      let sheet;
      while(!stopped && (sheet=sheets.find(item=>item.near&&!item.ready)))await render(sheet,generation);
    } finally {pumping=false;}
  };
  let observer;
  // Cancel raster/text tasks and release observers plus the PDF document when the view is abandoned.
  const stop = () => {stopped=true;generation++;observer?.disconnect();resizeObserver.disconnect();currentTask?.cancel();for(const task of pendingText)task.cancel();doc.destroy();};
  signal?.addEventListener('abort',stop,{once:true});
  window.addEventListener('beforeunload',stop,{once:true});
  toggle.disabled=true;
  await render(sheets[0],generation);
  if(stopped)throw new DOMException('Report loading stopped.','AbortError');
  status();toggle.disabled=false;
  // Prepare distant text in order so Select All still works across pages not currently rasterized.
  const prepareRemainingText=async()=>{
    for(const sheet of sheets.slice(1)) {
      if(stopped)return;
      const page=await doc.getPage(sheet.number);
      try {await prepareText(sheet,page,viewportFor(page)).catch(error=>textError(sheet,error));} finally {page.cleanup();}
    }
  };
  prepareRemainingText().catch(error=>{if(!stopped)progress.textContent=`Text selection unavailable: ${error.message}`;});
  // Keep only nearby canvases resident; text layers stay available for copying across pages.
  observer = new IntersectionObserver(entries => {
    for(const entry of entries) {
      const sheet = sheets.find(item=>item.element===entry.target);sheet.near=entry.isIntersecting;
      if(!sheet.near) {sheet.element.querySelector('canvas')?.remove();sheet.ready=false;}
    }
    pump().catch(error=>{progress.textContent=`Unable to render: ${error.message}`;});
  },{rootMargin:'800px 0px'});
  sheets.forEach(sheet=>observer.observe(sheet.element));
  // Invalidate previous color renders and repaint without replacing the immutable source document.
  toggle.onclick=()=>{
    dark=!dark;generation++;currentTask?.cancel();
    toggle.textContent=dark?'Use original PDF colors':'Use dark PDF colors';
    sheets.forEach(sheet=>{sheet.element.querySelector('canvas')?.remove();sheet.ready=false;sheet.element.querySelector('.pdf-page-label').textContent=`Page ${sheet.number}`;});
    status();pump().catch(error=>{progress.textContent=`Unable to render: ${error.message}`;});
  };
}
