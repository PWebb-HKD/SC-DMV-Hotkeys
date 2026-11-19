/** One-shot fault controls kept in this demo tab's namespace; never touch installed-extension state. */
import {knownScenario,SLOW_MS,TIMEOUT_MS} from './scenario-data.js';
const key='scdmv-demo-scenario';
export function setupScenarios(){
  const select=document.getElementById('demo-scenario');if(!select)return;
  select.value=knownScenario(sessionStorage.getItem(key));select.onchange=()=>sessionStorage.setItem(key,knownScenario(select.value));
}
export function expireDemoSession(P){
  for(const name of ['auth','plate','driver','address','queue','scutties','scenario'])sessionStorage.removeItem('scdmv-demo-'+name);
  location.replace(P.login+'?expired=1');
}
/** Consume only after a known record passes validation; commit no result on an unsuccessful search. */
export function startDemoSearch({P,record,destination,resultKey}){
  const scenario=knownScenario(sessionStorage.getItem(key));sessionStorage.removeItem(key);
  const select=document.getElementById('demo-scenario');if(select)select.value='normal';
  sessionStorage.removeItem('scdmv-demo-'+resultKey);
  if(scenario==='expire-before'){expireDemoSession(P);return;}
  if(scenario==='error'){location.assign(P.error);return;}
  location.assign(destination+'?case='+record.id+(scenario==='normal'?'':'&scenario='+scenario));
}
/** Keep the ready/PDF/preview controls hidden until the simulated outcome is successful. */
export async function prepareDemoResult({P,scenario,previous,error}){
  scenario=knownScenario(scenario);
  if(!['slow','timeout','expire-results'].includes(scenario))return true;
  const pending=document.getElementById('result-pending'),message=document.getElementById('result-pending-message'),back=document.getElementById('result-pending-back');
  pending.hidden=false;back.href=previous;document.querySelector('h2').textContent='Waiting for demonstration results…';
  message.textContent=scenario==='slow'?'Simulating a two-second delay. Results are not ready yet.':scenario==='timeout'?'Simulating a search that never becomes ready. It will time out after three seconds.':'Simulating session expiration while the results page loads.';
  await new Promise(resolve=>setTimeout(resolve,scenario==='slow'?SLOW_MS:scenario==='timeout'?TIMEOUT_MS:350));
  if(scenario==='expire-results'){expireDemoSession(P);return false;}
  if(scenario==='timeout'){
    document.querySelector('h2').textContent='The demonstration search timed out.';message.textContent='No record was completed. Return to the search form and submit again; the next search defaults to Normal.';error('Demonstration search timed out. No PDF or status alert was generated.');return false;
  }
  pending.hidden=true;document.querySelector('h2').textContent='Your demonstration record is ready.';return true;
}
