/** Appearance only: never read/write form values or invoke a DMV transaction. */
(() => {
  if(location.origin!=='https://www.scdmvonline.com'||/\/ViewAttachment\.aspx$/i.test(location.pathname)||!document.contentType.includes('html'))return;
  if(globalThis.__scdmvDmvTheme){globalThis.__scdmvDmvTheme.refresh();return;}
  let generation=0,head;
  const state={enabled:document.documentElement.hasAttribute('data-scdmv-dark'),loaded:false,refresh};
  globalThis.__scdmvDmvTheme=state;
  const observer=new MutationObserver(()=>ensureLock());
  /** Maintain the theme-coexistence marker across head replacement without inspecting form contents. */
  function ensureLock() {
    if(!state.enabled)return;
    let lock=document.getElementById('scdmv-darkreader-lock');
    // Keep the external compatibility metadata name stable; the marker itself contains no private data.
    if(!lock){lock=document.createElement('meta');lock.id='scdmv-darkreader-lock';lock.name='darkreader-lock';lock.content='SC DMV Hotkeys';}
    const parent=document.head||document.documentElement;
    if(lock.parentNode!==parent)parent.append(lock);
    if(document.head&&head!==document.head){head=document.head;observer.observe(head,{childList:true});}
  }
  /** Toggle the root style marker and its observer; remove only this extension's coexistence marker on disable. */
  function apply(enabled) {
    state.enabled=enabled;state.loaded=true;
    document.documentElement.toggleAttribute('data-scdmv-dark',enabled);
    observer.disconnect();head=null;
    if(enabled){observer.observe(document.documentElement,{childList:true});ensureLock();}
    else document.getElementById('scdmv-darkreader-lock')?.remove();
  }
  /** Request the appearance flag and discard replies superseded by a newer refresh. */
  async function refresh() {
    const token=++generation;
    try {
      const response=await chrome.runtime.sendMessage({type:'dmv-theme-init'});
      if(token!==generation)return;
      if(!response?.ok)throw new Error(response?.error||'DMV theme unavailable.');
      apply(response.value.enabled===true);
    } catch {if(token===generation)apply(state.enabled);}
  }
  chrome.runtime.onMessage.addListener(message=>{if(message.type==='dmv-theme-changed')refresh();});
  if(state.enabled){observer.observe(document.documentElement,{childList:true});ensureLock();}
  refresh();
})();
