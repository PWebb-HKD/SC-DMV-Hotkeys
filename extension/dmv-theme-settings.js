/** DMV-only appearance settings. Content scripts receive a boolean, never vault/session data. */
import {ROOT, isPortal as isDmvThemePage} from './core.js';
// Use the shared DMV HTML-tab predicate so theme scope and automation scope cannot diverge.
export {isDmvThemePage};
const SCRIPT_ID='scdmv-native-dark-start';
/** Register or remove the early-paint stylesheet according to the persistent, default-enabled setting. */
export async function configureDmvTheme() {
  const {dmvDarkMode}=await chrome.storage.local.get('dmvDarkMode');
  const enabled=dmvDarkMode!==false;
  const existing=await chrome.scripting.getRegisteredContentScripts({ids:[SCRIPT_ID]});
  if(enabled) {
    const script={id:SCRIPT_ID,matches:[`${ROOT}/*`],excludeMatches:[`${ROOT}/SCTRNS/Member/Transactions/ViewAttachment.aspx*`],js:['dmv-theme-start.js'],css:['dmv-theme.css'],runAt:'document_start',allFrames:true,persistAcrossSessions:true};
    if(existing.length)await chrome.scripting.updateContentScripts([script]);else await chrome.scripting.registerContentScripts([script]);
  } else if(existing.length)await chrome.scripting.unregisterContentScripts({ids:[SCRIPT_ID]});
  return enabled;
}
/** Apply privileged appearance CSS to the authorized sender document and return only the enabled flag. */
export async function initDmvTheme(sender) {
  const {dmvDarkMode}=await chrome.storage.local.get('dmvDarkMode');
  const enabled=dmvDarkMode!==false;
  const target={tabId:sender.tab.id,...(sender.documentId?{documentIds:[sender.documentId]}:{frameIds:[sender.frameId]})};
  const css={target,files:['dmv-theme.css'],origin:'USER'};
  if(enabled)await chrome.scripting.insertCSS(css);else await chrome.scripting.removeCSS(css);
  return {enabled};
}
/** Refresh open DMV HTML tabs independently; one inaccessible tab must not block the others. */
export async function refreshDmvThemeTabs() {
  const tabs=(await chrome.tabs.query({url:`${ROOT}/*`})).filter(tab=>isDmvThemePage(tab.url));
  await Promise.allSettled(tabs.map(async tab=>{
    // The controller is idempotent. Existing matching subframes receive the message too.
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['dmv-theme.js']});
    await chrome.tabs.sendMessage(tab.id,{type:'dmv-theme-changed'});
  }));
}
