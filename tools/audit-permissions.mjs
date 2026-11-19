/** Review gate for current workflows. A matching API name alone does not justify a permission. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const evidence=[
  {permission:'storage',file:'extension/vault.js',symbol:'chrome.storage.local.set',workflow:'User-selected encrypted login/blacklist, session snapshots, preferences and separate demo workflow state.'},
  {permission:'tts',file:'extension/audio-alerts.js',symbol:'api.tts.getVoices',workflow:'User-enabled local text-to-speech announcements and recording fallback.'},
  {permission:'offscreen',file:'extension/audio-alerts.js',symbol:"reasons: ['AUDIO_PLAYBACK']",workflow:'Play packaged voice recordings/suspended clip from the service worker. The retired offscreen query transport is not used.'},
  {permission:'scripting',file:'extension/automation.js',symbol:'scripting.executeScript',workflow:'Fill/click the live DMV forms and capture report bytes; DMV appearance also uses scripting CSS APIs. Packaged demo pages use owned ports instead.'},
  {permission:'tabs',file:'extension/background-search.js',symbol:"tab.url==='about:blank'",workflow:'Read sensitive tab URLs/pending URLs to verify the owned blank helper before navigation, distinguish native/blob reports and preserve user-navigated tabs. Most tab operations alone do not require tabs; these ownership/source checks do.'},
  {permission:'declarativeNetRequestWithHostAccess',file:'extension/pdf-routing.js',symbol:'updateDynamicRules',workflow:'Route only live top-level DMV attachment responses to the bundled PDF viewer before the native viewer loads, in light and dark modes.'},
  {permission:'webNavigation',file:'extension/background.js',symbol:'chrome.webNavigation.onCommitted',workflow:'Bind/invalidate report captures by committed top-level document ID; tabs.onUpdated does not provide the required identity.'}
];
export async function auditPermissions({runtimeRoot=resolve(root,'extension')}={}){
  const manifest=JSON.parse(await readFile(resolve(runtimeRoot,'manifest.json'),'utf8'));
  const expected=evidence.map(row=>row.permission).sort();
  if(JSON.stringify([...manifest.permissions].sort())!==JSON.stringify(expected))throw new Error('Permission declarations changed. Review and update the workflow rationale before packaging.');
  if(JSON.stringify(manifest.host_permissions)!==JSON.stringify(['https://www.scdmvonline.com/*']))throw new Error('Live host access must remain limited to the DMV origin.');
  if((manifest.optional_host_permissions||[]).length)throw new Error('The packaged demo needs no optional host access.');
  if(manifest.web_accessible_resources.some(entry=>entry.matches.some(host=>host!=='https://www.scdmvonline.com/*')))throw new Error('Unexpected public extension resource host.');
  for(const row of evidence){if(!(await readFile(resolve(runtimeRoot,row.file.replace(/^extension\//,'')),'utf8')).includes(row.symbol))throw new Error('Permission evidence no longer matches: '+row.permission);}
  return {version:manifest.version,review:'Current-code workflow audit; not a Web Store approval or proof of the smallest possible future architecture.',permissions:evidence,host_permissions:manifest.host_permissions,removed:['http://127.0.0.1/* optional host permission','localhost web-accessible-resource match','dynamic localhost demo content-script registration'],absent:['nativeMessaging','downloads','history','activeTab','all_urls'],retained_offscreen_reason:'AUDIO_PLAYBACK only; retired query methods do not justify permissions.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=await auditPermissions(),argument=process.argv.indexOf('--output');
  if(argument>=0){const path=resolve(process.argv[argument+1]);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(report,null,2)+'\n');}
  console.log(`Permission audit passed for ${report.version}: ${report.permissions.length} active API permissions; one live host; no localhost or broad optional hosts.`);
}
