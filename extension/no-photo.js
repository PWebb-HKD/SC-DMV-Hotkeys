// Central text-only signature of the standard "No Photo Available" graphic.
// The sampled rectangle excludes the border identifiers; no driver image or identifier is retained.
const TEMPLATE = '000000000000000000000000000000000000000000000000000000000003e0000003400000036000000000000000000000180000001e5400001d48000024ec000000000000000000008080000085ecc001bba740012fe70000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const REFERENCE = [...TEMPLATE].flatMap(hex => [...parseInt(hex,16).toString(2).padStart(4,'0')].map(Number));
/** Match the known placeholder's text layout, not merely a white background or absent face.
 * Small resampling/compression differences are tolerated; unknown graphics are not guessed. */
export function isNoPhotoPlaceholder(image) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,image.width*.12,image.height*.18,image.width*.76,image.height*.64,0,0,32,32);
  const rgba=ctx.getImageData(0,0,32,32).data,bits=[];let white=0,ink=0;
  for(let i=0;i<rgba.length;i+=4){
    const light=.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2];
    const dark=light<200?1:0;bits.push(dark);ink+=dark;if(light>235)white++;
  }
  if(white<1024*.75||ink<1024*.04||ink>1024*.15)return false;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    let differences=0;
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const sx=x+dx,sy=y+dy,value=sx<0||sx>=32||sy<0||sy>=32?0:bits[sy*32+sx];
      differences+=value!==REFERENCE[y*32+x]?1:0;
    }
    if(differences<=36)return true;
  }
  return false;
}
