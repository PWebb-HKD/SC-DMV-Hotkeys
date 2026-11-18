/**
 * Audio policy and cancellation owned by the worker. A generation token invalidates
 * earlier playback; offscreen document creation/closure is serialized separately.
 * Priority: special suspended clip, bundled recording, then local TTS fallback.
 */
import {statusRecordings} from './voice-recordings.js';
const PHRASES = {
  'TAG SUSPENDED': 'Suspended tag', EXPIRED: 'Expired tag', 'TAG VALID': 'Valid tag',
  'LICENSE SUSPENDED': 'License suspended', 'NOT LICENSED': 'Not licensed',
  'NOT LICENSED ID ONLY': 'Not licensed. ID only', 'LICENSE EXPIRED': 'License expired',
  'VALID LICENSE': 'Valid license', 'NO LONGER LICENSED IN SC': 'No longer licensed in South Carolina',
  'STATUS UNAVAILABLE': 'Status unavailable'
};
/** Speak status headings only; suspension reasons and identifying details are excluded. */
export function spokenStatus(alert) {
  return [...new Set((alert.sections || []).map(section => {
    const title = String(section.title || '').trim();
    return PHRASES[title] || title.toLowerCase();
  }).filter(Boolean))].join('. ');
}
/** Identify suspension headings to select the dedicated suspended-status clip. */
export function isSuspended(alert) {
  return alert.sections?.some(section => ['TAG SUSPENDED', 'LICENSE SUSPENDED'].includes(section.title)) === true;
}
/** Choose a local installed voice; never silently substitute a remote voice. */
export function chooseVoice(voices, gender, name = '') {
  const local = voices.filter(voice => !voice.remote && voice.voiceName);
  if (name) return local.find(voice => voice.voiceName === name);
  const names = gender === 'male' ? /\b(David|Mark|George|James|Guy|Ryan|Eric|Roger|Paul|Daniel)\b/i : /\b(Zira|Hazel|Susan|Jenny|Aria|Sonia|Libby|Samantha|Victoria|Karen|Moira)\b/i;
  return local.find(voice => /^en(?:-|$)/i.test(voice.lang || '') && names.test(voice.voiceName))
    || local.find(voice => voice.gender === gender);
}
/** Adapt the callback API and expose only locally available voices. */
export function availableVoices(api = chrome) {
  if (!api.tts) return Promise.resolve([]);
  return new Promise((resolve, reject) => api.tts.getVoices(voices => {
    if (api.runtime.lastError) reject(new Error(api.runtime.lastError.message));
    else resolve(voices.filter(voice => !voice.remote));
  }));
}

/** Manage one cancellable announcement across packaged files, offscreen audio, and local speech. */
export class AudioAlerts {
  /** Accept a browser API adapter so playback policy can be tested independently of Chrome. */
  constructor(api = chrome) { this.api = api; this.generation = 0; this.offscreenTask = Promise.resolve(); }
  /** Lease Chrome's single offscreen document to a query. Audio lifecycle work queues
   * behind it; cancellation of the search releases the lease before another starts. */
  useQueryDocument(action) {
    this.stop();
    const task = this.offscreenTask.then(async () => {
      await this.api.offscreen.createDocument({url:'offscreen-query.html', reasons:['IFRAME_SCRIPTING','DOM_SCRAPING'], justification:'Run the user-selected DMV query in a session iframe and capture its generated report.'});
      try { return await action(); }
      finally { if(await this.api.offscreen.hasDocument())await this.api.offscreen.closeDocument(); }
    });
    this.offscreenTask = task.catch(() => {});
    return task;
  }
  /** Invalidate pending speech/repeats immediately; close offscreen audio in lifecycle order. */
  stop() {
    this.generation++;
    this.api.tts?.stop();
    this.finish?.(); this.finish = null;
    clearTimeout(this.timer);
    // Serialize document lifecycle operations, including cancellation during creation.
    this.offscreenTask = this.offscreenTask.then(async () => {
      if (this.api.offscreen && await this.api.offscreen.hasDocument()) await this.api.offscreen.closeDocument();
    }).catch(() => {});
  }
  /** Create at most one offscreen document; playback itself must not block stop(). */
  async playFiles(files, repeat, current, legacy = false) {
    this.offscreenTask = this.offscreenTask.then(async () => {
      if (!current()) return;
      if (!await this.api.offscreen.hasDocument()) await this.api.offscreen.createDocument({url: 'audio-player.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Play locally packaged, user-enabled status announcements.'});
    });
    await this.offscreenTask;
    if (!current()) return;
    const result = await this.api.runtime.sendMessage(legacy ? {target: 'audio-player', type: 'play'} : {target: 'audio-player', type: 'play', files, repeat, pauseMs: 1000});
    if (current() && result?.error) throw new Error(result.error);
  }
  /** Choose exactly one source and apply repeat policy, respecting caller cancellation. */
  async play(alert, settings, signal) {
    this.stop();
    const generation = this.generation, current = () => generation === this.generation && !signal?.aborted;
    const abort = () => { if (generation === this.generation) this.stop(); };
    signal?.addEventListener('abort', abort, {once: true});
    try {
      if (!current()) return;
      const useClip = settings.suspendedClipEnabled && isSuspended(alert);
      if (useClip) { await this.playFiles(['audio/suspended.mp3'], 3, current, true); return; }
      const phrase = settings.speechEnabled ? spokenStatus(alert) : '';
      if (phrase) {
        const recordedMode = settings.voiceSource !== 'microsoft';
        const files = recordedMode && statusRecordings(alert, settings.voiceGender);
        if (files) {
          try { await this.playFiles(files, settings.repeatSpeech === true ? 2 : 1, current); return; }
          catch (error) {
            if (!current()) return;
            this.offscreenTask = this.offscreenTask.catch(() => {}).then(async () => {if (this.api.offscreen && await this.api.offscreen.hasDocument()) await this.api.offscreen.closeDocument();});
            await this.offscreenTask;
          }
        }
        // A missing-file fallback must use the recording gender, not a manual
        // TTS override that may belong to the opposite gender.
        const voice = chooseVoice(await availableVoices(this.api), settings.voiceGender || 'female', recordedMode ? '' : settings.voiceName);
        if (!current()) return;
        if (!voice) throw new Error(recordedMode
          ? `No matching ${settings.voiceGender || 'female'} voice was found for the missing-recording fallback. Install a matching-gender local English voice; the opposite gender will not be substituted.`
          : `No matching ${settings.voiceGender || 'female'} voice was found. Choose an installed voice in the extension popup.`);
        for (let i = 0; i < (settings.repeatSpeech === true ? 2 : 1) && current(); i++) {
          if (i) await new Promise(resolve => { this.finish = resolve; this.timer = setTimeout(resolve, 1000); });
          if (!current()) return;
          await new Promise((resolve, reject) => {
            this.finish = resolve;
            this.api.tts.speak(phrase, {voiceName: voice.voiceName, lang: voice.lang || 'en-US', enqueue: false,
              onEvent: event => {
                if (event.type === 'error') reject(new Error(event.errorMessage || 'Speech playback failed.'));
                else if (['end', 'interrupted', 'cancelled'].includes(event.type)) resolve();
              }}, () => { if (this.api.runtime.lastError) reject(new Error(this.api.runtime.lastError.message)); });
          });
        }
      }
    } catch (error) { if (current()) throw error; }
    finally { signal?.removeEventListener('abort', abort); if (generation === this.generation) this.finish = null; }
  }
}
