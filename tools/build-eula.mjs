/** Bundle the current agreement, excluding the publisher's non-contract drafting checklist. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=new URL('../reviewer/EULA-DRAFT.md',import.meta.url),target=new URL('../extension/eula-content.js',import.meta.url);
const draft=await readFile(source,'utf8');
const text=draft.split('\n---\n')[0].split('\n').filter(line=>!line.startsWith('**WORKING DRAFT')).join('\n').trim()+'\n';
if(!text.includes('## 10. Limitation of liability')||!text.includes('## 13. General terms and contact'))throw new Error('The complete EULA sections must be present.');
const digest=createHash('sha256').update(text).digest('hex');
const generated='// Generated from reviewer/EULA-DRAFT.md; run node tools/build-eula.mjs after agreement edits.\nexport const EULA_DIGEST='+JSON.stringify(digest)+';\nexport const EULA_TEXT='+JSON.stringify(text)+';\n';
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==generated)throw new Error('Rebuild the bundled EULA.');}
else await writeFile(target,generated);
console.log('Bundled EULA '+(process.argv.includes('--check')?'verified.':'built.'));
