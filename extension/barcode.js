/**
 * Barcode popup controller. Receives an already mapped payload from the worker,
 * renders PDF417 using local BWIP-JS, and allows scale changes without changing data.
 * White quiet space is intentional so a physical scanner can read the canvas.
 */
const $ = id => document.getElementById(id);
const id = new URL(location.href).searchParams.get('id');
const port = chrome.runtime.connect({name: 'panel'});
const heartbeat = setInterval(() => {try {port.postMessage({type: 'heartbeat'});} catch {}}, 15000);
let data, expiryTimer;
// Re-rendering at another scale must not renew the barcode lifetime.
function close() {clearInterval(heartbeat); clearTimeout(expiryTimer); window.close();}
$('close').onclick = close;
document.addEventListener('keydown', event => {if (event.key === 'Escape') {event.preventDefault(); close();}});
function render() {
  if (!data) return;
  try {
    bwipjs.toCanvas($('barcode'), {bcid: 'pdf417', text: data.payload, scale: +$('scale').value, columns: 12, eclevel: 5, rowmult: 3, paddingwidth: 10, paddingheight: 10, backgroundcolor: 'FFFFFF'});
    $('error').textContent = '';
  } catch (error) {$('error').textContent = `Barcode could not be generated: ${error.message}`;}
}
$('scale').onchange = render;
try {
  const response = await chrome.runtime.sendMessage({type: 'panel-data', id});
  if (!response?.ok || response.value?.type !== 'barcode') throw new Error(response?.error || 'This barcode request has expired. Press Alt+B again.');
  data = response.value;
  $('title').textContent = data.title; $('summary').textContent = data.summary; $('profile').textContent = data.profile;
  for (const warning of data.warnings || []) {const li = document.createElement('li'); li.textContent = warning; $('warnings').append(li);}
  render(); $('close').focus();
  expiryTimer = setTimeout(close, 90000);
} catch (error) {$('error').textContent = error.message;}
