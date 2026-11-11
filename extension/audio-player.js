/**
 * Offscreen document player: a service worker cannot create an Audio element.
 * Accept only extension messages and catalogued local assets. A job token prevents
 * a replaced playback loop from starting another file or repetition.
 */
import {RECORDING_PATHS} from './voice-recordings.js';
const allowedFiles = new Set(RECORDING_PATHS);
let active, pendingReject, job = 0;
// A new accepted request replaces playback; replies settle only after its files finish or fail.
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.target !== 'audio-player' || message.type !== 'play' || sender.id !== chrome.runtime.id) return false;
  const token = ++job;
  active?.pause(); pendingReject?.(new Error('Playback replaced.')); pendingReject = null;
  (async () => {
    const legacy = !message.files;
    const files = legacy ? ['audio/suspended.mp3'] : message.files;
    const repeat = legacy ? 3 : message.repeat;
    if (!Array.isArray(files) || !files.length || files.length > 4 || files.some(file => !allowedFiles.has(file) && !(legacy && file === 'audio/suspended.mp3')) || ![1, 2, 3].includes(repeat)) throw new Error('Invalid packaged audio request.');
    // Play each file sequentially and recheck replacement before every repetition.
    for (let cycle = 0; cycle < repeat && token === job; cycle++) {
      if (cycle && !legacy) await new Promise(resolve => setTimeout(resolve, 1000));
      for (const file of files) {
        if (token !== job) return;
        const audio = new Audio(chrome.runtime.getURL(file)); active = audio;
        await new Promise((resolve, reject) => {
          pendingReject = reject;
          audio.onended = resolve;
          audio.onerror = () => reject(new Error('The packaged status recording could not be played.'));
          audio.play().catch(reject);
        });
        pendingReject = null;
      }
    }
  })().then(() => reply({ok: true}), error => reply({error: error.message})).finally(() => {
    if (token === job) {active?.pause(); active = null; pendingReject = null;}
  });
  return true;
});
