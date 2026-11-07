/** Recolor neutral paper/ink outside PDF.js-recorded image footprints. */
import {OPS} from './vendor/pdf.mjs';
const unsafeImageOps = new Set(Object.entries(OPS).filter(([name]) => /paint.*Image/i.test(name) && !['paintImageXObject','paintInlineImageXObject'].includes(name)).map(([,value]) => value));
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
export async function openDarkViewer(doc) {
  document.title = 'DMV PDF — dark view';
  document.getElementById('reading').hidden = true;
  const viewer = document.getElementById('pdfViewer'); viewer.hidden = false;
  const pages = document.getElementById('pdfPages'), toggle = document.getElementById('pdfColors');
  let dark = true, generation = 0, currentTask, pageNumber = 1;
  const previous = document.getElementById('pdfPrev'), next = document.getElementById('pdfNext');
  const render = async () => {
    const token = ++generation; currentTask?.cancel();
    pages.replaceChildren(); document.getElementById('pdfProgress').textContent = 'Rendering PDF…';
    const page = await doc.getPage(pageNumber);
    if (token !== generation) return;
    const initial = page.getViewport({scale: 1});
    // Render only the selected page and bound raster size, even for long reports.
    const scale = Math.min(1.5, 1600/initial.width, 2400/initial.height), viewport = page.getViewport({scale});
    const canvas = document.createElement('canvas'); canvas.className = 'pdf-page';
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    canvas.setAttribute('aria-label', `PDF page ${pageNumber} of ${doc.numPages}`); pages.append(canvas);
    const task = page.render({canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff', recordImages: true});
    currentTask = task;
    try { await task.promise; } catch(error) { if (token !== generation) return; throw error; }
    if (token !== generation) return;
    let originalOnly = false;
    if (dark) {
      const ops = await page.getOperatorList();
      originalOnly = ops.fnArray.some(op => unsafeImageOps.has(op));
      const coordinates = page.imageCoordinates;
      const hasImages = ops.fnArray.some(op => op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject);
      if (hasImages && !coordinates?.length) originalOnly = true;
      if (!originalOnly) darkenPaper(canvas.getContext('2d'), coordinates || []);
    }
    if (token !== generation) return;
    document.getElementById('pdfProgress').textContent = `Page ${pageNumber} of ${doc.numPages}${originalOnly ? ' — original colors retained to protect images' : ''}`;
    previous.disabled = pageNumber <= 1; next.disabled = pageNumber >= doc.numPages;
    canvas.dataset.ready = 'true'; page.cleanup();
  };
  const update = () => render().catch(error => { document.getElementById('pdfProgress').textContent = `Unable to render: ${error.message}`; });
  toggle.onclick = () => { dark = !dark; toggle.textContent = dark ? 'Use original PDF colors' : 'Use dark PDF colors'; update(); };
  previous.onclick = () => { if (pageNumber > 1) {pageNumber--;update();} };
  next.onclick = () => { if (pageNumber < doc.numPages) {pageNumber++;update();} };
  window.addEventListener('beforeunload', () => {generation++;currentTask?.cancel();doc.destroy();}, {once:true});
  toggle.disabled = previous.disabled = next.disabled = true;
  await render(); toggle.disabled = false;
}
