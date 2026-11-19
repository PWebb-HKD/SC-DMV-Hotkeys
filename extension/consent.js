/** One-time local acceptance. Future agreement-update policy is deliberately separate. */
import {EULA_DIGEST} from './eula-content.js';
export const ACCEPTANCE_KEY='eulaAcceptance';
let opening;
export async function acceptance(api=chrome){
  const record=(await api.storage.local.get(ACCEPTANCE_KEY))[ACCEPTANCE_KEY];
  return record?.accepted===true&&Number.isFinite(record.acceptedAt)&&record.acceptedAt>0?record:null;
}
/** Reuse the review tab so repeated hotkeys cannot create a pile of agreement windows. */
export function openEula(api=chrome){
  if(opening)return opening;
  const task=(async()=>{
    const url=api.runtime.getURL('eula.html'),tabs=await api.tabs.query({url});
    const existing=tabs.find(tab=>tab.url===url&&!tab.pendingUrl);
    const tab=existing||await api.tabs.create({url,active:true});
    if(existing)await api.tabs.update(tab.id,{active:true});
    const window=await api.windows.get(tab.windowId);
    if(window.state==='minimized')await api.windows.update(tab.windowId,{state:'normal'});
    await api.windows.update(tab.windowId,{focused:true});return tab.id;
  })();
  opening=task;task.finally(()=>{if(opening===task)opening=null;}).catch(()=>{});return task;
}
export async function requireAcceptance(api=chrome){
  if(await acceptance(api))return;
  await openEula(api);
  throw new Error('Review and accept the EULA before using extension functions.');
}
/** Only the displayed agreement document can acknowledge its bundled text. */
export async function acceptEula(message,sender,api=chrome){
  if(sender.id!==api.runtime.id||sender.url!==api.runtime.getURL('eula.html')||sender.frameId!==0||message.agreed!==true||message.digest!==EULA_DIGEST)throw new Error('Accept the displayed EULA using its agreement checkbox and button.');
  const previous=await acceptance(api);if(previous)return previous;
  const record={accepted:true,acceptedAt:Date.now(),documentDigest:EULA_DIGEST};
  await api.storage.local.set({[ACCEPTANCE_KEY]:record});return record;
}
