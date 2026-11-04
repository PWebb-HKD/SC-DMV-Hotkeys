/**
 * Toolbar popup controller: recent-search replay, session settings, and shortcut help.
 * It sends requests to the worker rather than running portal automation itself.
 * Shortcut assignments and Global scope are managed by the browser.
 */
import {COMMANDS} from './core.js';
const $ = id => document.getElementById(id);
const DESCRIPTIONS = {
  plate: 'Enter a license plate number to search for its vehicle record.',
  license: "Enter a driver's license number to search for a driving record.",
  customer: 'Enter a customer number to search for a driving record.',
  owners: 'Collect unique customer/owner numbers from the open results PDF and search the first.',
  next: 'Search the next queued customer. If the queue is empty, collect numbers from the open results PDF.',
  previous: 'Search the previous saved customer number. Stops at the first customer without wrapping around.',
  address: "Read the driver's license number from a driving-record PDF and find customers at the same address.",
  scutties: "Read the driver's last name and date of birth from the open PDF and search SCUTTIES.",
  barcode: 'Generate a PDF417 data-entry barcode from the focused driver/vehicle report, or the newest report when none is focused.'
};
async function send(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Extension unavailable.');
  return result.value;
}
function feedback(message) { $('feedback').textContent = message; }
function voiceSourceUI() {
  const recorded = $('voiceSource').value === 'recordings';
  $('voiceName').disabled = recorded;
  $('voiceHelp').textContent = recorded
    ? 'A status without a matching recording uses Microsoft speech with the selected gender. Voice settings apply to this session.'
    : 'Microsoft speech replaces bundled recordings. Automatic uses the selected gender; an installed voice can be selected explicitly.';
}
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
/** Render a fresh worker snapshot; history replay sends an ID, not arbitrary form values. */
async function refresh() {
  const data = await send({type: 'state'});
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
    row.title = new Date(item.at).toLocaleString(); row.append(type, value); $('history').append(row);
  }
  $('empty').hidden = !!data.history?.length;
  const queue = data.queue;
  $('queue').textContent = queue?.values?.length ? `Customer queue: ${queue.index ? `position ${queue.index}` : 'not started'} of ${queue.values.length}` : 'No queued customers';
  $('clearQueue').hidden = !queue?.values?.length;
  renderShortcuts(data.commands);
}
// UI events send worker requests; they never mutate the queue or submit website forms.
$('historyTab').onclick = () => tab('history');
$('settingsTab').onclick = () => { tab('settings'); refresh().catch(error => feedback(error.message)); };
$('stopFunction').onclick = async () => {
  $('stopFunction').disabled = true;
  try { await send({type: 'stop'}); $('status').textContent = 'Stopped'; feedback(''); }
  catch (error) { feedback(error.message); }
  finally { $('stopFunction').disabled = false; }
};
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
for (const [id, label] of [['plate', 'Plate'], ['license', 'DL'], ['customer', 'Customer'], ['owners', 'PDF owners'], ['previous', 'Previous customer'], ['next', 'Next customer'], ['address', 'Same address'], ['scutties', 'SCUTTIES'], ['barcode', 'Barcode']]) {
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
  if (area === 'session' && changes.status) $('status').textContent = changes.status.newValue;
  if (area === 'session' && changes.alertsEnabled) $('alertsToggle').checked = changes.alertsEnabled.newValue === true;
  if (area === 'session' && changes.speechEnabled) $('speechToggle').checked = changes.speechEnabled.newValue === true;
  if (area === 'session' && changes.repeatSpeech) $('repeatSpeechToggle').checked = changes.repeatSpeech.newValue === true;
  if (area === 'session' && changes.suspendedClipEnabled) $('clipToggle').checked = changes.suspendedClipEnabled.newValue === true;
  if (area === 'session' && changes.voiceSource) { $('voiceSource').value = changes.voiceSource.newValue || 'recordings'; voiceSourceUI(); }
});
refresh().catch(error => feedback(error.message));
