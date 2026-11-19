/** Reproducible runtime-only Web Store ZIP. Audit and generated-demo verification run before archive creation. */
import {readFile,readdir,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {auditPermissions} from './audit-permissions.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
const hash=data=>createHash('sha256').update(data).digest('hex');
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** Small ZIP writer using only built-in Node libraries; names/dates/order are deterministic. */
export function runtimeZip(files){
  const body=[],directory=[];let offset=0;
  for(const {path,data} of files){
    const name=Buffer.from(path),compressed=deflateRawSync(data),crc=crc32(data),header=Buffer.alloc(30),entry=Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
    entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(8,10);entry.writeUInt16LE(33,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(compressed.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
    body.push(header,name,compressed);directory.push(entry,name);offset+=header.length+name.length+compressed.length;
  }
  const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...body,central,end]);
}
async function walk(root,path=''){
  const result=[];
  for(const name of await readdir(resolve(root,path))){const next=path?path+'/'+name:name,stat=await lstat(resolve(root,next));if(stat.isSymbolicLink())throw new Error('Symlinks cannot enter the runtime archive: '+next);if(stat.isDirectory())result.push(...await walk(root,next));else result.push(next);}
  return result.sort();
}
export async function buildWebstore({output=resolve(project,'output/reviewer'),runtimeRoot=resolve(project,'extension')}={}){
  const audit=await auditPermissions({runtimeRoot});
  const generated=spawnSync(process.execPath,[resolve(project,'tools/build-demo.mjs'),'--check'],{encoding:'utf8'});if(generated.status)throw new Error(generated.stderr||'Rebuild the packaged demo first.');
  const allowed=JSON.parse(await readFile(resolve(project,'tools/runtime-files.json'),'utf8')),actual=await walk(runtimeRoot);
  if(JSON.stringify(actual)!==JSON.stringify(allowed))throw new Error('Runtime tree differs from the reviewed file allowlist. Review additions/removals before packaging.');
  const files=[];
  for(const path of allowed){if(/(?:^|\/)(?:\.|node_modules|tests|attachments)|\.(?:pem|key|crx|zip)$/i.test(path))throw new Error('Private/build files cannot enter the Web Store ZIP.');files.push({path,data:await readFile(resolve(runtimeRoot,path))});}
  const manifest=JSON.parse(files.find(file=>file.path==='manifest.json').data),zip=runtimeZip(files),name='SC-DMV-Hotkeys-'+manifest.version+'-webstore.zip';
  await mkdir(output,{recursive:true});await writeFile(resolve(output,name),zip);
  await writeFile(resolve(output,name+'.sha256'),hash(zip)+'  '+name+'\n');
  await writeFile(resolve(output,'permission-audit.json'),JSON.stringify(audit,null,2)+'\n');
  const inventory={version:manifest.version,archive:name,sha256:hash(zip),files:files.map(file=>({path:file.path,bytes:file.data.length,sha256:hash(file.data)}))};
  await writeFile(resolve(output,'runtime-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
  return {path:resolve(output,name),files:files.length,bytes:zip.length,sha256:hash(zip)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildWebstore()));
