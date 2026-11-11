/**
 * Toolbar popup controller: recent-search replay, persistent preferences, and shortcut help.
 * It sends requests to the worker rather than running portal automation itself.
 * Shortcut assignments and Global scope are managed by the browser.
 */
import {COMMANDS} from './core.js';
import {BLACKLIST_TYPES, blacklistEntry} from './blacklist.js';
const $ = id => document.getElementById(id);
const DESCRIPTIONS = {
  plate: 'Enter a license plate number to search for its vehicle record.',
  license: "Enter a driver's license number to search for a driving record.",
  customer: 'Enter a customer number to search for a driving record.',
  owners: 'Collect unique customer/owner/registrant numbers from the open results PDF and search the second on Customers at Same Residence reports (the first on other reports).',
  next: 'Search the next queued customer. If the queue is empty, collect numbers from the open results PDF.',
  previous: 'Search the previous saved customer number. Stops at the first customer without wrapping around.',
  address: "Read the driver's license number from a driving-record PDF and find customers at the same address.",
  scutties: "Read the driver's last name and date of birth from the open PDF and search SCUTTIES.",
  barcode: 'Generate a PDF417 data-entry barcode from the focused driver/vehicle report, or the newest report when none is focused.'
};
/** Send a privileged UI request and return its value or throw the worker's displayed error. */
async function send(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Extension unavailable.');
  return result.value;
}
/** Write feedback as text so worker messages cannot introduce markup. */
function feedback(message) { $('feedback').textContent = message; }
/** Enable controls appropriate to the announcement source and explain persistent voice preferences. */
function voiceSourceUI() {
  const recorded = $('voiceSource').value === 'recordings';
  $('voiceName').disabled = recorded;
  $('voiceHelp').textContent = recorded
    ? 'A status without a matching recording uses Microsoft speech with the selected gender.'
    : 'Microsoft speech replaces bundled recordings. Automatic uses the selected gender; an installed voice can be selected explicitly.';
}
/** Select one popup view and keep its accessible tab state synchronized. */
function tab(selected) {
  for (const name of ['history', 'settings', 'about']) {
    $(`${name}View`).hidden = name !== selected;
    $(`${name}Tab`).setAttribute('aria-selected', String(name === selected));
  }
}
/** Show actual browser assignments, never the preferred keys as assignments. */
function renderShortcuts(commands = []) {
  // Preferred shortcuts are recommendations, not proof of an assignment.
  const registered = new Map(commands.map(command => [command.name, command]));
  const entries = Object.entries(COMMANDS).map(([id, command]) => [id, command.label, DESCRIPTIONS[id]]);
  if (registered.get('_execute_action')?.shortcut) entries.push(['_execute_action', 'Open extension', 'Open the SC DMV Hotkeys popup.']);
  const rows = entries.map(([id, label, description]) => {
    const article = document.createElement('article'); article.className = 'shortcut-entry'; article.dataset.command = id;
    const heading = document.createElement('div'); heading.className = 'shortcut-heading';
    const title = document.createElement('h3'); title.textContent = label;
    const shortcut = document.createElement('kbd'); shortcut.textContent = registered.get(id)?.shortcut || 'Not assigned';
    const text = document.createElement('p'); text.textContent = description;
    heading.append(title, shortcut); article.append(heading, text); return article;
  });
  $('shortcutList').replaceChildren(...rows);
}
/** Render only unlocked entries and require explicit confirmation before requesting their removal. */
function renderBlacklist(current = {}) {
  const unlocked = current.unlocked === true;
  $('blacklistState').textContent = !current.hasVault
    ? 'Create an encrypted vault to save the blacklist alongside your DMV login. No DMV search is needed.'
    : unlocked ? 'Vault unlocked. Blacklisted numbers are blocked before searches.' : 'Vault locked. Unlock it to view entries and enable searches.';
  $('blacklistEntries').replaceChildren();
  $('blacklistTable').hidden = !unlocked;
  $('blacklistEmpty').hidden = !unlocked || !!current.entries?.length;
  $('blacklistSetup').hidden = !!current.hasVault;
  $('blacklistAdd').disabled = !unlocked; $('blacklistUnlock').disabled = !current.hasVault || unlocked;
  $('blacklistPassphrase').disabled = !current.hasVault;
  $('blacklistUnlockFields').hidden = !current.hasVault || unlocked;
  for (const entry of current.entries || []) {
    const row = document.createElement('tr'), category = document.createElement('td'), value = document.createElement('td'), action = document.createElement('td');
    category.textContent = BLACKLIST_TYPES[entry.kind]; value.textContent = entry.value;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary blacklist-remove'; remove.textContent = '🗑';
    remove.setAttribute('aria-label', `Remove ${BLACKLIST_TYPES[entry.kind]} ${entry.value}`);
    remove.title = 'Remove blacklisted number';
    remove.onclick = async () => {
      const category = BLACKLIST_TYPES[entry.kind];
      if (!window.confirm(`Remove ${category.toLowerCase()} ${entry.value} from the blacklist? You will no longer be stopped from running it in the future. Running your own or a family member's information could cause your SCDMV access privileges to be suspended or revoked.`)) return;
      remove.disabled = true;
      try {
        renderBlacklist(await send({type: 'blacklist-remove', ...entry, confirmed: true}));
        $('blacklistFeedback').textContent = 'Entry removed. Future searches for this number will no longer be blocked.';
      } catch (error) { $('blacklistFeedback').textContent = error.message; remove.disabled = false; }
      finally { $('blacklistPassphrase').value = ''; }
    };
    action.append(remove); row.append(category, value, action); $('blacklistEntries').append(row);
  }
}
// Entry controls follow category-specific limits; the worker independently validates submitted values.
$('blacklistKind').onchange = () => {
  const kind = $('blacklistKind').value;
  $('blacklistLimit').textContent = kind === 'license' ? 'Up to 9 digits after leading zeroes are removed. Spaces are ignored.' : kind === 'customer' ? 'Up to 8 digits. A leading C0 and leading zeroes are ignored. Spaces are ignored.' : 'Up to 8 letters or digits. Spaces are ignored.';
  $('blacklistValue').inputMode = kind === 'plate' ? 'text' : 'numeric';
};
$('blacklistForm').onsubmit = async event => {
  event.preventDefault(); $('blacklistAdd').disabled = true;
  try {
    const entry = blacklistEntry($('blacklistKind').value, $('blacklistValue').value);
    renderBlacklist(await send({type: 'blacklist-add', ...entry}));
    $('blacklistValue').value = ''; $('blacklistFeedback').textContent = 'Number added to the blacklist.';
  } catch (error) { $('blacklistFeedback').textContent = error.message; $('blacklistAdd').disabled = false; }
  finally { $('blacklistPassphrase').value = ''; }
};
// Create or unlock the vault through the worker, then clear passphrase fields after use.
$('blacklistSetup').onclick = () => send({type: 'blacklist-setup'}).then(renderBlacklist).catch(error => { $('blacklistFeedback').textContent = error.message; });
$('blacklistUnlock').onclick = async () => {
  $('blacklistUnlock').disabled = true;
  try { renderBlacklist(await send({type: 'blacklist-unlock', passphrase: $('blacklistPassphrase').value})); $('blacklistFeedback').textContent = 'Login and blacklist unlocked for this session.'; }
  catch (error) { $('blacklistFeedback').textContent = error.message; $('blacklistUnlock').disabled = false; }
  finally { $('blacklistPassphrase').value = ''; }
};
/** Render a fresh worker snapshot; history replay sends an ID, not arbitrary form values. */
async function refresh() {
  const data = await send({type: 'state'});
  renderBlacklist(data.blacklist);
  $('dmvDarkMode').checked = data.dmvDarkMode !== false;
  $('pdfDarkMode').checked = data.pdfDarkMode === true;
  $('alertsToggle').checked = data.alertsEnabled === true;
  $('speechToggle').checked = data.speechEnabled === true;
  $('repeatSpeechToggle').checked = data.repeatSpeech === true;
  $('clipToggle').checked = data.suspendedClipEnabled === true;
  $('voiceGender').value = data.voiceGender || 'female';
  $('voiceSource').value = data.voiceSource || 'recordings';
  $('voiceName').replaceChildren(new Option('Automatic for selected voice', ''), ...(data.voices || []).map(voice => new Option(`${voice.voiceName} (${voice.lang || 'local'})`, voice.voiceName)));
  $('voiceName').value = data.voiceName || '';
  voiceSourceUI();
  $('status').textContent = data.status || 'Ready'; $('history').replaceChildren();
  for (const item of data.history || []) {
    const row = document.createElement('tr'), type = document.createElement('td'), value = document.createElement('td');
    type.textContent = COMMANDS[item.kind]?.label || item.kind;
    if (['plate', 'license', 'customer', 'address', 'scutties'].includes(item.kind)) {
      const rerun = document.createElement('button'); rerun.type = 'button'; rerun.className = 'history-rerun'; rerun.textContent = item.value;
      rerun.title = `Run this ${type.textContent.toLowerCase()} again`;
      rerun.setAttribute('aria-label', `Rerun ${type.textContent}: ${item.value}`);
      rerun.onclick = async () => {
        rerun.disabled = true;
        try { await send({type: 'rerun', search: {id: item.id, kind: item.kind, value: item.value, at: item.at}}); window.close(); }
        catch (error) { rerun.disabled = false; feedback(error.message); }
      };
      value.append(rerun);
    } else value.textContent = item.value;
    if (item.outcome === 'error') {
      const error = document.createElement('small'); error.className = 'history-error';
      error.textContent = `DMV error: ${item.errorMessage || 'Search could not be completed.'}`;
      value.append(error);
    }
    row.title = new Date(item.at).toLocaleString(); row.append(type, value); $('history').append(row);
  }
  $('empty').hidden = !!data.history?.length;
  const queue = data.queue;
  $('queue').textContent = queue?.values?.length ? `Customer queue: ${queue.index ? `position ${queue.index}` : 'not started'} of ${queue.values.length}` : 'No queued customers';
  $('clearQueue').hidden = !queue?.values?.length;
  renderShortcuts(data.commands);
}
// UI events send worker requests; they never mutate the queue or submit website forms.
$('dmvDarkMode').onchange = async () => { try { await send({type:'dmv-display-settings',enabled:$('dmvDarkMode').checked}); feedback(''); } catch(error) { feedback(error.message); await refresh(); } };
$('pdfDarkMode').onchange = async () => { try { await send({type:'pdf-display-settings',enabled:$('pdfDarkMode').checked}); feedback(''); } catch(error) { feedback(error.message); await refresh(); } };
$('historyTab').onclick = () => tab('history');
$('settingsTab').onclick = () => { tab('settings'); refresh().catch(error => feedback(error.message)); };
$('stopFunction').onclick = async () => {
  $('stopFunction').disabled = true;
  try { await send({type: 'stop'}); $('status').textContent = 'Stopped'; feedback(''); }
  catch (error) { feedback(error.message); }
  finally { $('stopFunction').disabled = false; }
};
// Map related voice controls to one validated preference-update message without duplicating handlers.
for (const [id, key] of [['speechToggle', 'speechEnabled'], ['repeatSpeechToggle', 'repeatSpeech'], ['clipToggle', 'suspendedClipEnabled'], ['voiceSource', 'voiceSource'], ['voiceGender', 'voiceGender'], ['voiceName', 'voiceName']]) {
  $(id).onchange = async () => {
    const input = $(id), value = input.type === 'checkbox' ? input.checked : input.value;
    try {
      await send({type: 'audio-settings', [key]: value, ...(key === 'voiceGender' ? {voiceName: ''} : {})});
      if (key === 'voiceGender') $('voiceName').value = '';
      voiceSourceUI();
      feedback('');
    } catch (error) { feedback(error.message); await refresh(); }
  };
}
$('stopAudio').onclick = () => send({type: 'stop-audio'}).catch(error => feedback(error.message));
$('alertsToggle').onchange = async event => {
  const input = event.target, enabled = input.checked;
  input.disabled = true;
  try { await send({type: 'alerts', enabled}); feedback(''); }
  catch (error) { input.checked = !enabled; feedback(error.message); }
  finally { input.disabled = false; }
};
$('aboutTab').onclick = () => { tab('about'); refresh().catch(error => feedback(error.message)); };
for (const [id, label] of [['plate', "Plate Search"], ['license', "DL # Search"], ['customer', "Customer # Search"], ['owners', "Get Customer #'s \nfrom current page"], ['previous', 'Previous customer'], ['next', 'Next customer'], ['address', 'Same address'], ['scutties', 'SCUTTIES'], ['barcode', 'Barcode']]) {
  const button = document.createElement('button'); button.textContent = label;
  button.onclick = async () => { try { await send({type: 'run', command: id}); window.close(); } catch (error) { feedback(error.message); } };
  $('quick').append(button);
}
$('browserShortcuts').onclick = async event => {
  event.preventDefault();
  try { await chrome.tabs.create({url: 'chrome://extensions/shortcuts'}); } catch (error) { feedback(error.message); }
};
$('shortcutSetup').onclick = () => send({type: 'shortcut-setup'}).catch(error => feedback(error.message));
for (const [id, type] of [['clearHistory', 'clear-history'], ['clearQueue', 'clear-queue']]) {
  $(id).onclick = async () => { try { await send({type}); await refresh(); feedback(''); } catch (error) { feedback(error.message); } };
}
// Update session controls while this short-lived popup remains open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.vault || changes.pdfDarkMode || changes.dmvDarkMode) || area === 'session' && (changes.blacklist || changes.unlockedVault)) refresh().catch(error => feedback(error.message));
  if (area === 'session' && changes.history) refresh().catch(error => feedback(error.message));
  if (area === 'session' && changes.status) $('status').textContent = changes.status.newValue;
  if (area === 'session' && changes.alertsEnabled) $('alertsToggle').checked = changes.alertsEnabled.newValue === true;
  if (area === 'session' && changes.speechEnabled) $('speechToggle').checked = changes.speechEnabled.newValue === true;
  if (area === 'session' && changes.repeatSpeech) $('repeatSpeechToggle').checked = changes.repeatSpeech.newValue === true;
  if (area === 'session' && changes.suspendedClipEnabled) $('clipToggle').checked = changes.suspendedClipEnabled.newValue === true;
  if (area === 'session' && (changes.voiceGender || changes.voiceName)) refresh().catch(error => feedback(error.message));
  if (area === 'session' && changes.voiceSource) { $('voiceSource').value = changes.voiceSource.newValue || 'recordings'; voiceSourceUI(); }
});
refresh().catch(error => feedback(error.message));
