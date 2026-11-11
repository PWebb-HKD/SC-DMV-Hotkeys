/** Barcode popup controller. Show parsed data read-only, unlock it on request, and
 * redraw valid corrections locally. White quiet space keeps the canvas scannable. */
import {barcodeEditorModel, editedBarcode} from './barcode-editor.js';
const $ = id => document.getElementById(id);
const id = new URL(location.href).searchParams.get('id');
const port = chrome.runtime.connect({name:'panel'});
const heartbeat = setInterval(()=>{try{port.postMessage({type:'heartbeat'});}catch{}},15000);
let data, model, payload, deadline, expiryTimer, countdownTimer, closed = false;
const inputs = new Map();
/** Release timers before dismissing the popup; Escape and timeout share this path. */
function close() {
  if (closed) return;
  closed = true; clearInterval(heartbeat); clearTimeout(expiryTimer); clearInterval(countdownTimer); window.close();
}
/** Display remaining time from the deadline rather than accumulating timer drift. */
function tick() {
  $('countdown').textContent = `Closes in ${Math.max(0,Math.ceil((deadline-Date.now())/1000))} seconds. Press Esc to dismiss.`;
}
/** Renew the popup lifetime only at opening or when the user changes a data field. */
function resetTimeout() {
  clearTimeout(expiryTimer); deadline = Date.now()+90000; tick();
  expiryTimer = setTimeout(()=>{tick();close();},90000);
}
/** Draw only a current, valid payload. Invalid edits and encoder failures hide the
 * scanner area so a previous barcode cannot be mistaken for corrected data. */
function render() {
  $('scanArea').hidden = true;
  if (!payload) return;
  try {
    bwipjs.toCanvas($('barcode'),{bcid:'pdf417',text:payload,scale:+$('scale').value,columns:12,eclevel:5,rowmult:3,paddingwidth:10,paddingheight:10,backgroundcolor:'FFFFFF'});
    $('error').textContent = ''; $('scanArea').hidden = false;
  } catch(error) { $('error').textContent = `Barcode could not be generated: ${error.message}`; }
}
/** Validate all visible fields, replace the encoded payload, and identify errors
 * beside their human-readable labels. Invalid input never leaves an old image active. */
function update() {
  const values = Object.fromEntries([...inputs].map(([key,input])=>[key,input.value]));
  const result = editedBarcode(model,values);
  for (const [key,input] of inputs) {
    input.setAttribute('aria-invalid',String(!!result.errors[key]));
    $(`error-${key}`).textContent = result.errors[key] || '';
  }
  payload = result.payload;
  $('error').textContent = payload ? '' : 'Correct the marked fields to generate the barcode.';
  if (payload) $('summary').textContent = result.summary;
  else $('summary').textContent = 'Barcode unavailable until the marked fields are corrected.';
  render();
}
/** Build labeled text fields without maxlength truncation; oversized parsed values
 * must remain visible so the user can inspect and correct the entire value. */
function showFields() {
  for (const descriptor of model.descriptors) {
    const label = document.createElement('label'); label.htmlFor = `field-${descriptor.key}`; label.textContent = descriptor.label;
    const input = document.createElement('input'); input.id = label.htmlFor; input.type = 'text'; input.value = model.values[descriptor.key]; input.readOnly = true; input.autocomplete = 'off'; input.spellcheck = false;
    if (descriptor.format === 'date') input.placeholder = 'YYYY-MM-DD';
    const error = document.createElement('small'); error.id = `error-${descriptor.key}`; error.className = 'field-error'; input.setAttribute('aria-describedby',error.id);
    const container = document.createElement('div'); container.append(label,input,error); $('fields').append(container); inputs.set(descriptor.key,input);
    input.addEventListener('input',()=>{resetTimeout();update();});
  }
  $('editor').hidden = false;
}
$('close').onclick = close;
$('scale').onchange = render;
$('edit').onclick = () => {
  const unlock = [...inputs.values()][0].readOnly;
  for (const input of inputs.values()) input.readOnly = !unlock;
  $('edit').textContent = unlock ? 'Lock Data' : 'Edit Data';
  $('edit').setAttribute('aria-pressed',String(unlock));
  if (unlock) [...inputs.values()][0].focus();
};
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
window.addEventListener('pagehide',()=>{clearInterval(heartbeat);clearTimeout(expiryTimer);clearInterval(countdownTimer);});
try {
  const response = await chrome.runtime.sendMessage({type:'panel-data',id});
  if (!response?.ok || response.value?.type !== 'barcode') throw new Error(response?.error || 'This barcode request has expired. Press Alt+B again.');
  data = response.value; model = barcodeEditorModel(data); payload = data.payload;
  $('title').textContent = data.title; $('summary').textContent = data.summary; $('profile').textContent = data.profile;
  const notes = [...(data.parseError ? [data.parseError] : []),...(data.warnings || [])];
  $('notes').hidden = !notes.length;
  for (const warning of notes) {const li=document.createElement('li');li.textContent=warning;$('warnings').append(li);}
  showFields();
  if (model.draft) update(); else render();
  $('close').focus(); resetTimeout(); countdownTimer = setInterval(tick,1000);
} catch(error) { $('scanArea').hidden = true; $('error').textContent = error.message; }
