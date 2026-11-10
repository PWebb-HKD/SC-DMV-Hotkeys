/**
 * Shared popup controller for number entry, credentials, permissions, queue restart,
 * errors, and record alerts. The worker owns the pending job; this view only validates
 * user input, renders plain text, and submits the panel ID with the response.
 */
import {COMMANDS, normalize} from './core.js';
const $ = id => document.getElementById(id), id = new URL(location.href).searchParams.get('id');
let data, unlocking = false, submitted = false, barcodeChoice;
const port = chrome.runtime.connect({name: 'panel'});
const heartbeat = setInterval(() => { try { port.postMessage({type: 'heartbeat'}); } catch {} }, 15000);
/** Unwrap the worker response envelope and route rejected requests to the panel error display. */
async function send(message) { const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || 'Extension unavailable.'); return r.value; }
/** Stop the panel heartbeat and any status audio before closing the popup. */
async function close() { clearInterval(heartbeat); if (data?.type === 'record-alert') await send({type: 'stop-audio'}).catch(() => {}); window.close(); }
$('cancel').onclick = close;
$('barcodeBlanks').onclick = () => { barcodeChoice = 'blank'; $('form').requestSubmit(); };
document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
$('save').onchange = () => { $('savePassArea').hidden = !$('save').checked; };
// Destructive vault reset requires an explicit warning and confirmation before the worker request.
$('clearSavedInfo').onclick = async () => {
  if (!window.confirm('Delete the saved credentials and encrypted vault? All blacklisted numbers will also be deleted and must be re-entered before blacklist protection is enabled again. Session search history and cached reports will also be cleared. This cannot be undone.')) return;
  $('clearSavedInfo').disabled = true;
  try { await send({type: 'clear-saved-user-info', confirmed: true}); await close(); }
  catch (error) { $('error').textContent = error.message; $('clearSavedInfo').disabled = false; }
};
// Switching login entry mode retains the blacklist and requires the current vault unlock when necessary.
$('useNew').onclick = () => { unlocking = false; $('unlockArea').hidden = !data.unlockOnly; $('useNew').hidden = true; $('newCredentials').hidden = false; if (data.hasVault) { $('save').checked = true; $('save').disabled = true; $('savePassArea').hidden = true; $('message').hidden = false; $('message').textContent = (data.unlockOnly ? 'Unlock the blacklist with the vault passphrase above. ' : '') + 'Using different credentials replaces the saved login in this vault. Your blacklist and vault passphrase are retained.'; } $('user').focus(); };
// Render the worker-selected panel type; report messages always enter the DOM as text.
try {
  data = await send({type: 'panel-data', id});
  if (!data) { window.close(); } else {
    if (data.type === 'input') {
      $('title').textContent = COMMANDS[data.command].prompt; $('inputArea').hidden = false;
      $('valueLabel').textContent = COMMANDS[data.command].label; $('value').focus();
      const deadline = Date.now() + 90000;
      const timer = setInterval(() => {
        const seconds = Math.ceil((deadline - Date.now()) / 1000);
        $('countdown').textContent = `Closes in ${Math.max(seconds, 0)} seconds.`;
        if (seconds <= 0) { clearInterval(timer); close(); }
      }, 1000);
    } else if (data.type === 'record-alert') {
      document.body.classList.add('status-panel', `status-${data.tone}`);
      if (data.blacklist) document.body.classList.add('blacklist-panel');
      document.title = `${data.sections?.[0]?.title || 'Record status'} · SC DMV Hotkeys`;
      $('title').hidden = true; $('banner').textContent = data.subject || 'SCDMV RECORD STATUS';
      $('recordAlert').hidden = false;
      for (const section of data.sections || []) {
        const block = document.createElement('section'); block.className = 'record-status-section';
        if (section.title) { const title = document.createElement('h2'); title.className = 'record-status-title'; title.textContent = section.title; block.append(title); }
        for (const line of section.lines || []) { const p = document.createElement('p'); p.className = 'record-status-line'; p.textContent = line; block.append(p); }
        if (section.listTitle) { const label = document.createElement('h3'); label.className = 'record-reasons-title'; label.textContent = section.listTitle; block.append(label); }
        if (section.items?.length) {
          const list = document.createElement('ul'); list.className = 'record-status-list';
          for (const text of section.items) { const item = document.createElement('li'); item.textContent = text; list.append(item); }
          block.append(list);
        }
        $('recordAlert').append(block);
      }
      if (data.recordType === 'plate' && data.vehicle) {
        const details = document.createElement('div'); details.className = 'record-vehicle-details';
        for (const [field, label] of [['make', 'Make'], ['model', 'Model'], ['year', 'Year'], ['body', 'Body style']]) {
          const value = document.createElement('p'); value.textContent = `${label}: ${data.vehicle[field] || 'Unavailable'}`; details.append(value);
        }
        $('recordAlert').append(details);
      }
      $('cancel').hidden = true; $('submit').textContent = 'Close'; $('submit').focus();
      const deadline = Date.now() + (data.autoCloseMs || 90000);
      $('alertCountdown').hidden = false;
      const tick = () => { const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); $('alertCountdown').textContent = `Closes in ${remaining} seconds. Press Esc to dismiss.`; if (!remaining) { clearInterval(timer); close(); } };
      const timer = setInterval(tick, 1000); tick();
    } else if (data.type === 'credentials') {
      $('title').textContent = data.setupOnly ? 'Create login and blacklist vault' : data.unlockOnly ? 'Unlock login and blacklist' : data.hasVault ? 'Unlock saved DMV login' : 'DMV login needed';
      $('useNew').hidden = false;
      if (data.encryptedRequired) { $('save').checked = true; $('save').disabled = true; $('savePassArea').hidden = false; }
      $('credentialsArea').hidden = false; $('submit').textContent = 'Continue';
      unlocking = data.hasVault; $('unlockArea').hidden = !unlocking; $('newCredentials').hidden = unlocking;
      (unlocking ? $('unlockPass') : $('user')).focus();
    } else {
      $('title').textContent = data.type === 'barcode-owner-incomplete' ? 'Incomplete owner information' : data.type === 'restart' ? 'Queue complete' : data.type === 'permission' ? 'Website access needed' : 'SC DMV Hotkeys';
      $('message').hidden = false; $('message').textContent = data.message;
      $('submit').textContent = data.type === 'barcode-owner-incomplete' ? (data.hasNext ? 'Use next owner' : 'Generate with blanks') : data.type === 'restart' ? 'Start again' : data.type === 'permission' ? 'Allow site' : 'OK';
      $('barcodeBlanks').hidden = data.type !== 'barcode-owner-incomplete' || !data.hasNext;
      $('cancel').hidden = data.type === 'notice'; $('submit').focus();
    }
  }
} catch (e) { $('title').textContent = 'Unable to open panel'; $('error').textContent = e.message; }
// Lock double-submission locally, while the worker independently validates the panel job.
$('form').onsubmit = async event => {
  event.preventDefault(); if (!data || submitted) return;
  if (data.type === 'record-alert') { await close(); return; }
  $('error').textContent = '';
  const request = {type: 'panel-submit', id, value: data.type === 'barcode-owner-incomplete' ? barcodeChoice || (data.hasNext ? 'next' : 'blank') : true};
  try {
    if (data.type === 'input') { request.value = normalize(data.command, $('value').value); if (!request.value) { await close(); return; } }
    if (data.type === 'credentials') Object.assign(request, {unlock: unlocking, user: $('user').value, password: $('password').value, save: $('save').checked, passphrase: unlocking ? $('unlockPass').value : $('savePass').value});
    if (data.type === 'credentials' && data.unlockOnly && !unlocking) request.blacklistPassphrase = $('unlockPass').value;
    if (data.type === 'permission') {
      const granted = await chrome.permissions.request({origins: [data.origin]});
      if (!granted) throw new Error('Site access was declined. Cancel to stop this search.');
    }
    submitted = true; $('submit').disabled = true;
    await send(request); await close();
  } catch (error) { submitted = false; $('submit').disabled = false; $('error').textContent = error.message; if (data.type === 'input') { $('value').select(); $('value').focus(); } }
};
