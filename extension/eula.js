/** Render only packaged agreement text; agreement is affirmative and never inferred from closing. */
import {EULA_TEXT,EULA_DIGEST} from './eula-content.js';
const $=id=>document.getElementById(id);
const send=async message=>{const response=await chrome.runtime.sendMessage(message);if(!response?.ok)throw new Error(response?.error||'Agreement service unavailable.');return response.value;};
function inline(element,text){
  text.split(/(\*\*[^*]+\*\*)/g).forEach(part=>{if(part.startsWith('**')){const strong=document.createElement('strong');strong.textContent=part.slice(2,-2);element.append(strong);}else element.append(document.createTextNode(part));});
}
const fragment=document.createDocumentFragment();let list;
for(const line of EULA_TEXT.split('\n')){
  if(!line.trim()){list=null;continue;}
  if(line.startsWith('- ')){if(!list){list=document.createElement('ul');fragment.append(list);}const item=document.createElement('li');inline(item,line.slice(2));list.append(item);continue;}
  list=null;const heading=line.match(/^(#{1,2}) (.*)$/),element=document.createElement(heading?'h'+heading[1].length:'p');inline(element,heading?heading[2]:line.trim());fragment.append(element);
}
$('eulaDocument').replaceChildren(fragment);
function accepted(){
  $('agree').checked=true;$('agree').disabled=true;$('accept').disabled=true;$('decline').textContent='Close';
  $('agreementStatus').textContent='EULA accepted. Extension functions are enabled. Open the toolbar and select Keybinds to set up shortcuts.';
}
$('agree').onchange=()=>{$('accept').disabled=!$('agree').checked;};
$('acceptanceForm').onsubmit=async event=>{
  event.preventDefault();if(!$('agree').checked)return;$('accept').disabled=true;
  try{await send({type:'eula-accept',agreed:true,digest:EULA_DIGEST});accepted();}
  catch(error){$('agreementStatus').classList.add('error');$('agreementStatus').textContent=error.message;$('accept').disabled=false;}
};
$('decline').onclick=()=>{window.close();};
try{const state=await send({type:'eula-state'});if(state.accepted)accepted();else $('agree').disabled=false;}
catch(error){$('agreementStatus').classList.add('error');$('agreementStatus').textContent=error.message;}
