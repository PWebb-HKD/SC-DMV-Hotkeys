// Fast release checks: manifest/package agreement, required assets, and first-party JS syntax.
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const bridgeCheck=spawnSync(process.execPath,[join(root,'tools/build-query-bridge.mjs'),'--check'],{encoding:'utf8'});
if(bridgeCheck.status)throw new Error(bridgeCheck.stderr);
for(const path of ['background-search.js','offscreen-query.html','offscreen-query.js','offscreen-main.js','offscreen-frame.js'])if(!existsSync(join(root,'extension',path)))throw new Error(`Missing query asset: ${path}`);
const manifest = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8'));
const project = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const {COMMANDS} = await import('../extension/core.js');
const {RECORDING_PATHS} = await import('../extension/voice-recordings.js');
for (const path of RECORDING_PATHS) if (!existsSync(join(root, 'extension', path))) throw new Error(`Missing voice recording: ${path}`);
// A source release must reproduce the same version through its manifest, package, and lockfile.
if (lock.version !== project.version || lock.packages?.['']?.version !== project.version) throw new Error('Package and lockfile versions differ.');
if (project.version !== manifest.version) throw new Error('Package and extension versions differ.');
// Startup calls local.setAccessLevel, which only becomes available in Chrome 140.
// Older session-only support must not be mistaken for support of the local guard.
const minimumChrome=Number(String(manifest.minimum_chrome_version||'').split('.')[0]);
if (!Number.isFinite(minimumChrome)||minimumChrome<140) throw new Error('Chrome 140 or newer is required for trusted local-storage access.');
if (manifest.manifest_version !== 3 || JSON.stringify(Object.keys(manifest.commands).sort()) !== JSON.stringify(Object.keys(COMMANDS).sort())) throw new Error('Manifest commands are incomplete.');
if (Object.values(manifest.commands).filter(v => v.suggested_key).length > 4) throw new Error('Chromium allows at most four suggested shortcuts.');
for (const path of [manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons), 'vendor/pdf.mjs', 'vendor/pdf.worker.mjs', 'audio-player.html', 'audio-player.js', 'audio-alerts.js', 'audio/suspended.mp3', 'barcode.html', 'barcode.js', 'barcode-data.js', 'barcode-editor.js', 'shortcut-menu.html', 'shortcut-menu.js', 'shortcut-menu-layout.js', 'record-alert-layout.js', 'driver-identity.js', 'driver-photo.js', 'no-photo.js', 'shortcut-menu.css', 'blacklist.js', 'vault.js', 'vendor/text_layer_builder.css', 'alert-settings.js', 'dmv-theme.js', 'dmv-theme-start.js', 'dmv-theme.css', 'dmv-theme-settings.js', 'pdf-print.js', 'pdf-routing.js', 'pdf-dark-view.js', 'pdf-dark-view.css', 'vendor/bwip-js-min.js']) {
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
