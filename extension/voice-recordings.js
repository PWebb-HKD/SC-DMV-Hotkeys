/**
 * Single catalog of packaged status recordings, shared by selection, playback
 * validation, and asset checks. Return null when any section lacks a recording so
 * the entire announcement uses one consistent TTS source and gender.
 */
const STATUS_FILES = {
  'LICENSE EXPIRED': 'Expired_Drivers_License', EXPIRED: 'Expired_Tag',
  'NOT LICENSED ID ONLY': 'Identification_Only', 'NOT LICENSED': 'No_Drivers_License_Or_ID_Card',
  'NO LONGER LICENSED IN SC': 'No_Longer_Has_License_in_South_Carolina',
  'LICENSE SUSPENDED': 'Suspended_Drivers_License', 'TAG SUSPENDED': 'Suspended_Tag',
  'VALID LICENSE': 'Valid_Drivers_License', 'TAG VALID': 'Valid_Tag'
};
const COMBINED_TAG = 'Expired_and_Suspended_Tag';
export const RECORDING_PATHS = ['Female', 'Male'].flatMap(gender => [...Object.values(STATUS_FILES), COMBINED_TAG].map(name => `audio/voices/${gender}_${name}.mp3`));
/** Select files for all headings or return null; combine expired+suspended tags into one clip. */
export function statusRecordings(alert, gender = 'female') {
  const titles = [...new Set((alert.sections || []).map(section => section.title).filter(Boolean))];
  if (!titles.length) return null;
  const prefix = gender === 'male' ? 'Male' : 'Female';
  const combined = titles.length === 2 && titles.includes('TAG SUSPENDED') && titles.includes('EXPIRED');
  const names = combined ? [COMBINED_TAG] : titles.map(title => STATUS_FILES[title]);
  // A missing recording switches the entire announcement to TTS.
  return names.every(Boolean) ? names.map(name => `audio/voices/${prefix}_${name}.mp3`) : null;
}
