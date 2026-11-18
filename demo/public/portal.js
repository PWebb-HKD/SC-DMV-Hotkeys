/** Client-only mock state: never send or retain credential input values. */
const P={login:'/SCTRNS/Member/logon.aspx',disclaimer:'/SCTRNS/Member/Disclaimer.aspx',menu:'/SCTRNS/Member/Transactions/TransactionList.aspx',search:'/SCTRNS/Member/Transactions/VehRec/Page1.aspx',result:'/SCTRNS/Member/Transactions/VehRec/Page2.aspx',pdf:'/SCTRNS/Member/Transactions/ViewAttachment.aspx'};
const page=document.body.dataset.demoPage,$=id=>document.getElementById(id);
const error=message=>{const target=$('demo-error');target.textContent=message;target.closest('[role="alert"]').hidden=false;};
const reset=()=>{sessionStorage.removeItem('scdmv-demo-auth');sessionStorage.removeItem('scdmv-demo-plate');};
$('reset-demo').addEventListener('click',reset);
if($('demo-logoff'))$('demo-logoff').addEventListener('click',reset);
if(!['home','login'].includes(page)&&sessionStorage.getItem('scdmv-demo-auth')!=='true')location.replace(P.login);
const cases=fetch('/api/cases').then(response=>response.json());
const currentPlate=()=>sessionStorage.getItem('scdmv-demo-plate');
if(page==='login')$('form1').addEventListener('submit',event=>{
  event.preventDefault();
  const user=$('ContentPlaceHolder1_userNameText'),password=$('ContentPlaceHolder1_passwordText');
  const accepted=user.value==='demo'&&password.value==='demo';password.value='';
  if(!accepted){error('Use the demonstration User ID demo and password demo. Do not enter real credentials.');return;}
  sessionStorage.setItem('scdmv-demo-auth','true');location.assign(P.disclaimer);
});
// No native credential submission is possible before the local handler is ready.
if(page==='login')for(const id of ['ContentPlaceHolder1_userNameText','ContentPlaceHolder1_passwordText','ContentPlaceHolder1_loginButton'])$(id).disabled=false;
if(page==='disclaimer')$('form1').addEventListener('submit',event=>{event.preventDefault();location.assign(P.menu);});
if(page==='search'){
  const requested=new URL(location.href).searchParams.get('plate');
  if(requested&&/^DEMO00[1-6]$/.test(requested))$('ContentPlaceHolder1_txtPlateNbr').value=requested;
  $('form1').addEventListener('submit',async event=>{
    event.preventDefault();
    try {
      const plate=$('ContentPlaceHolder1_txtPlateNbr').value.trim().toUpperCase();
      if(!(await cases).some(record=>record.plate===plate)){error('No demonstration record was found. Use DEMO001 through DEMO006.');return;}
      sessionStorage.setItem('scdmv-demo-plate',plate);location.assign(P.result);
    } catch {error('The local demonstration server is unavailable.');}
  });
}
if(page==='result'){
  try {
    const record=(await cases).find(record=>record.plate===currentPlate());
    if(!record)location.replace(P.search);
    else {
      $('result-kind').textContent=record.title;$('result-plate').textContent=record.plate;$('result-description').textContent=record.description;
      const pdf=()=>window.open(P.pdf+'?case='+record.plate,'scdmv-demo-report');
      $('downloadButton').onclick=pdf;$('ContentPlaceHolder1_btnPrint').onclick=pdf;
      for(const type of ['status','barcode'])$('preview-'+type).onclick=()=>window.open('/extension/'+(type==='status'?'panel':'barcode')+'.html?id=demo&demo='+record.plate,'scdmv-demo-'+type,'popup,width='+(type==='status'?650:1000)+',height=800');
    }
  } catch {error('The local demonstration server is unavailable.');}
}
