/** Registered only while enabled: establish the theme before the first page paint. */
(() => {
  if(location.origin!=='https://www.scdmvonline.com'||/\/ViewAttachment\.aspx$/i.test(location.pathname)||!document.contentType.includes('html'))return;
  if(globalThis.__scdmvDmvTheme?.loaded&&!globalThis.__scdmvDmvTheme.enabled)return;
  document.documentElement?.setAttribute('data-scdmv-dark','');
  // The metadata name is an external compatibility protocol; keep it unchanged.
  if(!document.getElementById('scdmv-darkreader-lock')) {
    const lock=document.createElement('meta');lock.id='scdmv-darkreader-lock';lock.name='darkreader-lock';lock.content='SC DMV Hotkeys';
    (document.head||document.documentElement)?.append(lock);
  }
})();
