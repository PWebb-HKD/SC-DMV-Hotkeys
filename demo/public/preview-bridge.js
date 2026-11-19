/* HTTP-only synthetic preview adapter. This file is outside the installed extension. */
(()=>{
  const id=new URL(location.href).searchParams.get('demo');let snapshot;
  async function load(){
    const catalog=await (await fetch('/api/cases')).json(),record=catalog.find(c=>c.id===id);
    if(!record||record.recordType==='residence')throw new Error('Choose a predefined plate or driver demonstration record.');
    const {extractDemoPdf}=await import('./report-tools.js'),{text}=await extractDemoPdf(record.id);
    if(location.pathname.endsWith('/panel.html')){
      const {recordStatus}=await import('/extension/status-alerts.js');
      const alert={...recordStatus(record.recordType==='plate'?'plate':'license',text),subject:'DEMONSTRATION · '+(record.plate||record.license||'Customer '+record.customer)};
      return {record,alert,data:alert};
    }
    const {reportBarcode}=await import('/extension/barcode-data.js');return {record,data:reportBarcode(text)};
  }
  window.chrome={runtime:{connect:()=>({postMessage(){}}),getURL:path=>new URL('/extension/'+path,location.origin).href,sendMessage:async message=>{
    if(message.type==='stop-audio')return {ok:true,value:true};
    try {
      snapshot??=load();const saved=await snapshot;
      if(message.type==='panel-data')return {ok:true,value:saved.data};
      if(message.type==='alert-owner-search'){
        if(message.id!=='demo'||saved.record.recordType!=='plate'||!Number.isInteger(message.ownerIndex)||message.ownerIndex<0)throw new Error('Choose an owner from this demonstration plate alert.');
        const number=saved.alert.owners?.[message.ownerIndex]?.number;
        const catalog=await (await fetch('/api/cases')).json(),profile=catalog.find(c=>c.recordType==='license'&&c.customer===number);
        if(!profile)throw new Error('No fictional driver profile is defined for this customer yet.');
        const target=window.open('/SCTRNS/Member/Transactions/DrvRec/Page2.aspx?case='+profile.id+'&via=customer','scdmv-demo-customer');
        if(!target)throw new Error('Allow popups on the local demo site to open this customer record.');
        setTimeout(()=>window.close(),0);return {ok:true,value:true};
      }
      throw new Error('This action is not available in the local demonstration.');
    } catch(error){return {ok:false,error:error.message};}
  }}};
})();
