/** Only the trusted worker controls this bundled offscreen host. The sandbox
 * prevents iframe popups/top navigation; all DOM commands go to our DMV bridge. */
const frame = document.getElementById('query'), origin='https://www.scdmvonline.com';
let job,token,url='',status='loading',sequence=0;
const pending = new Map();
const port=chrome.runtime.connect({name:'panel'});
setInterval(()=>{try{port.postMessage({type:'heartbeat'});}catch{}},15000);
const allowed = value => {const parsed=new URL(value);if(parsed.origin!==origin||!parsed.pathname.startsWith('/SCTRNS/'))throw new Error('Unsupported offscreen DMV destination.');return parsed.href;};
function loading() {
  status='loading';token=crypto.randomUUID();
  for(const request of pending.values())request.reject(new Error('The query document unloaded.'));
  pending.clear();
}
frame.addEventListener('load',()=>{
  // A framed error or blocked embedding never produces a bridge-ready reply.
  frame.contentWindow.postMessage({target:'scdmv-query',type:'init',token},origin);
});
window.addEventListener('message',event=>{
  const message=event.data;
  if(event.source!==frame.contentWindow||event.origin!==origin||message?.target!=='scdmv-host')return;
  if(message.type==='available'){frame.contentWindow.postMessage({target:'scdmv-query',type:'init',token},origin);return;}
  if(message.token!==token)return;
  if(message.type==='ready'){url=allowed(message.url);status='complete';}
  if(message.type==='unloading')loading();
  if(message.type==='reply') {
    const request=pending.get(message.id);if(!request)return;pending.delete(message.id);
    if(message.error)request.reject(new Error(message.error));else request.resolve(message.value);
  }
});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.target!=='query-host'||sender.id!==chrome.runtime.id||sender.url&&!sender.url.startsWith(chrome.runtime.getURL(''))||sender.tab)return false;
  (async()=>{
    if(message.op==='init') {
      if(job&&job!==message.job)throw new Error('A different offscreen query is already running.');
      if(!job){job=message.job;url=allowed(message.args.url);loading();frame.src=url;}
      return true;
    }
    if(!job||message.job!==job)throw new Error('Unknown offscreen query.');
    if(message.op==='state')return {url,status};
    if(message.op==='navigate'){url=allowed(message.args.url);loading();frame.src=url;return true;}
    if(message.op==='evaluate') {
      if(status!=='complete')throw new Error('Offscreen DMV frame is not ready. Embedding or session cookies may be blocked.');
      const id=++sequence;
      const result=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
      const timer=setTimeout(()=>{pending.get(id)?.reject(new Error('Offscreen DMV bridge timed out.'));pending.delete(id);},30000);
      frame.contentWindow.postMessage({target:'scdmv-query',type:'operation',token,id,...message.args},origin);
      try{return await result;}finally{clearTimeout(timer);}
    }
    throw new Error('Unknown offscreen command.');
  })().then(value=>reply({ok:true,value}),error=>reply({ok:false,error:error.message}));
  return true;
});
