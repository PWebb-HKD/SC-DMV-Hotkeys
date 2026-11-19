/** Fixed environments. Only an explicit extension setting selects the loopback practice portal. */
const make=(id,origin)=>Object.freeze({id,origin,member:origin+'/SCTRNS/Member/',login:origin+'/SCTRNS/Member/logon.aspx',pdf:origin+'/SCTRNS/Member/Transactions/ViewAttachment.aspx',demo:id==='demo'});
export const LIVE=make('live','https://www.scdmvonline.com');
export const DEMO=make('demo','http://127.0.0.1:4173');
export const DEMO_PERMISSION='http://127.0.0.1/*';
export const environmentOf=ctx=>ctx?.environment||ctx?.run?.environment||LIVE;
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
export function reportEnvironment(url,depth=0){
  if(depth>3)return undefined;
  try{
    const u=new URL(url);
    if(['chrome-extension:','chrome:','edge:','chrome-untrusted:'].includes(u.protocol)){
      const source=reportEnvironment(u.hash.slice(1),depth+1);if(source)return source;
      for(const key of ['src','file','url','originalUrl','streamUrl']){const nested=reportEnvironment(u.searchParams.get(key),depth+1);if(nested)return nested;}
    }
    return [LIVE,DEMO].find(env=>u.origin===env.origin&&u.pathname.toLowerCase()===new URL(env.pdf).pathname.toLowerCase());
  }catch{return undefined;}
}
