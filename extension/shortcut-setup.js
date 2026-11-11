/**
 * First-install/reopenable shortcut guide. commands.getAll() reports assignments,
 * but not scope; the user must set Global in the browser settings UI. This guide
 * never changes an existing assignment or reopens automatically on an update.
 */
import {COMMANDS} from './core.js';
const $ = id => document.getElementById(id);
/** Render actual browser assignments beside preferred keys without changing bindings or their Global scope. */
async function refresh() {
  const commands = await chrome.commands.getAll();
  const assigned = new Map(commands.map(command => [command.name, command.shortcut]));
  const rows = Object.entries(COMMANDS).map(([id, command]) => {
    const row = document.createElement('tr'); row.dataset.command = id;
    for (const value of [command.label, command.key, assigned.get(id) || 'Not assigned']) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    return row;
  });
  $('assignments').replaceChildren(...rows); $('feedback').textContent = '';
}
$('openShortcuts').onclick = async event => {
  event.preventDefault();
  try {
    // A normal window gives the settings page its usual browser controls,
    // instead of opening a second tab inside this setup popup.
    await chrome.windows.create({url: 'chrome://extensions/shortcuts', type: 'normal', focused: true});
    $('feedback').textContent = '';
  } catch (error) {$('feedback').textContent = `Open your browser's extensions page and select Keyboard shortcuts. ${error.message}`;}
};
$('refresh').onclick = () => refresh().catch(error => {$('feedback').textContent = error.message;});
$('done').onclick = () => window.close();
document.addEventListener('keydown', event => {if (event.key === 'Escape') {event.preventDefault(); window.close();}});
refresh().catch(error => {$('feedback').textContent = error.message;});
