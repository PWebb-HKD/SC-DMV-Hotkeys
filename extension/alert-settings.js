/** Only non-sensitive alert preferences persist; session keys mirror them for active workflows. */
export const ALERT_DEFAULTS=Object.freeze({alertsEnabled:false,speechEnabled:false,repeatSpeech:false,suspendedClipEnabled:false,voiceSource:'recordings',voiceGender:'female',voiceName:''});
export const ALERT_KEYS=Object.freeze(Object.keys(ALERT_DEFAULTS));
let writing=Promise.resolve();
const serial=action=>{const task=writing.then(action);writing=task.catch(()=>{});return task;};
function valid(source={}) {
  const values={};
  if(!source||typeof source!=='object')return values;
  for(const key of ALERT_KEYS) {
    if(typeof ALERT_DEFAULTS[key]==='boolean'&&typeof source[key]==='boolean')values[key]=source[key];
    else if(key==='voiceSource'&&['recordings','microsoft'].includes(source[key]))values[key]=source[key];
    else if(key==='voiceGender'&&['female','male'].includes(source[key]))values[key]=source[key];
    else if(key==='voiceName'&&typeof source[key]==='string')values[key]=source[key];
  }
  return values;
}
export function initializeAlertPreferences() {
  return serial(async()=>{
    const [local,session]=await Promise.all([chrome.storage.local.get('alertPreferences'),chrome.storage.session.get(ALERT_KEYS)]);
    // Preserve the user's current selections when upgrading from session-only settings.
    const prefs={...ALERT_DEFAULTS,...valid(session),...valid(local.alertPreferences)};
    if(JSON.stringify(local.alertPreferences)!==JSON.stringify(prefs))await chrome.storage.local.set({alertPreferences:prefs});
    await chrome.storage.session.set(prefs);return prefs;
  });
}
export function saveAlertPreferences(changes) {
  return serial(async()=>{
    const {alertPreferences}=await chrome.storage.local.get('alertPreferences'),updates=valid(changes);
    const prefs={...ALERT_DEFAULTS,...valid(alertPreferences),...updates};
    await chrome.storage.local.set({alertPreferences:prefs});await chrome.storage.session.set(updates);return prefs;
  });
}
export function restoreAlertPreferences() {
  return serial(async()=>{
    const {alertPreferences}=await chrome.storage.local.get('alertPreferences');
    const prefs={...ALERT_DEFAULTS,...valid(alertPreferences)};await chrome.storage.session.set(prefs);return prefs;
  });
}
