/**
 * Shared popup controller for number entry, credentials, queue restart,
 * errors, and record alerts. The worker owns the pending job; this view only validates
 * user input, renders plain text, and submits the panel ID with the response.
 */
import {COMMANDS, normalize} from './core.js';
import {safeDriverIdentity} from './driver-identity.js';
import {fitRecordAlert} from './record-alert-layout.js';
const $ = id => document.getElementById(id), id = new URL(location.href).searchParams.get('id');
let data, unlocking = false, submitted = false, barcodeChoice;
const port = chrome.runtime.connect({name: 'panel'});
const heartbeat = setInterval(() => { try { port.postMessage({type: 'heartbeat'}); } catch {} }, 15000);
/** Unwrap the worker response envelope and route rejected requests to the panel error display. */
async function send(message) { const r = await chrome.runtime.sendMessage(message); if (!r?.ok) throw new Error(r?.error || 'Extension unavailable.'); return r.value; }
/** Stop the panel heartbeat and any status audio before closing the popup. */
async function close() { clearInterval(heartbeat); if (data?.type === 'record-alert') await send({type: 'stop-audio'}).catch(() => {}); window.close(); }
$('cancel').onclick = close;
$('barcodeEdit').onclick = () => { barcodeChoice = 'edit'; $('form').requestSubmit(); };
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
      let refreshAlertTimeout = () => {}, allowAlertScrolling = () => {};
      document.body.classList.add('status-panel', `status-${data.tone}`);
      if (data.blacklist) document.body.classList.add('blacklist-panel');
      document.title = `${data.sections?.[0]?.title || 'Record status'} · SC DMV Hotkeys`;
      $('title').hidden = true; $('banner').textContent = data.subject || 'SCDMV RECORD STATUS';
      $('recordAlert').hidden = false;
      for (const section of data.sections || []) {
        const block = document.createElement('section'); block.className = 'record-status-section';
        if (section.title) { const title = document.createElement('h2'); title.className = 'record-status-title'; title.textContent = section.title; block.append(title); }
        if (section === data.sections[0] && data.recordType === 'license' && !data.blacklist) {
          const identity = safeDriverIdentity(data.driverIdentity);
          if (identity) {
            const card = document.createElement('div'); card.className = 'record-driver-identity';
            if (identity.photo) {
              const image = document.createElement('img'); image.className = 'record-driver-photo';
              image.alt = 'Driver photo from the driving record'; image.src = identity.photo;
              image.addEventListener('error', () => { image.hidden = true; }); card.append(image);
            } else {
              const missing = document.createElement('p'); missing.textContent = identity.noPhoto ? 'No photo available' : 'Photo unavailable'; card.append(missing);
            }
            const name = document.createElement('p'); name.className = 'record-driver-name';
            name.textContent = identity.name || 'Name unavailable'; card.append(name); block.append(card);
          }
        }
        for (const warning of section.warnings || []) {
          const p = document.createElement('p'); p.className = 'record-status-title record-status-warning';
          p.textContent = warning; block.append(p);
        }
        // Privilege qualifiers share the status heading's appearance and stay out of audio.
        for (const qualifier of section.qualifiers || []) {
          const p = document.createElement('p'); p.className = 'record-status-title record-status-qualifier';
          p.textContent = qualifier; block.append(p);
        }
        for (const line of section.lines || []) {
          const p = document.createElement('p');
          // Give the TAL qualifier the valid heading's appearance while keeping it display-only.
          p.className = section.title === 'VALID LICENSE' && line === 'TEMPORARY ALCOHOL LICENSE'
            ? 'record-status-title record-status-qualifier' : 'record-status-line';
          p.textContent = line; block.append(p);
        }
        if (section.listTitle) { const label = document.createElement('h3'); label.className = 'record-reasons-title'; label.textContent = section.listTitle; block.append(label); }
        if (section.columns?.length) {
          const columns = document.createElement('div'); columns.className = 'record-suspension-columns';
          for (const column of section.columns) {
            const group = document.createElement('div'); group.className = 'record-suspension-column';
            const title = document.createElement('h4'); title.textContent = column.title; group.append(title);
            const list = document.createElement('ul'); list.className = 'record-status-list';
            for (const [index, text] of (column.items || []).entries()) {
              const item = document.createElement('li'), occurrences = column.groups?.[index]?.occurrences;
              if (!occurrences?.length) item.textContent = text;
              else {
                const details = document.createElement('details'); details.className = 'record-suspension-details';
                const summary = document.createElement('summary'); summary.textContent = text; details.append(summary);
                const pane = document.createElement('div'); pane.className = 'record-suspension-occurrences';
                for (const occurrence of occurrences) {
                  const row = document.createElement('div'); row.className = 'record-suspension-occurrence';
                  const heading = document.createElement('h5'); heading.textContent = occurrence.reason; row.append(heading);
                  const fields = [];
                  if (occurrence.ticket) fields.push(`Ticket #: ${occurrence.ticket}`);
                  fields.push(`Suspension Begin: ${occurrence.begin || 'Unavailable'}`, `Suspension End: ${occurrence.end || 'Unavailable'}`, `Violation Date: ${occurrence.violationDate || 'Unavailable'}`);
                  const line = document.createElement('p'); line.textContent = fields.join(' · '); row.append(line); pane.append(row);
                }
                details.append(pane);
                details.addEventListener('toggle', () => { refreshAlertTimeout(); allowAlertScrolling(); });
                item.append(details);
              }
              list.append(item);
            }
            if (!column.items?.length) { const item = document.createElement('li'); item.textContent = 'None'; list.append(item); }
            group.append(list); columns.append(group);
          }
          block.append(columns);
        } else if (section.items?.length) {
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
      if(data.recordType==='plate'&&!data.blacklist&&data.owners?.length) {
        const owners=document.createElement('section');owners.className='record-owners';
        const heading=document.createElement('h3');heading.textContent=data.owners.length===1?'Registered owner':'Registered owners';owners.append(heading);
        const list=document.createElement('ol');list.className='record-owner-list';
        for(const owner of data.owners) {
          const row=document.createElement('li');row.className='record-owner';
          const name=document.createElement('p');name.className='record-owner-name';name.textContent=owner.name||'Name unavailable';
          const address=document.createElement('p');address.className='record-owner-address';address.textContent=owner.address||'Address unavailable';
          row.append(name,address);list.append(row);
        }
        owners.append(list);$('recordAlert').append(owners);
      }
      $('cancel').hidden = true; $('submit').textContent = 'Close'; $('submit').focus({preventScroll: true});
      let deadline = Date.now() + (data.autoCloseMs || 90000);
      $('alertCountdown').hidden = false;
      const tick = () => { const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); $('alertCountdown').textContent = `Closes in ${remaining} seconds. Press Esc to dismiss.`; if (!remaining) { clearInterval(timer); close(); } };
      const timer = setInterval(tick, 1000); tick();
      refreshAlertTimeout = () => { deadline = Date.now() + (data.autoCloseMs || 90000); tick(); };
      allowAlertScrolling = fitRecordAlert();
    } else if (data.type === 'credentials') {
      $('title').textContent = data.setupOnly ? 'Create login and blacklist vault' : data.unlockOnly ? 'Unlock login and blacklist' : data.hasVault ? 'Unlock saved DMV login' : 'DMV login needed';
      $('useNew').hidden = false;
      if (data.encryptedRequired) { $('save').checked = true; $('save').disabled = true; $('savePassArea').hidden = false; }
      $('credentialsArea').hidden = false; $('submit').textContent = 'Continue';
      unlocking = data.hasVault; $('unlockArea').hidden = !unlocking; $('newCredentials').hidden = unlocking;
      (unlocking ? $('unlockPass') : $('user')).focus();
    } else {
      $('title').textContent = data.type === 'barcode-owner-incomplete' ? 'Incomplete owner information' : data.type === 'restart' ? 'Queue complete' : 'SC DMV Hotkeys';
      $('message').hidden = false; $('message').textContent = data.message;
      $('submit').textContent = data.type === 'barcode-owner-incomplete' ? (data.hasNext ? 'Use next owner' : 'Generate with blanks') : data.type === 'restart' ? 'Start again' : 'OK';
      $('barcodeEdit').hidden = data.type !== 'barcode-owner-incomplete';
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
    submitted = true; $('submit').disabled = true;
    await send(request); await close();
  } catch (error) { submitted = false; $('submit').disabled = false; $('error').textContent = error.message; if (data.type === 'input') { $('value').select(); $('value').focus(); } }
};
