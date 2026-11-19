/** Address packaged demo documents through owned ports; never inject scripts into extension pages. */
import {demoEnvironment} from './environment.js';
const documents=new Map();
const operations=new Set(['state','fill','click','extensionLogin','notifyInputs','startBackgroundReport','backgroundReport','stopBackgroundReport','fetchPdf']);
/** Only this extension's top-level packaged transaction documents may register. */
export function connectDemoPage(port){
  if(port.name!=='demo-page')return false;
  const root=demoEnvironment(),sender=port.sender;
  if(sender?.id!==chrome.runtime.id||sender.tab?.id==null||sender.frameId!==0||typeof sender.documentId!=='string'||!sender.url?.startsWith(root.member)){port.disconnect();return true;}
  const pending=new Map(),entry={port,url:sender.url,documentId:sender.documentId,pending};
  const previous=documents.get(sender.tab.id);previous?.port.disconnect();documents.set(sender.tab.id,entry);
  port.onMessage.addListener(message=>{
    const request=pending.get(message.id);if(!request)return;pending.delete(message.id);
    if(message.ok)request.resolve(message.value);else request.reject(new Error(String(message.error||'Demo operation failed.').slice(0,1500)));
  });
  port.onDisconnect.addListener(()=>{
    if(documents.get(sender.tab.id)===entry)documents.delete(sender.tab.id);
    for(const request of pending.values())request.reject(new Error('Demo document was unloaded.'));pending.clear();
  });
  return true;
}
/** Bind every operation to the currently committed tab/document and the captured SearchRun. */
export async function demoOperation(tabId,op,args={},run){
  if(!operations.has(op))throw new Error('Unsupported demo operation.');
  const root=run?.environment||demoEnvironment(),end=Date.now()+10000;
  let entry,requestedDocument;
  while(Date.now()<end){
    run?.check();entry=documents.get(tabId);
    // webNavigation excludes chrome-extension documents in normal Chrome builds.
    // Runtime contexts identify our own current document without another host grant.
    const [tab,contexts]=await Promise.all([chrome.tabs.get(tabId),chrome.runtime.getContexts({tabIds:[tabId]})]);
    const current=contexts.find(context=>context.tabId===tabId&&context.frameId===0&&context.documentUrl===tab.url&&context.documentUrl?.startsWith(root.member));
    if(!tab.pendingUrl&&current){
      if(entry&&entry.url===current.documentUrl&&entry.documentId===current.documentId)break;
      // An idle worker can lose its port map while the practice tab remains open.
      // Reconnect on demand, rather than keeping the worker alive while idle.
      if(requestedDocument!==current.documentId){
        requestedDocument=current.documentId;
        await chrome.runtime.sendMessage({target:'demo-page',type:'reconnect',tabId}).catch(()=>{});
      }
    }
    entry=null;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  run?.check();if(!entry)throw new Error('The packaged demo page is not ready. Open the practice portal and try again.');
  if(!root.demo||!entry.url.startsWith(root.member))throw new Error('The demo page belongs to a different environment.');
  const id=crypto.randomUUID(),result=new Promise((resolve,reject)=>{
    entry.pending.set(id,{resolve,reject});
    try{entry.port.postMessage({id,op,args:{...args,demo:true,demoRoot:root.root}});}catch(error){entry.pending.delete(id);reject(error);}
  });
  try{return run?await run.step(()=>result):await result;}finally{entry.pending.delete(id);}
}
