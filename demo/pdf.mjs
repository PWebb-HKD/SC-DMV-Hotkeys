/** Dependency-free, selectable-text synthetic PDFs, with watermarking on every page. */
export function syntheticPdf(text) {
  if(!String(text).split('\n').slice(0,2).includes('DEMONSTRATION - SYNTHETIC DATA'))throw new Error('A demonstration label is required.');
  const escape=value=>value.replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g,'\\$&');
  const wrap=line=>line.match(/.{1,88}(?:\s|$)|\S{1,88}/g)?.map(s=>s.trim())||[''];
  const body=String(text).split('\n').filter(line=>!/^DEMONSTRATION/.test(line));
  const title=/^(?:Vehicle Record|Driving Record|Customers at Same Residence)$/.test(body[0])?body.shift():'Demonstration record';
  // Keep an offense header with its own dates rather than splitting that group across pages.
  const groups=[];
  for(const line of body){if(/^(?:SUSP|REVO|VIOL):/.test(line)||!groups.length)groups.push([]);groups.at(-1).push(...wrap(line));}
  const pages=[[]],limit=46;
  for(const group of groups){
    if(pages.at(-1).length&&group.length+pages.at(-1).length>limit)pages.push([]);
    for(const line of group){if(pages.at(-1).length>=limit)pages.push([]);pages.at(-1).push(line);}
  }
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids=[];
  for(const [index,lines] of pages.entries()){
    const pageId=objects.length+1,streamId=pageId+1;kids.push(`${pageId} 0 R`);
    const commands=['BT','/F1 10 Tf','14 TL','40 752 Td',`(${escape(title)}) Tj`,'T*','(DEMONSTRATION - SYNTHETIC DATA) Tj','T*','T*',
      ...lines.flatMap((line,n)=>[...(n?['T*']:[]),`(${escape(line)}) Tj`]),'ET',
      'BT /F1 9 Tf 40 30 Td',`(DEMONSTRATION ONLY - NOT A GOVERNMENT RECORD - Page ${index+1} of ${pages.length}) Tj`,'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`);
  }
  objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let output='%PDF-1.4\n%DEMO\n';const offsets=[0];
  for(const [index,object] of objects.entries()){offsets.push(Buffer.byteLength(output));output+=`${index+1} 0 obj\n${object}\nendobj\n`;}
  const xref=Buffer.byteLength(output);
  output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('');
  output+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}
