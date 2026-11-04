/**
 * Shared popup controller for number entry, credentials, permissions, queue restart,
 * errors, and record alerts. The worker owns the pending job; this view only validates
 * user input, renders plain text, and submits the panel ID with the response.
 */
import {COMMANDS, normalize} from './core.js';
const $ = id => document.getElementById(id), id = new URL(location.href).searchParams.get('id');
let data, unlocking = false, submitted = false;
const port = chrome.runtime.connect({name: 'panel'});
const heartbeat = setInterval(() => { try { port.postMessage({type: 'heartbeat'}); } catch {} }, 15000);
async function send(message) { const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || 'Extension unavailable.'); return r.value; }
async function close() { clearInterval(heartbeat); if (data?.type === 'record-alert') await send({type: 'stop-audio'}).catch(() => {}); window.close(); }
$('cancel').onclick = close;
document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
$('save').onchange = () => { $('savePassArea').hidden = !$('save').checked; };
$('useNew').onclick = () => { unlocking = false; $('unlockArea').hidden = true; $('newCredentials').hidden = false; $('user').focus(); };
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
      $('cancel').hidden = true; $('submit').textContent = 'Close'; $('submit').focus();
      const deadline = Date.now() + (data.autoCloseMs || 90000);
      $('alertCountdown').hidden = false;
      const tick = () => { const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); $('alertCountdown').textContent = `Closes in ${remaining} seconds. Press Esc to dismiss.`; if (!remaining) { clearInterval(timer); close(); } };
      const timer = setInterval(tick, 1000); tick();
    } else if (data.type === 'credentials') {
      $('title').textContent = data.hasVault ? 'Unlock saved DMV login' : 'DMV login needed';
      $('credentialsArea').hidden = false; $('submit').textContent = 'Continue';
      unlocking = data.hasVault; $('unlockArea').hidden = !unlocking; $('newCredentials').hidden = unlocking;
      (unlocking ? $('unlockPass') : $('user')).focus();
    } else {
      $('title').textContent = data.type === 'restart' ? 'Queue complete' : data.type === 'permission' ? 'Website access needed' : 'SC DMV Hotkeys';
      $('message').hidden = false; $('message').textContent = data.message;
      $('submit').textContent = data.type === 'restart' ? 'Start again' : data.type === 'permission' ? 'Allow site' : 'OK';
      $('cancel').hidden = data.type === 'notice'; $('submit').focus();
    }
  }
} catch (e) { $('title').textContent = 'Unable to open panel'; $('error').textContent = e.message; }
// Lock double-submission locally, while the worker independently validates the panel job.
$('form').onsubmit = async event => {
  event.preventDefault(); if (!data || submitted) return;
  if (data.type === 'record-alert') { await close(); return; }
  $('error').textContent = '';
  const request = {type: 'panel-submit', id, value: true};
  try {
    if (data.type === 'input') { request.value = normalize(data.command, $('value').value); if (!request.value) { await close(); return; } }
    if (data.type === 'credentials') Object.assign(request, {unlock: unlocking, user: $('user').value, password: $('password').value, save: $('save').checked, passphrase: unlocking ? $('unlockPass').value : $('savePass').value});
    if (data.type === 'permission') {
      const granted = await chrome.permissions.request({origins: [data.origin]});
      if (!granted) throw new Error('Site access was declined. Cancel to stop this search.');
    }
    submitted = true; $('submit').disabled = true;
    await send(request); await close();
  } catch (error) { submitted = false; $('submit').disabled = false; $('error').textContent = error.message; if (data.type === 'input') { $('value').select(); $('value').focus(); } }
};
