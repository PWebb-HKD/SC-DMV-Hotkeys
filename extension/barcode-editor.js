/** Barcode editing model. Decode the framed directory, expose readable field labels,
 * and validate corrections before rebuilding byte offsets. No report data is stored. */
import {frameAamva, raceEthnicity} from './barcode-data.js';
import {parseReportDate} from './status-alerts.js';

// Each descriptor owns its display label and wire-format conversion; unused
// credential inventory fields stay untouched rather than becoming guessed data.
const field = (key, label, max, format = 'text', required = false) => ({key, label, max, format, required});
const driverFields = [
  field('DCS','Last Name',40,'text',true), field('DAC','First Name',40,'text',true), field('DAD','Middle Name(s)',40), field('DCU','Name Suffix',5),
  field('DAQ','Driver License / ID Number',9,'digits'), field('DBB','Date of Birth',8,'date',true),
  field('DAG','Street Address',35,'text',true), field('DAI','City',20,'text',true), field('DAJ','State',2,'state',true), field('DAK','ZIP Code',11,'zip',true),
  field('DCA','License Class',6), field('DBD','Credential Issue Date',8,'date'), field('DBA','Credential Expiration Date',8,'date'),
  field('DBC','Sex',1,'sex'), field('DAU','Height (inches)',6,'height'), field('DAW','Weight (pounds)',3,'weight'),
  field('DAY','Eye Color',3,'eyes'), field('DCL','Race / Ethnicity',3,'race'), field('DCG','Country',3),
  field('DCB','Restriction Codes',12), field('DCD','Endorsement Codes',5), field('DCF','Document Number',25)
];
const vehicleFields = [
  field('RBD','Last Name',35), field('RBE','First and Middle Names',35), field('BBC','Business Name',70),
  field('RBI','Street Address',35), field('RBK','City',20), field('RBL','State',2,'state'), field('RBM','ZIP Code',9,'zip'),
  field('RAM','Plate Number',9,'plate',true), field('VAD','VIN',17,'vin',true), field('VAK','Vehicle Make',4,'text',true),
  field('VAM','Vehicle Model',20), field('VAL','Vehicle Year',4,'year',true), field('VAO','Body Style',2),
  field('RBB','Registration Issue Date',8,'date'), field('RAG','Plate Expiration Date',8,'date',true), field('RBT','Decal Expiration Date',8,'date'), field('RBU','Decal / Window Sticker Number',25)
];
const sexes = {'1':'Male','2':'Female','9':'Unspecified'};
const eyes = {BLK:'Black',BLU:'Blue',BRO:'Brown',GRY:'Gray',GRN:'Green',HAZ:'Hazel',MAR:'Maroon',PNK:'Pink',DIC:'Different Colors',UNK:'Unknown'};
const races = {W:'White',BK:'Black',AP:'Asian or Pacific Islander',AI:'American Indian or Alaska Native',H:'Hispanic',O:'Other',U:'Unknown'};

/** Read only the supported single-subfile profiles; directory offsets are authoritative. */
function payloadFields(payload, kind) {
  const header = kind === 'vehicle' ? '@\n\x1e\rAAMVA6360050101' : '@\n\x1e\rANSI 636005090001';
  if (!payload?.startsWith(header)) throw new Error('The barcode format cannot be opened for editing.');
  const entry = payload.slice(header.length, header.length + 10), type = entry.slice(0,2);
  const offset = Number(entry.slice(2,6)), length = Number(entry.slice(6,10));
  if (!/^\w{2}\d{8}$/.test(entry) || !(kind === 'vehicle' ? type === 'RG' : ['DL','ID'].includes(type)) || offset !== header.length + 10 || offset + length !== payload.length || payload.slice(offset,offset+2) !== type || !payload.endsWith('\r')) throw new Error('The barcode directory is invalid.');
  const fields = payload.slice(offset+2,-1).split('\n').map(line => [line.slice(0,3),line.slice(3)]);
  if (fields.some(([key]) => !/^[A-Z]{3}$/.test(key)) || new Set(fields.map(([key])=>key)).size !== fields.length) throw new Error('The barcode fields are invalid.');
  return {type, fields};
}
/** Present dates as YYYY-MM-DD while retaining unrecognized raw values for correction. */
function displayValue(descriptor, value, kind) {
  const text = String(value ?? '').trim();
  if (/^unavl$/i.test(text)) return '';
  if (descriptor.format === 'date' && /^\d{8}$/.test(text)) return kind === 'vehicle' ? `${text.slice(0,4)}-${text.slice(4,6)}-${text.slice(6,8)}` : `${text.slice(4)}-${text.slice(0,2)}-${text.slice(2,4)}`;
  if (descriptor.format === 'height') return /^\d{3} in$/.test(text) ? String(parseInt(text,10)) : text;
  if (descriptor.format === 'weight') return /^\d+$/.test(text) ? String(Number(text)) : text;
  if (descriptor.format === 'sex') return sexes[text] || text;
  if (descriptor.format === 'eyes') return eyes[text] || text;
  if (descriptor.format === 'race') return races[text] || text;
  return text;
}
/** Create one popup-local model from a valid payload or an unencoded parsing draft. */
export function barcodeEditorModel(data) {
  const kind = data.kind;
  if (!['driver','vehicle'].includes(kind)) throw new Error('The barcode record type is unavailable.');
  const source = data.draftFields ? {type:data.credentialType, fields:data.draftFields.map(([key,value])=>[key,String(value??'')])} : payloadFields(data.payload,kind);
  const descriptors = kind === 'vehicle' ? vehicleFields : driverFields;
  const originals = Object.fromEntries(source.fields), values = {};
  for (const descriptor of descriptors) values[descriptor.key] = displayValue(descriptor, originals[descriptor.key], kind);
  return {kind, type:source.type, fields:source.fields, descriptors, values, draft:!!data.draftFields, allowIncompleteParty:data.allowIncompleteParty === true};
}
/** Normalize text without silently truncating it or permitting framing/control characters. */
function ascii(value) {
  const text = String(value).trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  if (/[^\x20-\x7e]/.test(text)) throw new Error('Use letters, numbers, and standard punctuation.');
  return text.replace(/ +/g,' ');
}
/** Convert a human-readable correction into the profile's encoded representation. */
function encodeField(descriptor, input, kind) {
  let value = ascii(input);
  if (!value) {
    if (descriptor.required) throw new Error('This field is required.');
    if (kind === 'driver' && ['date','eyes','height'].includes(descriptor.format)) return 'unavl';
    return '';
  }
  switch (descriptor.format) {
    case 'date': {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match || !parseReportDate(`${match[2]}/${match[3]}/${match[1]}`)) throw new Error('Enter a valid date as YYYY-MM-DD.');
      value = kind === 'vehicle' ? match[1]+match[2]+match[3] : match[2]+match[3]+match[1]; break;
    }
    case 'digits': if (!/^\d+$/.test(value)) throw new Error('Use numbers only.'); break;
    case 'state': if (!/^[A-Z]{2}$/.test(value)) throw new Error('Enter a two-letter state abbreviation.'); break;
    case 'zip':
      value = value.replace(/[ -]/g,'');
      if (!/^\d{5}(?:\d{4})?$/.test(value)) throw new Error('Enter a 5- or 9-digit ZIP code.');
      if (kind === 'driver') value = value.padEnd(11,' '); break;
    case 'plate': if (!/^[A-Z0-9 -]+$/.test(value)) throw new Error('Use letters, numbers, spaces, or hyphens.'); break;
    case 'vin': if (!/^[A-HJ-NPR-Z0-9]{1,17}$/.test(value)) throw new Error('Enter up to 17 VIN characters, excluding I, O, and Q.'); break;
    case 'year': if (!/^\d{4}$/.test(value)) throw new Error('Enter a four-digit model year.'); break;
    case 'sex':
      value = ({MALE:'1',FEMALE:'2',UNSPECIFIED:'9',UNKNOWN:'9'})[value] || value;
      if (!/^[129]$/.test(value)) throw new Error('Enter Male, Female, or Unspecified.'); break;
    case 'height':
      if (!/^\d{1,3}$/.test(value) || +value < 1 || +value > 119) throw new Error('Enter height in inches from 1 to 119.');
      value = value.padStart(3,'0')+' in'; break;
    case 'weight':
      if (!/^\d{1,3}$/.test(value)) throw new Error('Enter weight in pounds, up to 999.');
      value = value.padStart(3,'0'); break;
    case 'eyes':
      value = Object.keys(eyes).find(key=>eyes[key].toUpperCase()===value) || ({GREY:'GRY'})[value] || value;
      if (!eyes[value]) throw new Error('Enter Black, Blue, Brown, Gray, Green, Hazel, Maroon, Pink, Different Colors, or Unknown.'); break;
    case 'race':
      value = value === 'OTHER' ? 'O' : raceEthnicity(value);
      if (!value) throw new Error('Enter White, Black, Asian or Pacific Islander, American Indian or Alaska Native, Hispanic, Other, or Unknown.');
      value = value.padEnd(3,' '); break;
  }
  if (value.length > descriptor.max) throw new Error(`Use no more than ${descriptor.max} characters.`);
  return descriptor.format === 'plate' ? value.padEnd(9,' ') : value;
}
/** Validate the full visible record, then change only edited fields in an existing
 * payload. Drafts require validation of every value before any barcode is exposed. */
export function editedBarcode(model, values) {
  const errors = {}, encoded = {}, originals = Object.fromEntries(model.fields);
  for (const descriptor of model.descriptors) {
    try { encoded[descriptor.key] = encodeField(descriptor,values[descriptor.key]??'',model.kind); }
    catch(error) { errors[descriptor.key] = error.message; }
  }
  if (model.kind === 'vehicle' && values.BBC?.trim() && (values.RBD?.trim() || values.RBE?.trim())) {
    errors.BBC = 'Use either a business name or a person’s name; clear the unused name fields.';
  }
  if (model.kind === 'vehicle' && !model.allowIncompleteParty) {
    if (!values.BBC?.trim() && (!values.RBD?.trim() || !values.RBE?.trim())) errors.RBD ||= 'Enter the owner’s last and given names, or a business name.';
    for (const key of ['RBI','RBK','RBL','RBM']) if (!values[key]?.trim()) errors[key] ||= 'This address field is required.';
  }
  if (Object.keys(errors).length) return {errors};
  // Preserve original blanks, padding, and unavailable sentinels when untouched.
  const result = model.fields.map(([key,value])=>[key,model.draft || values[key] !== model.values[key] ? encoded[key] ?? value : value]);
  for (const descriptor of model.descriptors) {
    const {key} = descriptor;
    if (!(key in originals) && encoded[key] && values[key] !== model.values[key]) {
      const position = key === 'DCU' ? result.findIndex(([code])=>code==='DAD')+1 : key === 'BBC' ? result.findIndex(([code])=>code==='RBD') : result.length;
      result.splice(position,0,[key,encoded[key]]);
    }
  }
  return {errors:{},payload:frameAamva([{type:model.type,fields:result}],{kind:model.kind}),summary:model.kind==='vehicle' ? `${values.RAM} · ${values.VAD}` : `${values.DCS}, ${values.DAC}${values.DCU ? ` ${values.DCU}` : ''} · ${values.DAQ || 'No license number'}`};
}
