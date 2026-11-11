/** Right-aligned, single-column launcher. Each button delegates to the worker so
 * normal cancellation, queue behavior, and blacklist checks remain authoritative. */
import {COMMANDS} from './core.js';
import {shortcutMenuBounds} from './shortcut-menu-layout.js';
const $ = id => document.getElementById(id);
const id = new URL(location.href).searchParams.get('id');
const port = chrome.runtime.connect({name:'panel'});
const heartbeat = setInterval(()=>{try{port.postMessage({type:'heartbeat'});}catch{}},15000);
let countdownTimer, expiryTimer, submitting = false;
const deadline = Date.now()+90000;
/** Release the popup's timers without cancelling a search already selected. */
function cleanup() {clearInterval(heartbeat);clearInterval(countdownTimer);clearTimeout(expiryTimer);}
/** Dismiss without starting an action; the worker releases its captured source. */
function close() {cleanup();window.close();}
/** Use the same trusted message envelope as the extension's other views. */
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'Extension unavailable.');
  return response.value;
}
/** Measure labels and chrome decoration, fit short displays, and align the actual
 * resulting window to this display's usable right edge. No display permission is needed. */
async function fitWindow() {
  await document.fonts.ready;
  const win = await chrome.windows.getCurrent();
  const frameWidth = Math.max(0,win.width-innerWidth), frameHeight = Math.max(0,win.height-innerHeight);
  const available = {availLeft:screen.availLeft,availTop:screen.availTop,availWidth:screen.availWidth,availHeight:screen.availHeight};
  // Measure natural content before applying viewport-dependent scrolling. Compact
  // mode reduces surrounding padding, never the size or separation of touch targets.
  document.body.style.width = '';
  document.body.classList.remove('compact','scrolling');
  document.body.classList.toggle('compact',document.body.getBoundingClientRect().height+frameHeight > screen.availHeight);
  document.body.classList.toggle('scrolling',document.body.getBoundingClientRect().height+frameHeight > screen.availHeight);
  const bounds = shortcutMenuBounds({contentWidth:document.body.offsetWidth,contentHeight:document.body.getBoundingClientRect().height,frameWidth,frameHeight,...available});
  const resized = await chrome.windows.update(win.id,{width:bounds.width,height:bounds.height});
  // Window managers may impose a minimum width or height. Position using the
  // accepted outer size so those minimums do not move the right edge off screen.
  const actual = shortcutMenuBounds({contentWidth:resized.width,contentHeight:resized.height,...available});
  await chrome.windows.update(win.id,{left:actual.left,top:actual.top});
  // Fill an OS-enforced minimum width while retaining content-based sizing above.
  document.body.style.width = '100%';
}
/** Select one action once; the worker retrieves the source stored when this menu
 * opened, rather than treating the launcher itself as the focused report tab. */
async function run(command) {
  if (submitting) return;
  submitting = true;
  for (const button of $('actions').children) button.disabled = true;
  try {await send({type:'shortcut-menu-run',id,command});close();}
  catch(error) {
    submitting = false; $('error').textContent = error.message;
    for (const button of $('actions').children) button.disabled = false;
    await fitWindow().catch(()=>{});$('error').scrollIntoView({block:'nearest'});
  }
}
/** Show the deadline without extending it while the user browses menu actions. */
function tick() {$('countdown').textContent = `Closes in ${Math.max(0,Math.ceil((deadline-Date.now())/1000))} seconds. Esc to close.`;}
$('close').onclick = close;
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
window.addEventListener('pagehide',cleanup);
countdownTimer = setInterval(tick,1000); expiryTimer = setTimeout(close,90000);tick();
try {
  const data = await send({type:'panel-data',id});
  if (data?.type !== 'shortcut-menu') throw new Error('This shortcut menu has expired. Open it again.');
  for (const [command,definition] of Object.entries(COMMANDS)) {
    if (command === 'help') continue;
    const button = document.createElement('button');button.type = 'button';button.dataset.command = command;
    button.textContent = definition.menuLabel || definition.label;
    button.onclick = ()=>run(command);$('actions').append(button);
  }
  await fitWindow();$('actions').firstElementChild?.focus();
} catch(error) {$('error').textContent = error.message;await fitWindow().catch(()=>{});}
