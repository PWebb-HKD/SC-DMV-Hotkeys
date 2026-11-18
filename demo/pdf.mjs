/** A dependency-free, text-selectable PDF writer for synthetic records only. */
export function syntheticPdf(text) {
  if(!String(text).startsWith('DEMONSTRATION - SYNTHETIC DATA'))throw new Error('A demonstration label is required.');
  const lines=String(text).split('\n').flatMap(line=>line.match(/.{1,88}(?:\s|$)|\S{1,88}/g)||['']);
  const escape=value=>value.replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g,'\\$&');
  const commands=['BT','/F1 10 Tf','14 TL','40 752 Td',...lines.flatMap((line,index)=>[...(index?['T*']:[]),`(${escape(line.trim())}) Tj`]),'ET'].join('\n');
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`
  ];
  let output='%PDF-1.4\n%DEMO\n';const offsets=[0];
  for(const [index,object] of objects.entries()){offsets.push(Buffer.byteLength(output));output+=`${index+1} 0 obj\n${object}\nendobj\n`;}
  const xref=Buffer.byteLength(output);
  output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('');
  output+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}
