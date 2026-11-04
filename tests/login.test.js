// DOM operation tests for extension-managed credentials and form notification.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {search} from '../extension/automation.js';
import {MEMBER, LOGIN, DISCLAIMER, PDF_URL} from '../extension/core.js';
test('a login post that unloads the frame is verified at a new SCDMV URL and keeps login focused',async()=>{
  const portal={id:1,url:LOGIN,status:'complete',windowId:1};let pdf,submits=0;
  const session={lastQuery:0,portalId:1},focused=[];
  globalThis.chrome={
    storage:{session:{get:async()=>session,set:async values=>Object.assign(session,values)}},
    tabs:{onCreated:{addListener:()=>{},removeListener:()=>{}},onUpdated:{addListener:()=>{},removeListener:()=>{}},query:async()=>pdf?[{...portal},{...pdf}]:[{...portal}],get:async id=>({...id===1?portal:pdf}),update:async(id,update)=>{const tab=id===1?portal:pdf;Object.assign(tab,update);if(update.active)focused.push(id);return {...tab};}},
    windows:{get:async()=>({state:'normal'}),update:async()=>{}},
    scripting:{executeScript:async({args:[op,args]})=>{
      if(op==='state')return [{result:{url:portal.url,present:true,presentSelectors:[true,true],errors:[]}}];
      if(op==='extensionLogin'){
        assert.deepEqual(args.credentials,{user:'extension-user',password:'extension-password'});
        if(args.submit){submits++;portal.url=`${MEMBER}Home.aspx`;throw new Error('Frame was removed.');}
      }
      if(op==='click'&&args.selector==='#btnFooterNavNext')portal.url=`${MEMBER}Transactions/DrvRec/Page2.aspx?opt=CP`;
      if(op==='click'&&args.selector==='#downloadButton')pdf={id:2,url:PDF_URL,status:'complete',windowId:1,openerTabId:1};
      return [{result:true}];
    }}
  };
  const result=await search('customer','12345678',{status:()=>{},credentials:async()=>({user:'extension-user',password:'extension-password'})});
  assert.equal(result.tabId,2);assert.equal(submits,1);assert.equal(focused.at(-1),2);assert.ok(focused.includes(1));
});
