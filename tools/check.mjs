// Fast release checks: manifest/package agreement, required assets, and first-party JS syntax.
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'));
const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const {RECORDING_PATHS} = await import('../extension/voice-recordings.js');
for (const path of RECORDING_PATHS) if (!existsSync(join(root, 'extension', path))) throw new Error(`Missing voice recording: ${path}`);
if (project.version !== manifest.version) throw new Error('Package and extension versions differ.');
if (manifest.manifest_version !== 3 || Object.keys(manifest.commands).length !== 9) throw new Error('Manifest commands are incomplete.');
if (Object.values(manifest.commands).filter(v => v.suggested_key).length > 4) throw new Error('Chromium allows at most four suggested shortcuts.');
for (const path of [manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons), 'vendor/pdf.mjs', 'vendor/pdf.worker.mjs', 'audio-player.html', 'audio-player.js', 'audio-alerts.js', 'audio/suspended.mp3', 'barcode.html', 'barcode.js', 'barcode-data.js', 'vendor/bwip-js-min.js']) {
  if (!existsSync(join(root, 'extension', path))) throw new Error(`Missing extension asset: ${path}`);
}
for (const name of readdirSync(join(root, 'extension')).filter(x => x.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', join(root, 'extension', name)], {encoding: 'utf8', windowsHide: true});
  if (result.status) throw new Error(result.stderr);
}
for (const name of ['shortcut-setup.html', 'shortcut-setup.js', 'shortcut-setup.css']) if (!existsSync(join(root, 'extension', name))) throw new Error(`Missing shortcut setup asset: ${name}`);
for (const command of Object.values(manifest.commands)) {
  if (command.global && command.suggested_key && !/^Ctrl\+Shift\+[0-9]$/.test(command.suggested_key.default || command.suggested_key)) throw new Error('Suggested global shortcut is outside Chromium limits.');
}
console.log('Manifest, packaged assets, and extension JavaScript syntax verified.');
