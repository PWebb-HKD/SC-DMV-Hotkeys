/** Local SCUTTIES simulation. Never submits names/DOBs, authenticates remotely or uses extension storage. */
import {driverIdentity} from '/extension/core.js';
const stateKey='scdmv-demo-scutties';
export async function setupScutties(error){
  const $=id=>document.getElementById(id),response=await fetch('/api/scutties');
  if(!response.ok)throw new Error('Demo citations unavailable.');
  const catalog=await response.json(),last=$('scutties-last'),dob=$('scutties-dob'),search=$('scutties-search');
  let selected=null,openedNumber=null;
  const clearError=()=>{$('demo-error').closest('[role="alert"]').hidden=true;};
  const save=entry=>sessionStorage.setItem(stateKey,JSON.stringify({caseId:selected.id,entry:entry||null}));
  const resetResults=()=>{
    selected=null;openedNumber=null;sessionStorage.removeItem(stateKey);$('scutties-rows').replaceChildren();$('scutties-results').hidden=true;
    $('display').hidden=true;$('home').hidden=false;$('scutties-details').replaceChildren();
  };
  const enable=()=>{search.disabled=!(last.value.trim()&&dob.value.trim());};
  const details=number=>{
    const entry=selected?.citations.find(c=>c.number===number);if(!entry){resetResults();error('Choose a citation from a valid demonstration search.');return;}
    const sections=[
      ['Citation',[['Citation number',entry.number],['Issuing agency',entry.agency],['Violation date',entry.date],['Statute',entry.statute],['Offense',entry.offense],['Disposition',entry.disposition]]],
      ['Violator',[['Name',`${entry.lastName}, ${entry.first}`],['Birth date',entry.dob],['DL number',entry.license],['State',entry.state],['Address',`${entry.address}, ${entry.city}, ${entry.state} ${entry.zip}`]]],
      ['Vehicle',[['Vehicle',entry.vehicle],['Plate',entry.plate]]],
      ['Court and officer',[['Court',entry.court],['Date and time of trial',entry.trial],['Officer',entry.officer]]],
      ['Violation Location',[['Location',entry.location],['City',entry.city],['County',entry.county],['Notes',entry.notes]]]
    ];
    $('scutties-details').replaceChildren();
    for(const [title,fields] of sections){
      const section=document.createElement('section'),heading=document.createElement('h3'),list=document.createElement('dl');
      section.className='scutties-detail-section';heading.textContent=title;list.className='scutties-detail-fields';
      for(const [label,value] of fields){const field=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;field.append(dt,dd);list.append(field);}
      section.append(heading,list);$('scutties-details').append(section);
    }
    openedNumber=entry.number;$('scutties-detail-heading').textContent='Citation '+entry.number;$('home').hidden=true;$('display').hidden=false;save(entry.number);$('scutties-detail-heading').focus();
  };
  const showResults=record=>{
    selected=record;$('scutties-rows').replaceChildren();$('scutties-results').hidden=false;
    $('scutties-result-count').textContent=record?.citations.length?`${record.citations.length} fictional citation${record.citations.length===1?'':'s'} found.`:'No fictional citations found for this last name and date of birth.';
    $('scutties-results').querySelector('.scutties-table-scroll').hidden=!record?.citations.length;
    for(const entry of record?.citations||[]){
      const row=document.createElement('tr'),cell=document.createElement('td'),view=document.createElement('button');
      view.type='button';view.className='secondary';view.textContent='View';view.setAttribute('aria-label','View '+entry.number);view.setAttribute('ng-click','grid.appScope.gridRowView(row.entity.CitationNumber)');
      view.onclick=()=>details(entry.number);cell.append(view);row.append(cell);
      for(const value of [entry.number,`${entry.lastName}, ${entry.first}`,entry.dob,entry.license,entry.state,entry.date,entry.statute,entry.disposition]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
      $('scutties-rows').append(row);
    }
    if(record)save();
  };
  const sample=id=>{
    const record=catalog.find(c=>c.id===id);resetResults();clearError();
    if(!record){error('Unknown SCUTTIES demonstration sample.');return;}
    last.value=record.lastName;dob.value=record.dob;enable();
  };
  for(const control of [last,dob])control.addEventListener('input',()=>{resetResults();clearError();enable();});
  $('form1').addEventListener('submit',event=>{
    event.preventDefault();resetResults();clearError();
    try {
      const name=last.value.trim().replace(/\s+/g,' ').toUpperCase(),birth=dob.value.trim();
      if(!name||name.length>60||!/^\d{2}\/\d{2}\/\d{4}$/.test(birth))throw new Error('Enter a last name and a valid date of birth in MM/DD/YYYY format.');
      // Reuse the production calendar check without interpreting the name as report markup.
      driverIdentity(`Driver License No: 0 Name: DEMO,\nDOB: ${birth}`);
      showResults(catalog.find(c=>c.lastName===name&&c.dob===birth));
    } catch(problem){error(problem.message);}
  });
  $('scutties-clear').onclick=()=>{resetResults();clearError();last.value='';dob.value='';enable();last.focus();};
  $('scutties-home').onclick=()=>{$('display').hidden=true;$('home').hidden=false;save();$('scutties-details').replaceChildren();const buttons=[...$('scutties-rows').querySelectorAll('button')];(buttons.find(b=>b.getAttribute('aria-label')==='View '+openedNumber)||last).focus();openedNumber=null;};
  $('scutties-print').onclick=()=>window.print();
  for(const button of document.querySelectorAll('[data-scutties-sample]'))button.onclick=()=>sample(button.dataset.scuttiesSample);
  last.disabled=false;dob.disabled=false;$('scutties-clear').disabled=false;
  const params=new URL(location.href).searchParams;
  if(params.has('sample'))sample(params.get('sample'));
  else {
    try {
      const saved=JSON.parse(sessionStorage.getItem(stateKey)||'null');
      if(saved){const record=catalog.find(c=>c.id===saved.caseId);if(!record||saved.entry&&!record.citations.some(c=>c.number===saved.entry))throw new Error('Invalid demo selection');last.value=record.lastName;dob.value=record.dob;showResults(record);if(saved.entry)details(saved.entry);}
    }catch{resetResults();error('The saved demonstration citation is unavailable. Choose a sample and search again.');}
  }
  enable();
}
