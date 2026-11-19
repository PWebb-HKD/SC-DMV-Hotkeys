/** Client-only synthetic state. No production credentials, vault or query endpoint is used. */
import {normalize,ownerNumbers} from '/extension/core.js';
import {extractDemoPdf} from './report-tools.js';
const page=document.body.dataset.demoPage,$=id=>document.getElementById(id),params=new URL(location.href).searchParams;
const error=message=>{const target=$('demo-error');target.textContent=message;target.closest('[role="alert"]').hidden=false;};
const reset=()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('scdmv-demo-'))sessionStorage.removeItem(key);};
function queueState(){try {const q=JSON.parse(sessionStorage.getItem('scdmv-demo-queue'));return Array.isArray(q?.customers)&&Number.isInteger(q.index)?q:null;}catch{return null;}}
async function setup(){
  const [P,catalog]=await Promise.all(['/api/paths','/api/cases'].map(path=>fetch(path).then(response=>{if(!response.ok)throw new Error('Demo catalog unavailable.');return response.json();})));
  $('reset-demo').addEventListener('click',reset);
  $('demo-logoff')?.addEventListener('click',reset);
  if(!['home','login'].includes(page)&&sessionStorage.getItem('scdmv-demo-auth')!=='true'){location.replace(P.login);return;}
  const customer=number=>catalog.find(c=>c.recordType==='license'&&c.customer===number);
  const openCustomer=(number,queued=false)=>{
    const record=customer(number);if(!record)throw new Error('No fictional driver profile is defined for this customer yet.');
    location.assign(P.driverResult+'?case='+record.id+'&via=customer'+(queued?'&queue=1':''));
  };
  if(page==='login'){
    $('form1').addEventListener('submit',event=>{
      event.preventDefault();const user=$('ContentPlaceHolder1_userNameText'),password=$('ContentPlaceHolder1_passwordText');
      const accepted=user.value==='demo'&&password.value==='demo';password.value='';
      if(!accepted){error('Use the demonstration User ID demo and password demo. Do not enter real credentials.');return;}
      sessionStorage.setItem('scdmv-demo-auth','true');location.assign(P.disclaimer);
    });
    for(const id of ['ContentPlaceHolder1_userNameText','ContentPlaceHolder1_passwordText','ContentPlaceHolder1_loginButton'])$(id).disabled=false;
  }
  if(page==='disclaimer')$('form1').addEventListener('submit',event=>{event.preventDefault();location.assign(P.menu);});
  if(['search','driver-search','address-search'].includes(page)){
    const requested=params.get(page==='search'?'plate':'number');
    const initialField=page==='search'?'ContentPlaceHolder1_txtPlateNbr':page==='address-search'?'ContentPlaceHolder1_txtDLNumber':params.get('mode')==='customer'?'ContentPlaceHolder1_idNumberTextBox':'ContentPlaceHolder1_dlNumberTextBox';
    if(requested&&requested.length<40)$(initialField).value=requested;
    $('form1').addEventListener('submit',event=>{
      event.preventDefault();
      try {
        let value,record,destination,key;
        if(page==='search'){
          value=normalize('plate',$('ContentPlaceHolder1_txtPlateNbr').value);record=catalog.find(c=>c.recordType==='plate'&&c.plate===value);
          destination=P.result;key='plate';
        } else if(page==='address-search'){
          value=normalize('license',$('ContentPlaceHolder1_txtDLNumber').value);record=catalog.find(c=>c.recordType==='residence'&&c.license===value);
          destination=P.addressResult;key='address';
        } else {
          const dl=$('ContentPlaceHolder1_dlNumberTextBox').value.trim(),number=$('ContentPlaceHolder1_idNumberTextBox').value.trim();
          if(!!dl===!!number){error('Enter either a DL number or a customer number, not both.');return;}
          value=normalize(dl?'license':'customer',dl||number);
          record=catalog.find(c=>c.recordType==='license'&&(dl?c.license===value:c.customer===value));
          destination=P.driverResult;key='driver';
        }
        if(!record){error('No demonstration record was found. Use one of the listed fictional numbers.');return;}
        sessionStorage.setItem('scdmv-demo-'+key,record.id);
        location.assign(destination+'?case='+record.id);
      } catch(problem){error(problem.message);}
    });
  }
  if(!['result','driver-result','address-result'].includes(page))return;
  const type=page==='result'?'plate':page==='driver-result'?'license':'residence';
  const key=type==='plate'?'plate':type==='license'?'driver':'address';
  const id=params.has('case')?params.get('case'):sessionStorage.getItem('scdmv-demo-'+key);
  const record=catalog.find(c=>c.id===id&&c.recordType===type);
  if(!record){$('result-kind').closest('.card').hidden=true;document.querySelector('h2').textContent='Choose a valid demonstration record.';error('No valid demonstration result was selected. Return to the search form.');return;}
  sessionStorage.setItem('scdmv-demo-'+key,record.id);
  $('result-kind').textContent=record.title;$('result-plate').textContent=record.plate||record.license||'Customer '+record.customer;
  $('result-description').textContent=record.description;$('ContentPlaceHolder1_dlNbrBox_DisplayOnly').textContent=record.plate||record.license||record.customer;
  const pdf=()=>window.open(P.pdf+'?case='+record.id,'scdmv-demo-report');
  $('downloadButton').onclick=pdf;$('ContentPlaceHolder1_btnPrint').onclick=pdf;
  for(const action of ['status','barcode'])if($('preview-'+action))$('preview-'+action).onclick=()=>window.open('/extension/'+(action==='status'?'panel':'barcode')+'.html?id=demo&demo='+record.id,'scdmv-demo-'+action,'popup,width='+(action==='status'?650:1000)+',height=800');
  if(type==='residence'){
    const collect=$('collect-customers');collect.disabled=true;
    const {text}=await extractDemoPdf(record.id),numbers=ownerNumbers(text);
    if(!numbers.length||!numbers.every(number=>customer(number)))throw new Error('A residence customer is not represented in the demo catalog.');
    for(const number of numbers){
      const profile=customer(number),row=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.className='secondary';button.textContent=`EXAMPLE, ${profile.first} · Customer ${number}`;
      button.onclick=()=>openCustomer(number);row.append(button);$('residence-customers').append(row);
    }
    collect.disabled=false;collect.onclick=()=>{
      const queue={customers:numbers,index:numbers.length>=2?1:0};sessionStorage.setItem('scdmv-demo-queue',JSON.stringify(queue));openCustomer(numbers[queue.index],true);
    };
  }
  const queue=queueState();
  if(type==='license'&&params.get('queue')==='1'&&queue&&queue.customers[queue.index]===record.customer&&queue.customers.every(number=>customer(number))){
    $('queue-controls').hidden=false;$('queue-position').textContent=`Customer ${queue.index+1} of ${queue.customers.length} · ${record.customer}`;
    $('queue-previous').disabled=queue.index===0;$('queue-next').disabled=queue.index>=queue.customers.length-1;
    const move=step=>{const index=queue.index+step;if(index<0||index>=queue.customers.length)return;sessionStorage.setItem('scdmv-demo-queue',JSON.stringify({...queue,index}));openCustomer(queue.customers[index],true);};
    $('queue-previous').onclick=()=>move(-1);$('queue-next').onclick=()=>move(1);
    $('queue-clear').onclick=()=>{sessionStorage.removeItem('scdmv-demo-queue');$('queue-controls').hidden=true;};
  }
}
setup().catch(()=>error('The local demonstration could not load. Check the server and try again.'));
