/** Dependency-free synthetic report layout: aligned fields, credential tables and intact offense groups. */
import {deflateSync} from 'node:zlib';
import {demoImage} from './images.mjs';
const LEFT=40,RIGHT=572,BOTTOM=68,ROW=13,SIZE=8.7;
const escape=value=>String(value).replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g,'\\$&');
const wrap=(value,columns)=>{
  const words=String(value).split(/\s+/).filter(Boolean),lines=[];let line='';
  for(let word of words){
    if(line&&line.length+1+word.length>columns){lines.push(line);line='';}
    while(word.length>columns){if(line){lines.push(line);line='';}lines.push(word.slice(0,columns));word=word.slice(columns);}
    line+=`${line?' ':''}${word}`;
  }
  if(line||!lines.length)lines.push(line);return lines;
};
const textAt=(value,x,y,font='F1',size=SIZE)=>`BT /${font} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`;
const rule=(y,width=.5)=>`0 G ${width} w ${LEFT} ${y} m ${RIGHT} ${y} l S`;
const centered=(value,y,size,font='F3')=>textAt(value,306-value.length*size*.28,y,font,size);
// Match complete labels before splitting values so names, addresses and dates stay with their labels.
const LABELS=['Reinstatement Requirements Met','Reinstatement Fee Paid','Special Driving Privilege','Registrant/Lessee Number','Registrant/Lessee Name','Driver License No','Driver Training','Enforcement Description','Enforcement Statute','Suspension Beg','Suspension End','Revocation Beg','Revocation End','Customer Number','Customer No','Owner Number','Owner Name','Owner Address','Lessee Address','Last Transaction','Plate Number','Plate Class','Vehicle Type','Date of Issue','Plate Exp Date','Decal Exp Date','Decal Number','Empty Weight','Title Number','Issue Date','Eye Color','IID Required','Ticket#','Conviction','Violation','Causal','Recd','Post','Address','County','Height','Weight','Status - DL','CDL','Name','City','State','Zip','DOB','Sex','Race','VIN','Year','Make','Model','Body','Status','Dup'];
const labels=new RegExp('('+LABELS.map(label=>label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+'):\\s*','g');
function fields(line){const matches=[...line.matchAll(labels)];return matches.map((match,index)=>({label:match[1]+':',value:line.slice(match.index+match[0].length,matches[index+1]?.index??line.length).trim()}));}
/** A row has shared baselines and fixed columns; overflowing values wrap within their own column. */
function fieldRow(items,widths){
  const rows=[],positions=[];let x=LEFT,height=ROW;
  for(let n=0;n<items.length;n++){
    const item=items[n],width=widths[n],labelWidth=(item.label.length+1)*SIZE*.6;
    const values=wrap(item.value,Math.max(8,Math.floor((width-labelWidth-8)/(SIZE*.6))));
    positions.push({item,x,labelWidth,values});height=Math.max(height,values.length*ROW);x+=width;
  }
  for(const {item,x,labelWidth,values} of positions){rows.push({value:item.label,x,y:0,font:'F2'});values.forEach((value,n)=>rows.push({value,x:x+labelWidth,y:-n*ROW,font:'F1'}));}
  return {height,rows};
}
function lineRows(line){
  const items=fields(line);if(!items.length)return {height:wrap(line,100).length*ROW,rows:wrap(line,100).map((value,n)=>({value,x:LEFT,y:-n*ROW,font:'F1'}))};
  const rows=[];let height=0;
  const add=(items,widths)=>{const row=fieldRow(items,widths);rows.push(...row.rows.map(item=>({...item,y:item.y-height})));height+=row.height;};
  if(items.map(item=>item.label).join('|')==='VIN:|Year:|Make:|Model:|Body:'){add(items,[218,63,69,94,88]);return {height,rows};}
  for(let n=0;n<items.length;){
    if(/(?:Name|Address):$/.test(items[n].label)){add([items[n++]],[RIGHT-LEFT]);continue;}
    if(items[n].label==='City:'&&items[n+1]?.label==='State:'&&items[n+2]?.label==='Zip:'){add(items.slice(n,n+3),[280,85,167]);n+=3;continue;}
    if(n+1<items.length&&!/(?:Name|Address):$/.test(items[n+1].label)){add(items.slice(n,n+2),[266,266]);n+=2;}
    else add([items[n++]],[RIGHT-LEFT]);
  }
  return {height,rows};
}
/** Structure the fictional text without changing its field values or replacing production parsing. */
function reportBlocks(lines,title){
  const blocks=[];let owners=false,offenses=false;
  const section=value=>blocks.push({section:value,height:26});
  const line=value=>{const row=lineRows(value);blocks.push({...row,height:row.height+3});};
  if(title==='Vehicle Record')section('Vehicle information');
  if(title==='Driving Record')section('Driver / customer information');
  if(title==='Customers at Same Residence')section('Household address and customers');
  for(let n=0;n<lines.length;n++){
    const value=lines[n];
    if(/^Owner Number:/.test(value)&&!owners){section('Registered owners');owners=true;}
    if(/^Plate Number:/.test(value))section('Registration');
    if(/^License Information/.test(value)){
      section('License Information');
      blocks.push({height:17,rows:[{value:'Type Class Function    Issued     Expires    Printed Date Restr.Endor.Document Identifier',x:LEFT,y:0,font:'F2'}]});
      continue;
    }
    if(/^Current \(ACN \/ DDN\)/.test(value)){
      const parts=value.replace(/^Current \(ACN \/ DDN\)\s*/,'').split(/\s+/),columns=[5,6,12,11,11,13,3,3];
      blocks.push({height:32,rows:[{value:'Current',x:LEFT,y:0,font:'F2'},{value:'(ACN / DDN)',x:400,y:0,font:'F1'},{value:parts.map((part,index)=>part.padEnd(columns[index]||0)).join(''),x:LEFT,y:-ROW,font:'F1'}]});continue;
    }
    if(/^(?:SUSP|REVO|VIOL):/.test(value)){
      if(!offenses){section('Suspensions, revocations and violations');offenses=true;}
      const rows=[],headingEnd=value.search(/\s+(?:Violation|Causal):/),heading=headingEnd<0?value:value.slice(0,headingEnd);
      const headings=wrap(heading,100);headings.forEach((value,n)=>rows.push({value,x:LEFT+6,y:-n*ROW,font:'F2'}));
      let height=headings.length*ROW+5;
      const detailLines=headingEnd<0?[]:[value.slice(headingEnd).trim()];
      while(n+1<lines.length&&!/^(?:SUSP|REVO|VIOL):/.test(lines[n+1]))detailLines.push(lines[++n]);
      for(const detail of detailLines){const row=lineRows(detail);rows.push(...row.rows.map(item=>({...item,y:item.y-height})));height+=row.height;}
      blocks.push({height:height+12,rows,headingLines:headings.length});continue;
    }
    line(value);
  }
  return blocks;
}
export function syntheticPdf(text,{image}={}){
  if(!String(text).split('\n').slice(0,2).includes('DEMONSTRATION - SYNTHETIC DATA'))throw new Error('A demonstration label is required.');
  const body=String(text).split('\n').filter(line=>!/^DEMONSTRATION/.test(line));
  const title=/^(?:Vehicle Record|Driving Record|Customers at Same Residence)$/.test(body[0])?body.shift():'Demonstration record';
  const pages=[{blocks:[],top:image?536:696}],blocks=reportBlocks(body,title);let y=pages[0].top;
  // Move complete offense groups to the next page. No ticket/date row is orphaned.
  for(const [index,block] of blocks.entries()){
    const needed=block.section?block.height+(blocks[index+1]?.height||0):block.height;
    if(y-needed<BOTTOM&&pages.at(-1).blocks.length){pages.push({blocks:[],top:696});y=696;}
    pages.at(-1).blocks.push({...block,y});y-=block.height;
  }
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  if(image){const raster=demoImage(image),encoded=deflateSync(raster.data).toString('hex')+'>';objects.push(`<< /Type /XObject /Subtype /Image /Width ${raster.width} /Height ${raster.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /FlateDecode] /Length ${Buffer.byteLength(encoded)} >>\nstream\n${encoded}\nendstream`);}
  const kids=[];
  for(const [index,page] of pages.entries()){
    const pageId=objects.length+1,streamId=pageId+1;kids.push(`${pageId} 0 R`);
    const withImage=image&&index===0,commands=[centered(title,752,17),centered('DEMONSTRATION - SYNTHETIC DATA',733,9,'F2'),
      ...(withImage?['q 144 0 0 144 234 573 cm /Im1 Do Q',centered('Synthetic image - no real person',561,8,'F1')]:[]),rule(withImage?549:715,1)];
    for(const block of page.blocks){
      if(block.section){commands.push(textAt(block.section,LEFT,block.y,'F2',10),rule(block.y-6));continue;}
      if(block.headingLines)commands.push(`q .94 g ${LEFT} ${block.y-3-(block.headingLines-1)*ROW} ${RIGHT-LEFT} ${block.headingLines*ROW+3} re f Q`);
      for(const row of block.rows)commands.push(textAt(row.value,row.x,block.y+row.y,row.font));
      if(block.headingLines)commands.push(rule(block.y-block.height+7,.25));
    }
    commands.push(rule(47),textAt('DEMONSTRATION ONLY - NOT A GOVERNMENT RECORD',LEFT,33,'F1',8),textAt(`Page ${index+1} of ${pages.length}`,496,33,'F1',8));
    const stream=commands.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> ${withImage?'/XObject << /Im1 6 0 R >>':''} >> /Contents ${streamId} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let output='%PDF-1.4\n%DEMO\n';const offsets=[0];
  for(const [index,object] of objects.entries()){offsets.push(Buffer.byteLength(output));output+=`${index+1} 0 obj\n${object}\nendobj\n`;}
  const xref=Buffer.byteLength(output);
  output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('');
  output+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(output);
}
