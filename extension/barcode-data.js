/**
 * Pure report-to-AAMVA mapping for driver/ID v09 and the observed SC registration v01
 * profile. Preserve SC field choices documented below; generic registration mappings
 * differ. Unknown credential metadata stays blank/unavl, never copied from examples.
 */
import {parseReportDate, isTemporaryPlate} from './status-alerts.js';
const flat = value => String(value || '').replace(/\s+/g, ' ').trim();
const datePattern = '(\\d{2}\\s*/\\s*\\d{2}\\s*/\\s*\\d{4})';
function clean(value) {
  const result = flat(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (/[^\x20-\x7e]/.test(result)) throw new Error('The report contains characters that cannot be represented reliably in the barcode.');
  return result;
}
function date(value, iso = false) {
  const parsed = parseReportDate(flat(value).match(/^\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4}/)?.[0]);
  if (!parsed) return '';
  const mm = String(parsed.month).padStart(2, '0'), dd = String(parsed.day).padStart(2, '0'), yyyy = String(parsed.year).padStart(4, '0');
  return iso ? yyyy + mm + dd : mm + dd + yyyy;
}
/** Read the first occurrence of each known label, ending at the next label. */
function labeled(text, labels) {
  const pattern = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|');
  const matches = [...text.matchAll(new RegExp(`\\b(${pattern})\\s*:`, 'gi'))], values = {};
  matches.forEach((match, index) => {
    const key = flat(match[1]).toLowerCase();
    if (!(key in values)) values[key] = flat(text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length));
  });
  return values;
}
function requireFields(values, keys) {
  const missing = keys.filter(key => !values[key]);
  if (missing.length) throw new Error(`The report is missing ${missing.join(', ')}. Open the complete driver or vehicle record and try Alt+B again.`);
}
function names(value) {
  const comma = value.indexOf(',');
  if (comma < 1) throw new Error('The driver name could not be separated into family and given names.');
  const family = clean(value.slice(0, comma)), given = clean(value.slice(comma + 1)).split(/\s+/);
  if (!given[0]) throw new Error('The driver first name was not found.');
  return {family, first: given[0], middle: given.slice(1).join(',') || 'NONE'};
}
function valueField(value, max) {
  if (!value) return 'unavl';
  const result = clean(value);
  if (result.length > max) throw new Error(`A report value exceeds the supported ${max}-character barcode field length.`);
  return result;
}
export function raceEthnicity(value) {
  // Version 09 DCL uses D20's legacy Driver Race And Ethnicity (DDVRAC),
  // not the newer, separate Person Race (BPERAC) code list.
  const label = clean(value).replace(/[()]/g, '').replace(/[-/]/g, ' ').replace(/\s+/g, ' ').trim();
  const codes = {
    W: 'W', WHT: 'W', WHI: 'W', WHITE: 'W', CAUCASIAN: 'W', 'WHITE CAUCASIAN': 'W',
    B: 'BK', BK: 'BK', BLK: 'BK', BLACK: 'BK', 'AFRICAN AMERICAN': 'BK', 'BLACK AFRICAN AMERICAN': 'BK',
    A: 'AP', AP: 'AP', ASN: 'AP', ASI: 'AP', ASIAN: 'AP', 'ASIAN OR PACIFIC ISLANDER': 'AP', 'ASIAN PACIFIC ISLANDER': 'AP',
    P: 'AP', 'PACIFIC ISLANDER': 'AP', 'NATIVE HAWAIIAN': 'AP', 'NATIVE HAWAIIAN OR PACIFIC ISLANDER': 'AP',
    I: 'AI', AI: 'AI', 'AMERICAN INDIAN': 'AI', 'ALASKAN INDIAN': 'AI', 'ALASKA NATIVE': 'AI',
    'NATIVE AMERICAN': 'AI', 'ALASKAN OR AMERICAN INDIAN': 'AI', 'AMERICAN INDIAN OR ALASKA NATIVE': 'AI',
    H: 'H', HISP: 'H', HISPAN: 'H', HISPANIC: 'H', 'HISPANIC ORIGIN': 'H', LATINO: 'H', 'HISPANIC OR LATINO': 'H',
    O: 'O', 'NON HISPANIC': 'O', U: 'U', UNK: 'U', UNKNOWN: 'U'
  };
  return codes[label] || null;
}
/** Frame ASCII subfiles with byte offsets/lengths and a terminating carriage return.
 * ASCII validation makes JavaScript string lengths equal encoded byte lengths. */
export function frameAamva(subfiles, {kind = 'driver'} = {}) {
  const driver = kind === 'driver';
  const header = `@\n\x1e\r${driver ? 'ANSI ' : 'AAMVA'}636005${driver ? '0900' : '01'}${String(subfiles.length).padStart(2, '0')}`;
  const segments = subfiles.map(({type, fields}) => type + fields.map(([key, value]) => key + value).join('\n') + '\r');
  let offset = header.length + 10 * subfiles.length;
  const directory = segments.map((segment, index) => {
    if (offset > 9999 || segment.length > 9999) throw new Error('Barcode data exceeds the supported format size.');
    const entry = subfiles[index].type + String(offset).padStart(4, '0') + String(segment.length).padStart(4, '0');
    offset += segment.length; return entry;
  }).join('');
  const payload = header + directory + segments.join('');
  if (/[^\x0a\x0d\x1e\x20-\x7e]/.test(payload)) throw new Error('Barcode data is not ASCII.');
  return payload;
}
/** Map first-heading demographics and the Current credential row; blank DL stays blank. */
export function driverBarcode(raw) {
  const text = flat(raw), start = text.search(/\bCustomer\s+No\s*:/i);
  if (start < 0) throw new Error('A driver record heading was not found.');
  const heading = text.slice(start).split(/\bStatus\s*[-–—]\s*DL\s*:/i)[0];
  const v = labeled(heading, ['Customer No', 'Driver License No', 'Name', 'Address', 'City', 'State', 'Zip', 'County', 'DOB', 'Sex', 'Driver Training', 'Height', 'Weight', 'Eye Color', 'Race']);
  requireFields(v, ['name', 'address', 'city', 'state', 'zip', 'dob']);
  const licenseNumber = (v['driver license no'] || '').replace(/\s/g, '');
  if (licenseNumber && !/^\d{1,9}$/.test(licenseNumber)) throw new Error('The driver license / ID number is invalid. The customer number will not be substituted.');
  const name = names(v.name), warnings = [];
  const dob = date(v.dob); if (!dob) throw new Error('The driver date of birth is invalid.');
  const current = text.match(/\bCurrent\s*(?:\(\s*ACN\s*\/\s*DDN\s*\))?\s*([\s\S]*?)(?=\bPrior\b|\bAddress\s+Change\b|\bPoint\s+Summary\b|\bSuspension\s+Summary\b|$)/i)?.[1] || '';
  const row = current.match(new RegExp(`^(ID|DL|CDL|BP)\\s*(?:\\(\\s*[A-Z]\\s*\\))?\\s*([A-Z]{0,6})\\s+([A-Z ]+?)\\s+${datePattern}\\s+${datePattern}(?:\\s+${datePattern})?\\s+([YN])\\s+([YN])\\s+(\\S+)`, 'i'));
  const type = row?.[1].toUpperCase() === 'ID' ? 'ID' : 'DL';
  const credentialClass = type === 'ID' || row?.[2]?.toUpperCase() === 'ID' ? 'I' : row?.[2]?.toUpperCase() || 'unavl';
  const issued = row && date(row[4]), expires = row && date(row[5]);
  if (!issued || !expires) warnings.push('Current credential dates were unavailable; encoded as unavl.');
  const height = v.height?.match(/^(\d)\s*['′]\s*(\d{1,2})\s*["″]?$/);
  const inches = height && +height[1] * 12 + +height[2];
  const heightValue = inches && +height[2] < 12 && inches < 120 ? `${String(inches).padStart(3, '0')} in` : 'unavl';
  if (heightValue === 'unavl') warnings.push('Height could not be converted; encoded as unavl.');
  const zip = v.zip.replace(/[ -]/g, ''); if (!/^\d{5}(?:\d{4})?$/.test(zip)) throw new Error('The driver ZIP code is invalid.');
  const eyes = {BROWN: 'BRO', BLUE: 'BLU', GREEN: 'GRN', HAZEL: 'HAZ', GRAY: 'GRY', GREY: 'GRY', BLACK: 'BLK'};
  const eye = clean(v['eye color']);
  const fields = [
    ['DCA', credentialClass], ...(type === 'DL' ? [['DCB', row?.[7]?.toUpperCase() === 'N' ? 'NONE' : 'unavl'], ['DCD', row?.[8]?.toUpperCase() === 'N' ? 'NONE' : 'unavl']] : []),
    ['DBA', expires || 'unavl'], ['DCS', valueField(name.family, 40)], ['DAC', valueField(name.first, 40)], ['DAD', valueField(name.middle, 40)],
    ['DBD', issued || 'unavl'], ['DBB', dob], ['DBC', /^M$/i.test(v.sex) ? '1' : /^F$/i.test(v.sex) ? '2' : '9'],
    ['DAY', /^(BLK|BLU|BRO|GRY|GRN|HAZ|MAR|PNK|DIC|UNK)$/.test(eye) ? eye : eyes[eye] || 'unavl'], ['DAU', heightValue],
    ['DAG', valueField(v.address, 35)], ['DAI', valueField(v.city, 20)], ['DAJ', valueField(v.state, 2)], ['DAK', zip.padEnd(11, ' ')],
    ['DAQ', licenseNumber], ['DCF', row && /^\d{1,25}$/.test(row[9]) ? row[9] : 'unavl'], ['DCG', 'USA'],
    ['DDE', 'U'], ['DDF', 'U'], ['DDG', 'U'], ['DCK', '']
  ];
  const race = raceEthnicity(v.race);
  if (race) fields.push(['DCL', race.padEnd(3, ' ')]);
  else warnings.push('Race/ethnicity was missing or not recognized in the version-09 code list; DCL was not encoded.');
  // These optional elements occur in the supplied official SC barcode. Their
  // credential-only values are not recoverable from the report heading.
  fields.push(['DCM', '    '], ['DCR', ''], ['DDC', ''], ['DDD', ''], ['DAW', /^\d{1,3}$/.test(v.weight) ? v.weight.padStart(3, '0') : ''], ['DAX', ''], ['DDH', ''], ['DDI', ''], ['DDK', '']);
  if (type === 'DL' && (!row || row[7].toUpperCase() !== 'N' || row[8].toUpperCase() !== 'N')) warnings.push('Actual restriction/endorsement codes are unavailable; flagged fields are encoded as unavl.');
  warnings.push('Credential-only inventory and other metadata not present in the report remain blank; values from another barcode are never copied.');
  return {type: 'barcode', kind: 'driver', title: `${type === 'ID' ? 'ID' : 'Driver'} import barcode`, profile: 'AAMVA DL/ID v09 · SC', payload: frameAamva([{type, fields}]),
    summary: `${name.family}, ${name.first} · ${licenseNumber || 'No license number'} · Class ${credentialClass}`, warnings};
}
/** Separate street/city/state/ZIP only when delimiters or one clear suffix permit it.
 * Inferred boundaries are flagged for user verification; ambiguous addresses fail. */
export function ownerAddress(raw) {
  const address = flat(raw), tail = address.match(/^(.*?)[,\s]+([A-Z]{2})[\s,]+(\d{5}(?:[ -]?\d{4})?)$/i);
  if (!tail) return null;
  const prefix = tail[1].replace(/,\s*$/, '').trim(), comma = prefix.lastIndexOf(',');
  const result = (street, city, inferred = false) => ({street: street.trim(), city: city.trim(), state: tail[2].toUpperCase(), zip: tail[3].replace(/[ -]/g, ''), inferred});
  if (comma > 0 && prefix.slice(comma + 1).trim()) return result(prefix.slice(0, comma), prefix.slice(comma + 1));
  const box = prefix.match(/^(P\.?\s*O\.?\s+BOX\s+\d+[A-Z]?)\s+([A-Z][A-Z .'-]+)$/i);
  if (box) return result(box[1], box[2], true);
  const suffix = /\b(?:AVENUE|AVE|BOULEVARD|BLVD|CIRCLE|CIR|COURT|CT|DRIVE|DR|HIGHWAY|HWY|LANE|LN|LOOP|PARKWAY|PKWY|PLACE|PL|ROAD|RD|STREET|ST|TERRACE|TER|TRAIL|TRL|WAY|COVE|CV|PIKE|PATH|POINT|PT|PLAZA|PLZ|TURNPIKE|TPKE)\.?\s+/gi;
  const candidates = [];
  for (const match of prefix.matchAll(suffix)) {
    // Do not split a leading street-name word such as "ST JOHN...".
    if (!/^\d+\S*\s+\S/.test(prefix.slice(0, match.index))) continue;
    let boundary = match.index + match[0].length;
    const unit = prefix.slice(boundary).match(/^(?:APT|UNIT|STE|SUITE|LOT|#)\s*[A-Z0-9-]+\s+/i);
    if (unit) boundary += unit[0].length;
    const city = prefix.slice(boundary).trim();
    if (/^[A-Z][A-Z .'-]*$/i.test(city)) candidates.push(result(prefix.slice(0, boundary), city, true));
  }
  return candidates.length === 1 ? candidates[0] : null;
}
/** Map registration fields to the observed SC RG profile. */
export function vehicleBarcode(raw) {
  const text = flat(raw), start = text.search(/\bVIN\s*:/i);
  if (start < 0) throw new Error('A vehicle record heading was not found.');
  const body = text.slice(start).split(/\b(?:Enforcement\s+Description\s*:|Document\s+obtained\s+from\s+DMV\s+web\s+site\s*:)/i)[0];
  const v = labeled(body, ['VIN', 'Year', 'Make', 'Model', 'Body', 'Empty Weight', 'Title Number', 'Status', 'Issue Date', 'Dup', 'Owner Number', 'Owner Name', 'Owner Address', 'Last Transaction', 'Plate Number', 'Plate Class', 'Vehicle Type', 'Date of Issue', 'Plate Exp Date', 'Decal Exp Date', 'Decal Number', 'Window Sticker Number', 'GVW', 'Equip Number', 'Annual Fee', 'County', 'Municipality', 'School District', 'Vehicle Housed Address', 'Insurance']);
  requireFields(v, ['vin', 'year', 'make', 'owner name', 'owner address', 'plate number', 'plate class']);
  const vin = clean(v.vin); if (!/^[A-HJ-NPR-Z0-9]{1,17}$/.test(vin)) throw new Error('The vehicle VIN is invalid.');
  if (!/^\d{4}$/.test(v.year)) throw new Error('The vehicle model year is invalid.');
  const address = ownerAddress(v['owner address']);
  if (!address) throw new Error('The owner street, city, state, and ZIP could not be separated reliably. Open a complete vehicle record.');
  const temporary = isTemporaryPlate(v['plate class']);
  const expiration = date(v['plate exp date'], true);
  // Only blank temporary decal dates inherit plate expiry; preserve populated dates.
  const decalExpiration = date(temporary && !flat(v['decal exp date']) ? v['plate exp date'] : v['decal exp date'], true);
  if (!expiration) throw new Error('The plate expiration date is missing or invalid.');
  // Temporary plate reports append the year after a space; it is not part of the tag.
  const displayedPlate = flat(v['plate number']);
  const plateValue = temporary ? displayedPlate.replace(/^(\S+)\s+\d{4}$/, '$1') : displayedPlate;
  const plate = valueField(plateValue, 9), make = valueField(v.make, 4), comma = v['owner name'].indexOf(',');
  const ownerFields = comma > 0
    ? [['RBD', valueField(v['owner name'].slice(0, comma), 35)], ['RBE', valueField(v['owner name'].slice(comma + 1), 35)]]
    : [['BBC', valueField(v['owner name'], 70)], ['RBD', ''], ['RBE', '']];
  const warnings = [];
  const issued = date(v['date of issue'], true);
  if (!issued) warnings.push('Registration Date of Issue is unavailable; RBB is blank. Title Issue Date is not substituted.');
  if (!decalExpiration) warnings.push('Decal expiration is unavailable; the SC RBT field is blank.');
  // Official SC version-01 RG layout, decoded from the supplied barcode:
  // RAG = Plate Exp Date; SC uses RBT for Decal Exp Date (confirmed against source).
  const fields = [['RBB', issued], ['RAG', expiration], ['RAM', plate.padEnd(9, ' ')], ...ownerFields,
    ['RBI', valueField(address.street, 35)], ['RBK', valueField(address.city, 20)], ['RBL', address.state], ['RBM', address.zip],
    ['VAD', vin], ['VAK', make], ['VAL', v.year], ['VAO', v.body ? valueField(v.body, 2) : ''],
    ['RBT', decalExpiration], ['RBU', clean(v['decal number'] || v['window sticker number'])]];
  if (v.model) fields.push(['VAM', valueField(v.model, 20)]);
  const payload = frameAamva([{type: 'RG', fields}], {kind: 'vehicle'});
  return {type: 'barcode', kind: 'vehicle', title: 'Vehicle registration import barcode', profile: 'AAMVA SC registration v01 � RG', payload, summary: `${plate} · ${vin}`,
    warnings: [...(address.inferred ? [`Verify owner address: ${address.street}, ${address.city} ${address.state} ${address.zip}. The street/city boundary was identified from the address format.`] : []), ...warnings]};
}
/** Recognize the report family, then return payload plus readable summary/warnings. */
export function reportBarcode(text) {
  if (/\bDriver\s+License\s+No\s*:/i.test(text) || /\bCustomer\s+No\s*:/i.test(text) && /\bDOB\s*:/i.test(text) && /\bName\s*:/i.test(text)) return driverBarcode(text);
  if (/\bVIN\s*:/i.test(text)) return vehicleBarcode(text);
  throw new Error('No driver or vehicle record was recognized. Open the appropriate SCDMV results PDF and try Alt+B again.');
}
