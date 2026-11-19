/** Procedural, non-personal raster fixtures embedded in synthetic PDFs. No uploaded image is used. */
const width=200,height=200;
// Non-personal low-resolution text mask for the standard no-photo graphic.
// Fixed fixture data, deliberately independent of the runtime detector's exports.
const noPhotoMask='000000000000000000000000000000000000000000000000000000000003e0000003400000036000000000000000000000180000001e5400001d48000024ec000000000000000000008080000085ecc001bba740012fe70000000000000000000000000000000000000000000000000000000000000000000000000000000000';
/** Draw a stylized fictional portrait or the standard text-layout placeholder without dependencies. */
export function demoImage(kind){
  if(!['portrait','placeholder'].includes(kind))throw new Error('Choose a known synthetic image.');
  const data=Buffer.alloc(width*height*3,255),bits=[...noPhotoMask].flatMap(h=>[...parseInt(h,16).toString(2).padStart(4,'0')].map(Number));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    let rgb=[255,255,255];
    if(kind==='portrait'){
      rgb=[126+Math.floor(y/8),174+Math.floor(y/12),199];
      if(((x-100)/86)**2+((y-204)/66)**2<1)rgb=[29,66,100];
      if(x>84&&x<116&&y>123&&y<164)rgb=[191,135,94];
      if(((x-100)/46)**2+((y-87)/62)**2<1)rgb=[216,166,122];
      if(((x-100)/49)**2+((y-53)/34)**2<1||x>54&&x<65&&y>52&&y<98)rgb=[61,43,35];
      if((((x-83)/4)**2+((y-88)/3)**2<1)||(((x-117)/4)**2+((y-88)/3)**2<1))rgb=[35,35,35];
      if(x>88&&x<112&&y>119&&y<122)rgb=[126,65,56];
    }else{
      // The matching area is central; the blue frame sits outside that sample.
      const sx=Math.floor((x/width-.12)/.76*32),sy=Math.floor((y/height-.18)/.64*32);
      if(sx>=0&&sx<32&&sy>=0&&sy<32&&bits[sy*32+sx])rgb=[30,50,65];
      if(x<3||x>=width-3||y<3||y>=height-3)rgb=[18,94,133];
    }
    const offset=(y*width+x)*3;data.set(rgb,offset);
  }
  return {width,height,data};
}
