/** Fixed live service and self-contained packaged practice environment. */
import {DEMO_REPORT_IDS} from './demo/report-ids.js';
const make=(id,root)=>{
  const demo=id==='demo',member=root+'SCTRNS/Member/';
  return Object.freeze({id,root,origin:new URL(root).protocol+'//'+new URL(root).host,member,login:member+(demo?'logon.html':'logon.aspx'),pdf:demo?root+'reports/':member+'Transactions/ViewAttachment.aspx',demo});
};
export const LIVE=make('live','https://www.scdmvonline.com/');
/** Resolve the extension's own root; explicit bases are used by the browser/API fixtures. */
export function demoEnvironment(base=globalThis.chrome?.runtime?.getURL?.('')||new URL('./',import.meta.url).href){return make('demo',new URL('demo/',base).href);}
export const environmentOf=ctx=>ctx?.environment||ctx?.run?.environment||LIVE;
export const sameAuthority=(a,b)=>a.protocol===b.protocol&&a.host===b.host;
export function memberPage(environment,path){return environment.member+path.replace(/\.aspx(?=[?#]|$)/i,environment.demo?'.html':'.aspx');}
export function reportUrlFor(environment,id){if(!environment.demo||!DEMO_REPORT_IDS.includes(id))throw new Error('Choose a packaged synthetic report.');return environment.pdf+id+'.pdf';}
/** Only generated reports inside this extension's demo directory are report sources. */
export function isDemoReport(url,environment){try{const source=new URL(url),root=new URL(environment.pdf);return sameAuthority(source,root)&&source.pathname.startsWith(root.pathname)&&DEMO_REPORT_IDS.includes(source.pathname.slice(root.pathname.length).replace(/\.pdf$/,''))&&source.pathname.endsWith('.pdf');}catch{return false;}}
const PRIVATE_KEYS=new Set(['history','queue','status','portalId','lastQuery','pdfCreated','pdfSources','pdfViewSources','tabCreated','credentials','blacklist','vaultKey','unlockedVault']);
const privateKey=key=>PRIVATE_KEYS.has(key)||key.startsWith('pdf:');
/** Namespace only workflow state; preferences/panel ownership stay shared. The environment is immutable per facade. */
export function environmentApi(api,environment=LIVE){
  if(!environment.demo)return api;
  const name=key=>privateKey(key)?'demo:'+key:key,session=api.storage.session;
  const scoped={
    async get(keys){
      if(keys==null){const values=await session.get(null);return Object.fromEntries(Object.entries(values).filter(([k])=>k.startsWith('demo:')||!privateKey(k)).map(([k,v])=>[k.startsWith('demo:')?k.slice(5):k,v]));}
      const list=typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys),values=await session.get(list.map(name));
      return Object.fromEntries(list.map(key=>[key,values[name(key)]??(!Array.isArray(keys)&&typeof keys==='object'?keys[key]:undefined)]));
    },
    set:values=>session.set(Object.fromEntries(Object.entries(values).map(([k,v])=>[name(k),v]))),
    remove:keys=>session.remove((Array.isArray(keys)?keys:[keys]).map(name))
  };
  return {...api,storage:{...api.storage,session:scoped}};
}
/** Classify only fixed attachment endpoints, including this extension's reader fragment. */
export function reportEnvironment(url,depth=0,demo=demoEnvironment()){
  if(depth>3)return undefined;
  try{
    const u=new URL(url);
    if(isDemoReport(url,demo))return demo;
    const reader=new URL('../reader.html',demo.root);
    if(sameAuthority(u,reader)&&u.pathname===reader.pathname&&u.searchParams.get('pdf')==='1')return reportEnvironment(u.hash.slice(1),depth+1,demo);
    if(['chrome-extension:','chrome:','edge:','chrome-untrusted:'].includes(u.protocol)){
      const source=reportEnvironment(u.hash.slice(1),depth+1,demo);if(source)return source;
      for(const key of ['src','file','url','originalUrl','streamUrl']){const nested=reportEnvironment(u.searchParams.get(key),depth+1,demo);if(nested)return nested;}
    }
    return u.origin===LIVE.origin&&u.pathname.toLowerCase()===new URL(LIVE.pdf).pathname.toLowerCase()?LIVE:undefined;
  }catch{return undefined;}
}
