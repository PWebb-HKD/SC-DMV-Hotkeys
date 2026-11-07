/** Print the immutable captured PDF through Chromium, not the virtualized HTML pages. */
export function installNativePrint(documentReady, signal) {
  const button=document.getElementById('pdfPrint'),status=document.getElementById('pdfPrintStatus');
  let blobUrl,opening=false,disposed=false;
  button.disabled=true;
  documentReady.then(()=>{if(!disposed)button.disabled=false;},()=>{});
  const print=async()=>{
    if(opening||disposed)return;
    opening=true;button.disabled=true;status.classList.remove('error');status.setAttribute('role','status');status.textContent='Preparing original PDF for printing…';
    try {
      const doc=await documentReady;signal.throwIfAborted();
      if(!blobUrl) {
        const bytes=await doc.getData();signal.throwIfAborted();
        if(disposed)return;
        blobUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      }
      const response=await chrome.runtime.sendMessage({type:'pdf-native-print',url:blobUrl});
      if(!response?.ok)throw new Error(response?.error||'Could not open the original PDF.');
      status.textContent='Original PDF opened. Use its Print button or print shortcut.';
    } catch(error) {
      if(!disposed){status.classList.add('error');status.setAttribute('role','alert');status.textContent=signal.aborted?'Report loading stopped. Run the search again before printing.':`Unable to open PDF for printing: ${error.message}`;}
    } finally {opening=false;if(!disposed)button.disabled=false;}
  };
  const keydown=event=>{
    if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='p') {
      event.preventDefault();event.stopPropagation();if(!event.repeat)print();
    }
  };
  button.onclick=print;window.addEventListener('keydown',keydown,true);
  const dispose=()=>{disposed=true;button.disabled=true;window.removeEventListener('keydown',keydown,true);if(blobUrl)URL.revokeObjectURL(blobUrl);};
  signal.addEventListener('abort',dispose,{once:true});window.addEventListener('beforeunload',dispose,{once:true});
}
