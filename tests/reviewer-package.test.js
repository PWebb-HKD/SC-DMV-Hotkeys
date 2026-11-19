/** Archive integrity and fail-closed packaging boundaries, using only fictional runtime data. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {buildWebstore} from '../tools/build-webstore.mjs';
test('runtime ZIP is reproducible, independently readable, complete and excludes development/private files',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'scdmv-package-'));
  try{
    const first=await buildWebstore({output:dir}),bytes=await readFile(first.path),second=await buildWebstore({output:dir});
    assert.equal(first.sha256,second.sha256);assert.deepEqual(bytes,await readFile(second.path));
    execFileSync('python3',['-c',`import json,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 names=z.namelist()
 assert len(names)==int(sys.argv[2])
 assert 'manifest.json' in names and 'reviewer-guide.html' in names
 assert 'demo/reports/DRIVER001.pdf' in names
 assert not any(n.startswith(('tests/','tools/','node_modules/')) or n.endswith(('.pem','.key','.zip','.crx')) for n in names)
 assert not json.loads(z.read('manifest.json')).get('optional_host_permissions')`,first.path,String(first.files)]);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('packaging rejects unreviewed files, symlinks and excess permissions before producing an archive',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'scdmv-package-')),runtimeRoot=join(dir,'runtime'),output=join(dir,'output');
  try{
    await cp(fileURLToPath(new URL('../extension/',import.meta.url)),runtimeRoot,{recursive:true});
    const extra=join(runtimeRoot,'unexpected.pem');await writeFile(extra,'synthetic non-key packaging sentinel');
    await assert.rejects(buildWebstore({runtimeRoot,output}),/reviewed file allowlist/);await rm(extra);
    await symlink('manifest.json',join(runtimeRoot,'linked-manifest.json'));
    await assert.rejects(buildWebstore({runtimeRoot,output}),/Symlinks cannot enter/);await rm(join(runtimeRoot,'linked-manifest.json'));
    const manifest=JSON.parse(await readFile(join(runtimeRoot,'manifest.json'),'utf8'));manifest.permissions.push('history');
    await writeFile(join(runtimeRoot,'manifest.json'),JSON.stringify(manifest));
    await assert.rejects(buildWebstore({runtimeRoot,output}),/Permission declarations changed/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
