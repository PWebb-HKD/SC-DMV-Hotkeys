/** Packaged-page endpoint for the shared DOM operations. No page-supplied script is evaluated. */
import {pageOperation} from '../page.js';
const root=chrome.runtime.getURL('demo/');
if(location.href.startsWith(root+'SCTRNS/')){
  const originalOpen=window.open;
  window.open=(value,name,features)=>{
    const url=new URL(String(value||''),location.href);
    if(url.href.startsWith(root+'reports/')&&/\/[A-Z0-9]+\.pdf$/.test(url.pathname)){
      chrome.runtime.sendMessage({type:'demo-report-open',url:url.href}).then(response=>{
        if(!response?.ok){const error=document.getElementById('demo-error');error.textContent=response?.error||'Enable Demo Mode to open this report.';error.closest('[role="alert"]').hidden=false;}
      });
      return {focus(){},close(){},closed:false};
    }
    return originalOpen.call(window,value,name,features);
  };
  let port;
  const connect=()=>{
    port?.disconnect();const active=chrome.runtime.connect({name:'demo-page'});port=active;
    active.onMessage.addListener(async message=>{
      try{const value=await pageOperation(message.op,{...message.args,demo:true,demoRoot:root});active.postMessage({id:message.id,ok:true,value});}
      catch(error){try{active.postMessage({id:message.id,ok:false,error:error.message});}catch{}}
    });
  };
  connect();
  chrome.runtime.onMessage.addListener((message,sender)=>{
    if(message.target!=='demo-page'||message.type!=='reconnect'||sender.id!==chrome.runtime.id)return;
    chrome.tabs.getCurrent().then(tab=>{if(tab?.id===message.tabId)connect();}).catch(()=>{});
  });
  if(Number(sessionStorage.getItem('__scDmvBackgroundReport'))>Date.now())pageOperation('startBackgroundReport',{demo:true,demoRoot:root,persistent:true});
}
