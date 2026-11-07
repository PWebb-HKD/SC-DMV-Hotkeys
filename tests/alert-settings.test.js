// Preference migration and restart persistence without persisting private session data.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {ALERT_DEFAULTS,ALERT_KEYS,initializeAlertPreferences,saveAlertPreferences,restoreAlertPreferences} from '../extension/alert-settings.js';
const local={},session={};
const store=data=>({get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,data[key]])),set:async values=>Object.assign(data,values)});
globalThis.chrome={storage:{local:store(local),session:store(session)}};
const clear=object=>{for(const key of Object.keys(object))delete object[key];};
test('first use keeps alerts off and upgrades preserve active session selections without saving private data',async()=>{
  assert.deepEqual(await initializeAlertPreferences(),ALERT_DEFAULTS);
  clear(local);clear(session);Object.assign(session,{alertsEnabled:true,speechEnabled:true,repeatSpeech:true,voiceSource:'microsoft',voiceGender:'male',voiceName:'Fixture Voice',credentials:{user:'synthetic-user',password:'synthetic-password'},history:[{value:'fixture'}],queue:{values:['123']},blacklist:['fixture']});
  const migrated=await initializeAlertPreferences();assert.equal(migrated.alertsEnabled,true);assert.equal(migrated.voiceName,'Fixture Voice');
  assert.deepEqual(Object.keys(local),['alertPreferences']);assert.deepEqual(Object.keys(local.alertPreferences).sort(),[...ALERT_KEYS].sort());
  assert.equal(local.alertPreferences.credentials,undefined);assert.equal(local.alertPreferences.history,undefined);assert.equal(local.alertPreferences.blacklist,undefined);
});
test('all selected preferences survive cleared session storage and startup does not replay data',async()=>{
  const expected={alertsEnabled:true,speechEnabled:true,repeatSpeech:true,suspendedClipEnabled:true,voiceSource:'microsoft',voiceGender:'male',voiceName:'Fixture Voice'};
  await saveAlertPreferences(expected);clear(session);await initializeAlertPreferences();assert.deepEqual(session,expected);
  clear(session);await restoreAlertPreferences();assert.deepEqual(session,expected);
  await saveAlertPreferences({alertsEnabled:false,speechEnabled:false,suspendedClipEnabled:false});clear(session);await restoreAlertPreferences();assert.equal(session.alertsEnabled,false);assert.equal(session.speechEnabled,false);assert.equal(session.repeatSpeech,true);assert.equal(session.voiceName,'Fixture Voice');
});
test('concurrent changes merge and invalid/private fields cannot enter saved preferences',async()=>{
  await Promise.all([saveAlertPreferences({alertsEnabled:true}),saveAlertPreferences({speechEnabled:true,voiceGender:'female'})]);
  assert.equal(local.alertPreferences.alertsEnabled,true);assert.equal(local.alertPreferences.speechEnabled,true);assert.equal(local.alertPreferences.voiceGender,'female');
  await saveAlertPreferences({voiceSource:'invalid',voiceGender:'invalid',credentials:'never saved'});assert.equal(local.alertPreferences.voiceSource,'microsoft');assert.equal(local.alertPreferences.voiceGender,'female');assert.equal(local.alertPreferences.credentials,undefined);
});
