// Audio policy and offscreen playback with injected browser APIs and deterministic completion events.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AudioAlerts, chooseVoice, spokenStatus, isSuspended} from '../extension/audio-alerts.js';
import {licenseStatus} from '../extension/status-alerts.js';
import {RECORDING_PATHS, statusRecordings} from '../extension/voice-recordings.js';
/** Run the real player body in a controlled browser-like VM; imports are injected. */
function playerSource() {
  return readFileSync(new URL('../extension/audio-player.js', import.meta.url), 'utf8')
    .replace(/^import \{RECORDING_PATHS\} from '\.\/voice-recordings\.js';\r?\n/m, '');
}
const alert = (...titles) => ({sections: titles.map(title => ({title, lines: ['Private details must not be spoken'], items: ['Reason × 10']}))});
const voices = [{voiceName: 'Microsoft David Desktop', lang: 'en-US'}, {voiceName: 'Microsoft Zira Desktop', lang: 'en-US'}, {voiceName: 'Remote', lang: 'en-US', remote: true}];
/** Supply deterministic local voices, speech completion, and offscreen lifecycle events. */
function mockApi() {
  const calls = [], messages = []; let exists = false;
  return {calls, messages, runtime: {get lastError() {return null;}, sendMessage: async message => {messages.push(message); return {ok: true};}},
    tts: {getVoices: cb => cb(voices), stop() {}, speak(text, options, cb) {calls.push({text, options, at: Date.now()}); cb(); queueMicrotask(() => options.onEvent({type: 'end'}));}},
    offscreen: {hasDocument: async () => exists, createDocument: async () => {exists = true;}, closeDocument: async () => {exists = false;}},
  };
}
test('spoken status contains only status phrases and combines expired suspended tags', () => {
  assert.equal(spokenStatus(alert('TAG SUSPENDED', 'EXPIRED')), 'Suspended tag. Expired tag');
  for (const title of ['LICENSE SUSPENDED', 'NOT LICENSED', 'NOT LICENSED ID ONLY', 'LICENSE EXPIRED', 'VALID LICENSE', 'NO LONGER LICENSED IN SC', 'TAG VALID', 'STATUS UNAVAILABLE']) {
    assert.ok(spokenStatus(alert(title))); assert.doesNotMatch(spokenStatus(alert(title)), /Private|Reason|10/);
  }
  assert.equal(isSuspended(alert('LICENSE SUSPENDED')), true);
  assert.equal(isSuspended(alert('TAG SUSPENDED')), true);
  assert.equal(isSuspended(alert('EXPIRED')), false);
});
test('male/female selection uses local named voices and permits an explicit installed voice', () => {
  assert.equal(chooseVoice(voices, 'male').voiceName, voices[0].voiceName);
  assert.equal(chooseVoice(voices, 'female').voiceName, voices[1].voiceName);
  assert.equal(chooseVoice(voices, 'male', voices[1].voiceName).voiceName, voices[1].voiceName);
  assert.equal(chooseVoice(voices, 'female', 'Remote'), undefined);
  assert.equal(chooseVoice([], 'male'), undefined);
});
test('speech repeats exactly twice with a full second after the first utterance ends', async () => {
  const api = mockApi(), audio = new AudioAlerts(api);
  await audio.play(alert('TAG VALID'), {speechEnabled: true, voiceSource: 'microsoft', repeatSpeech: true, voiceGender: 'male'});
  assert.equal(api.calls.length, 2); assert.equal(api.calls[0].text, 'Valid tag');
  assert.ok(api.calls[1].at - api.calls[0].at >= 990);
  assert.equal(api.calls[0].options.voiceName, voices[0].voiceName);
});
test('new search cancellation stops speech and prevents the repeated announcement', async () => {
  const api = mockApi(), audio = new AudioAlerts(api), controller = new AbortController();
  const task = audio.play(alert('LICENSE SUSPENDED'), {speechEnabled: true, voiceSource: 'microsoft', repeatSpeech: true}, controller.signal);
  await new Promise(resolve => setTimeout(resolve, 10)); controller.abort(); await task;
  assert.equal(api.calls.length, 1);
});
test('off defaults are silent; the special clip runs only for a suspended status', async () => {
  const api = mockApi(), audio = new AudioAlerts(api);
  await audio.play(alert('LICENSE SUSPENDED'), {});
  await audio.play(alert('TAG VALID'), {suspendedClipEnabled: true});
  assert.equal(api.messages.length, 0); assert.equal(api.calls.length, 0);
  await audio.play(alert('TAG SUSPENDED'), {suspendedClipEnabled: true});
  assert.deepEqual(api.messages, [{target: 'audio-player', type: 'play'}]);
});
test('special clip replaces speech for suspended licenses, tags, and combined suspended expired tags', async () => {
  for (const record of [alert('LICENSE SUSPENDED'), alert('TAG SUSPENDED'), alert('TAG SUSPENDED', 'EXPIRED')]) {
    const api = mockApi(), audio = new AudioAlerts(api);
    await audio.play(record, {speechEnabled: true, suspendedClipEnabled: true});
    assert.equal(api.calls.length, 0); assert.equal(api.messages.length, 1);
  }
});
test('a suspended clip does not require any installed synthesized voice', async () => {
  const api = mockApi(), audio = new AudioAlerts(api); api.tts.getVoices = cb => cb([]);
  await audio.play(alert('LICENSE SUSPENDED'), {speechEnabled: true, suspendedClipEnabled: true});
  assert.equal(api.messages.length, 1);
});
test('enabling the special clip preserves speech for nonsuspended statuses', async () => {
  const api = mockApi(), audio = new AudioAlerts(api);
  await audio.play(alert('EXPIRED'), {speechEnabled: true, voiceSource: 'microsoft', suspendedClipEnabled: true});
  assert.deepEqual(api.calls.map(call => call.text), ['Expired tag']);
  assert.equal(api.messages.length, 0);
});
test('speech plays once by default and when the repeat toggle is explicitly disabled', async () => {
  for (const repeatSpeech of [undefined, false]) {
    const api = mockApi(), audio = new AudioAlerts(api);
    await audio.play(alert('VALID LICENSE'), {speechEnabled: true, voiceSource: 'microsoft', repeatSpeech});
    assert.equal(api.calls.length, 1); assert.equal(api.calls[0].text, 'Valid license');
  }
});

test('stopping during offscreen creation prevents stale playback and closes the created document', async () => {
  const api = mockApi(), audio = new AudioAlerts(api); let release, exists = false;
  api.offscreen.hasDocument = async () => exists;
  api.offscreen.createDocument = () => new Promise(resolve => {release = () => {exists = true; resolve();};});
  api.offscreen.closeDocument = async () => {exists = false;};
  const task = audio.play(alert('LICENSE SUSPENDED'), {suspendedClipEnabled: true});
  while (!release) await new Promise(resolve => setImmediate(resolve));
  audio.stop(); release(); await task; await audio.offscreenTask;
  assert.equal(api.messages.length, 0); assert.equal(exists, false);
});
test('offscreen player plays the packaged clip exactly three times, never concurrently', async () => {
  let listener, playing = false, plays = 0;
  class Audio {
    constructor(url) {assert.equal(url, 'extension/audio/suspended.mp3');}
    async play() {assert.equal(playing, false); playing = true; plays++; queueMicrotask(() => {playing = false; this.onended();});}
    pause() {playing = false;}
  }
  vm.runInNewContext(playerSource(), {RECORDING_PATHS, Audio, chrome: {runtime: {id: 'extension', getURL: path => 'extension/' + path, onMessage: {addListener(fn) {listener = fn;}}}}});
  const response = await new Promise(resolve => listener({target: 'audio-player', type: 'play'}, {id: 'extension'}, resolve));
  assert.equal(response.ok, true); assert.equal(plays, 3);
});

test('stopping an already playing clip closes its document without waiting for the clip to finish', async () => {
  const api = mockApi(), audio = new AudioAlerts(api); let started, rejectPlayback, closed = false;
  const playing = new Promise(resolve => {started = resolve;});
  api.runtime.sendMessage = () => new Promise((resolve, reject) => {rejectPlayback = reject; started();});
  api.offscreen.closeDocument = async () => {closed = true; rejectPlayback?.(new Error('Document closed'));};
  const task = audio.play(alert('TAG SUSPENDED'), {suspendedClipEnabled: true});
  await playing; audio.stop(); await audio.offscreenTask; await task;
  assert.equal(closed, true);
});

test('all 20 packaged MP3 paths exist and combined tag statuses choose one recording', () => {
  assert.equal(RECORDING_PATHS.length, 20);assert.equal(new Set(RECORDING_PATHS).size,20);
  for (const path of RECORDING_PATHS) assert.ok(readFileSync(new URL('../extension/'+path,import.meta.url)).length>0);
  for (const gender of ['male','female']) {
    const files=statusRecordings(alert('TAG SUSPENDED','EXPIRED'),gender);
    assert.equal(files.length,1);assert.match(files[0],/Expired_and_Suspended_Tag\.mp3$/);
    assert.ok(files[0].includes(gender==='male'?'Male_':'Female_'));
  }
  assert.deepEqual(statusRecordings(alert('TAG VALID'),'male'),['audio/voices/Male_Valid_Tag.mp3']);
  assert.deepEqual(statusRecordings(alert('TAG VALID'),'female'),['audio/voices/Female_Valid_Tag.mp3']);
  assert.equal(statusRecordings(alert('STATUS UNAVAILABLE')),null);
});
test('recordings are the default source, play once or twice on request, and never invoke TTS', async () => {
  for(const gender of ['male','female'])for(const repeatSpeech of [false,true]){
    const api=mockApi(),audio=new AudioAlerts(api);
    await audio.play(alert('LICENSE SUSPENDED'),{speechEnabled:true,voiceGender:gender,repeatSpeech});
    assert.equal(api.calls.length,0);assert.equal(api.messages.length,1);
    assert.deepEqual(api.messages[0].files,[`audio/voices/${gender==='male'?'Male':'Female'}_Suspended_Drivers_License.mp3`]);
    assert.equal(api.messages[0].repeat,repeatSpeech?2:1);assert.equal(api.messages[0].pauseMs,1000);
  }
});
test('missing recordings fall back to the same gender, ignoring opposite-gender manual overrides', async () => {
  for(const gender of ['male','female']){
    const api=mockApi(),audio=new AudioAlerts(api);
    await audio.play(alert('STATUS UNAVAILABLE'),{speechEnabled:true,voiceGender:gender,voiceName:voices[gender==='male'?1:0].voiceName});
    assert.equal(api.messages.length,0);assert.equal(api.calls.length,1);
    assert.equal(api.calls[0].options.voiceName,voices[gender==='male'?0:1].voiceName);
  }
});
test('Microsoft mode bypasses matching recordings and missing same-gender voices are reported', async () => {
  const api=mockApi(),audio=new AudioAlerts(api);
  await audio.play(alert('VALID LICENSE'),{speechEnabled:true,voiceSource:'microsoft',voiceGender:'male'});
  assert.equal(api.messages.length,0);assert.equal(api.calls.length,1);
  api.tts.getVoices=cb=>cb([voices[1]]);
  await assert.rejects(audio.play(alert('STATUS UNAVAILABLE'),{speechEnabled:true,voiceGender:'male'}),/No matching male voice/);
});
test('an unknown status uses same-gender speech for the whole announcement without reading details', async () => {
  const api=mockApi(),audio=new AudioAlerts(api);
  await audio.play(alert('LICENSE EXPIRED','NEW STATUS'),{speechEnabled:true,voiceGender:'male'});
  assert.equal(api.messages.length,0);assert.equal(api.calls[0].text,'License expired. new status');
  assert.equal(api.calls[0].options.voiceName,voices[0].voiceName);
});
test('media failure closes the player before same-gender TTS fallback starts', async () => {
  const api=mockApi(),audio=new AudioAlerts(api);let closed=false;
  api.runtime.sendMessage=async()=>({error:'Missing MP3'});api.offscreen.closeDocument=async()=>{closed=true;};
  const original=api.tts.speak;api.tts.speak=(...args)=>{assert.equal(closed,true);original(...args);};
  await audio.play(alert('VALID LICENSE'),{speechEnabled:true,voiceGender:'male'});
  assert.equal(api.calls[0].options.voiceName,voices[0].voiceName);
});
test('recorded announcements repeat only after their first playback ends and a one-second pause', async () => {
  let listener;const events=[];
  class Audio {
    constructor(url){this.url=url;}
    pause(){}
    async play(){events.push(this.url);queueMicrotask(()=>this.onended());}
  }
  const context={Audio,setTimeout(fn,ms){events.push(ms);queueMicrotask(fn);},chrome:{runtime:{id:'extension',getURL:path=>path,onMessage:{addListener(fn){listener=fn;}}}}};
  vm.runInNewContext(playerSource(),{...context, RECORDING_PATHS});
  const file='audio/voices/Male_Valid_Tag.mp3';
  const result=await new Promise(resolve=>listener({target:'audio-player',type:'play',files:[file],repeat:2},{id:'extension'},resolve));
  assert.equal(result.ok,true);assert.deepEqual(events,[file,1000,file]);
});

test('valid-tag announcements use the selected recording and repeat preference without TTS', async () => {
  for (const gender of ['male','female']) for (const repeatSpeech of [false,true]) {
    const api=mockApi(),audio=new AudioAlerts(api);
    await audio.play(alert('TAG VALID'),{speechEnabled:true,voiceGender:gender,repeatSpeech});
    assert.equal(api.calls.length,0);assert.equal(api.messages[0].repeat,repeatSpeech?2:1);
    assert.deepEqual(api.messages[0].files,[`audio/voices/${gender==='male'?'Male':'Female'}_Valid_Tag.mp3`]);
  }
});


test('temporary alcohol license uses only the ordinary valid-license speech and recordings', async () => {
  const payload = licenseStatus('Status - DL: TEMPORARY ALCOHOL CDL: DISQUALIFIED Driver License No: 123456789 Name: FICTIONAL, PERSON License Information Type Class Function Issued Expires Printed Date Restr.Endor.Document Identifier Current (ACN / DDN) TA DL D Original 01/01/2026 12/31/2026 N N SYNTHETIC', new Date('2026-10-28T16:00:00Z'));
  assert.deepEqual(payload.sections[0].lines, ['TEMPORARY ALCOHOL LICENSE']);
  assert.equal(spokenStatus(payload), 'Valid license');
  for (const gender of ['male', 'female']) {
    assert.deepEqual(statusRecordings(payload, gender), [`audio/voices/${gender === 'male' ? 'Male' : 'Female'}_Valid_Drivers_License.mp3`]);
  }
  const api = mockApi();
  await new AudioAlerts(api).play(payload, {speechEnabled:true, voiceSource:'microsoft', voiceGender:'male'});
  assert.deepEqual(api.calls.map(call => call.text), ['Valid license']);
});
