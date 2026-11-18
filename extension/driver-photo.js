import {isNoPhotoPlaceholder} from './no-photo.js';
import {OPS} from './vendor/pdf.mjs';
import {driverName} from './driver-identity.js';
/** Multiply PDF graphics transforms to locate an image in first-page coordinates. */
function multiply(a,b) {
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}
/** Extract only an unambiguous portrait-sized image in the report header.
 * Rendering its PDF rectangle preserves photos and no-photo placeholders alike.
 * Unrecognized layouts return a name without selecting a logo or full-page scan. */
export async function extractDriverIdentity(page, text, signal) {
  const name = driverName(text);
  if (!name) return undefined;
  const identity = {name,photo:''};
  try {
    signal?.throwIfAborted();
    const viewport = page.getViewport({scale:1}), list = await page.getOperatorList();
    const candidates = [], stack = []; let matrix = [1,0,0,1,0,0];
    for (let i=0;i<list.fnArray.length;i++) {
      const op=list.fnArray[i],args=list.argsArray[i];
      if(op===OPS.save)stack.push([...matrix]);
      else if(op===OPS.restore)matrix=stack.pop()||[1,0,0,1,0,0];
      else if(op===OPS.transform)matrix=multiply(matrix,args);
      else if(op===OPS.paintImageXObject||op===OPS.paintInlineImageXObject){
        const corners=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>viewport.convertToViewportPoint(matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]));
        const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
        const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
        if(left>=0&&top>=0&&width>=72&&height>=72&&width<=225&&height<=225&&top+height<=viewport.height*.4)candidates.push({left,top,width,height});
      }
    }
    if(candidates.length!==1)return identity;
    const box=candidates[0],scale=2,canvas=document.createElement('canvas');
    canvas.width=Math.ceil(box.width*scale);canvas.height=Math.ceil(box.height*scale);
    const task=page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale}),transform:[1,0,0,1,-box.left*scale,-box.top*scale]});
    const cancel=()=>task.cancel();signal?.addEventListener('abort',cancel,{once:true});
    try{await task.promise;signal?.throwIfAborted();}finally{signal?.removeEventListener('abort',cancel);}
    if(isNoPhotoPlaceholder(canvas)){identity.noPhoto=true;canvas.width=canvas.height=0;return identity;}
    const photo=canvas.toDataURL('image/png');
    if(photo.length<=700000)identity.photo=photo;
    canvas.width=canvas.height=0;
  } catch(error) { if(signal?.aborted)throw error; }
  return identity;
}
