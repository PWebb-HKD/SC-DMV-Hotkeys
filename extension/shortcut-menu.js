/** Right-aligned, single-column launcher. Each button delegates to the worker so
 * normal cancellation, queue behavior, and blacklist checks remain authoritative. */
import {COMMANDS} from './core.js';
import {shortcutMenuBounds} from './shortcut-menu-layout.js';
let menuDocument = document, floatingWindow = null, closing = false, pinning = false, pinEnabled = false;
const $ = id => menuDocument.getElementById(id);
const id = new URL(location.href).searchParams.get('id');
const port = chrome.runtime.connect({name:'panel'});
const heartbeat = setInterval(()=>{try{port.postMessage({type:'heartbeat'});}catch{}},15000);
let countdownTimer, expiryTimer, submitting = false;
let deadline, timeoutSettingsChanged = false, pinSettingsChanged = false, noTimeoutEnabled = false;
/** Release the popup's timers without cancelling a search already selected. */
function cleanup() {clearInterval(heartbeat);clearInterval(countdownTimer);clearTimeout(expiryTimer);}
/** Dismiss without starting an action; the worker releases its captured source. */
function close() {if (closing) return;closing = true;cleanup();floatingWindow?.close();window.close();}
/** Use the same trusted message envelope as the extension's other views. */
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'Extension unavailable.');
  return response.value;
}
/** Measure labels and chrome decoration, fit short displays, and align the actual
 * resulting window to this display's usable right edge. No display permission is needed. */
async function fitWindow() {
  if (floatingWindow) return;
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
/** Change only menu expiry; disabling persistent mode starts a fresh countdown. */
function configureExpiry(noTimeout) {
  clearInterval(countdownTimer); clearTimeout(expiryTimer);
  if (noTimeout) { $('countdown').textContent = 'No time limit. Esc to close.'; return; }
  deadline = Date.now()+90000;
  countdownTimer = setInterval(tick,1000); expiryTimer = setTimeout(close,90000);tick();
}
/** Move the existing controls and listeners into a browser-owned floating window.
 * Chrome requires real user activation, so entry uses the menu pin button. */
async function pinMenu() {
  if (floatingWindow || pinning || !pinEnabled || !$('pinMenu')) return;
  if (!window.documentPictureInPicture) {
    $('pinMenu').disabled = true;
    $('pinHelp').textContent = 'Picture-in-Picture is unavailable in this browser. The menu will stay open here.';
    return;
  }
  pinning = true;
  try {
    const pip = await window.documentPictureInPicture.requestWindow({width:Math.ceil(document.body.offsetWidth),height:Math.min(screen.availHeight,Math.ceil(document.body.getBoundingClientRect().height)),disallowReturnToOpener:true});
    if (closing || !pinEnabled) {pip.close();return;}
    floatingWindow = pip;
    pip.document.title = document.title;
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      const copy = link.cloneNode();copy.href = link.href;pip.document.head.append(copy);
    }
    for (const element of [...document.body.children]) if (['HEADER','MAIN','FOOTER'].includes(element.tagName)) pip.document.body.append(element);
    menuDocument = pip.document;
    pip.document.body.className = 'floating';
    $('pinControls').hidden = true;
    pip.document.addEventListener('keydown',escapeMenu);
    pip.addEventListener('pagehide',close,{once:true});
    // Retain the opener: Chrome owns the floating window's lifetime through it.
    const note = document.createElement('p');note.textContent = 'Hotkey menu is open in the always-on-top window. Close that window to dismiss the menu.';document.body.append(note);
    $('actions').firstElementChild?.focus();
  } catch(error) {
    $('pinHelp').textContent = error.name === 'NotAllowedError'
      ? 'Select Keep on top to open the floating menu.'
      : `Could not open the floating menu: ${error.message}`;
  } finally {pinning = false;}
}
/** Return controls to the normal menu if pinning is disabled while it is open. */
function unpinMenu() {
  if (!floatingWindow) return;
  const pip = floatingWindow;pip.removeEventListener('pagehide',close);
  document.body.replaceChildren(...[...pip.document.body.children]);
  menuDocument = document;floatingWindow = null;pip.close();
  document.body.style.width = '100%';fitWindow().catch(()=>{});
}
chrome.storage.onChanged.addListener((changes,area)=>{
  if (area !== 'local') return;
  if (changes.shortcutMenuNoTimeout || changes.shortcutMenuAlwaysOnTop) {
    if (changes.shortcutMenuNoTimeout) {
      timeoutSettingsChanged = true;noTimeoutEnabled = changes.shortcutMenuNoTimeout.newValue === true;
    }
    if (changes.shortcutMenuAlwaysOnTop) {
      pinSettingsChanged = true;pinEnabled = changes.shortcutMenuAlwaysOnTop.newValue === true;
      if (!pinEnabled) unpinMenu();
      $('pinControls').hidden = !pinEnabled || !!floatingWindow;fitWindow().catch(()=>{});
    }
    configureExpiry(noTimeoutEnabled || pinEnabled);
  }
});
/** Show the deadline without extending it while the user browses menu actions. */
function tick() {$('countdown').textContent = `Closes in ${Math.max(0,Math.ceil((deadline-Date.now())/1000))} seconds. Esc to close.`;}
$('close').onclick = close;
function escapeMenu(event) {if(event.key==='Escape'){event.preventDefault();close();}}
document.addEventListener('keydown',escapeMenu);
$('pinMenu').onclick = pinMenu;
window.addEventListener('pagehide',cleanup);
configureExpiry(false);
try {
  const data = await send({type:'panel-data',id});
  if (data?.type !== 'shortcut-menu') throw new Error('This shortcut menu has expired. Open it again.');
  if (!timeoutSettingsChanged) noTimeoutEnabled = data.noTimeout === true;
  if (!pinSettingsChanged) pinEnabled = data.alwaysOnTop === true;
  configureExpiry(noTimeoutEnabled || pinEnabled);
  for (const [command,definition] of Object.entries(COMMANDS)) {
    if (command === 'help') continue;
    const button = document.createElement('button');button.type = 'button';button.dataset.command = command;
    button.textContent = definition.menuLabel || definition.label;
    button.onclick = ()=>run(command);$('actions').append(button);
  }
  await fitWindow();$('actions').firstElementChild?.focus();
  if (pinEnabled && !floatingWindow) {$('pinControls').hidden = false;await fitWindow();}
} catch(error) {$('error').textContent = error.message;await fitWindow().catch(()=>{});}
