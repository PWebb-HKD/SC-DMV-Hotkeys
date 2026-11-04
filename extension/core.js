/**
 * Shared command definitions, URL recognition, input validation, and report identifiers.
 * Parsing functions have no Chrome dependency and are exercised directly by unit tests.
 * COMMANDS.key is a preferred shortcut; it does not assign browser shortcuts.
 */
export const ROOT = 'https://www.scdmvonline.com';
export const MEMBER = `${ROOT}/SCTRNS/Member/`;
export const PDF_URL = `${MEMBER}Transactions/ViewAttachment.aspx`;
export const LOGIN = `${MEMBER}logon.aspx`;
export const DISCLAIMER = `${MEMBER}Disclaimer.aspx`;
export const ERROR_SELECTOR = '#form1 > div.container > div.iFormsValidationSummary.alert.alert-danger > ul > li > span';
export const COMMANDS = {
  plate: {label: 'Plate Search', key: 'Alt+P', prompt: 'Enter a license plate number', max: 8},
  license: {label: 'DL Number', key: 'Alt+L', prompt: "Enter a driver's license number", max: 9},
  customer: {label: 'Customer Number', key: 'Alt+O', prompt: 'Enter a customer number', max: 8},
  owners: {label: 'PDF Customer/Owner Numbers', key: 'Alt+J'},
  next: {label: 'Next Customer Number', key: 'Alt+N'},
  previous: {label: 'Previous Customer Number', key: 'Alt+M'},
  address: {label: 'Customers at Same Address', key: 'Alt+I'},
  scutties: {label: 'SCUTTIES Driver Search', key: 'Alt+U'},
  barcode: {label: 'Generate PDF417 Barcode', key: 'Alt+B'}
};
/** Unwrap recognized Chromium PDF viewer URLs with bounded recursion; reject other origins. */
export function attachmentUrl(url = '', depth = 0) {
  if (!url || depth > 3) return null;
  try {
    const u = new URL(url);
    if (u.origin === ROOT && u.pathname.toLowerCase() === new URL(PDF_URL).pathname.toLowerCase()) { u.hash = ''; return u.href; }
    if (['chrome-extension:', 'chrome:', 'edge:', 'chrome-untrusted:'].includes(u.protocol)) {
      for (const key of ['src', 'file', 'url', 'originalUrl', 'streamUrl']) {
        const inner = u.searchParams.get(key);
        if (inner) { const source = attachmentUrl(inner, depth + 1); if (source) return source; }
      }
    }
  } catch { /* Not a supported viewer URL. */ }
  return null;
}
export function isPdf(url = '') { return !!attachmentUrl(url); }
export function isPortal(url = '') {
  try { return new URL(url).origin === ROOT && !isPdf(url); } catch { return false; }
}
export function samePage(a, b) {
  try { const x = new URL(a), y = new URL(b); return x.origin === y.origin && x.pathname.toLowerCase() === y.pathname.toLowerCase(); } catch { return false; }
}
export function loginSucceeded(url = '') {
  try { return new URL(url).origin === ROOT && !samePage(url, LOGIN); } catch { return false; }
}
/** Remove spaces, enforce command length, and canonicalize customer leading zeros. */
export function normalize(kind, input) {
  let v = String(input ?? '').replace(/\s+/g, '');
  if (!v) return '';
  if (kind === 'customer') {
    if (!/^\d+$/.test(v)) throw new Error('Customer numbers may contain only numbers and spaces.');
    v = v.replace(/^0+(?=\d)/, '');
  }
  const max = kind === 'license' ? 9 : 8;
  if (v.length > max) throw new Error(`The DMV does not allow ${kind === 'plate' ? 'plates' : kind === 'license' ? 'DL numbers' : 'customer numbers'} with more than ${max} characters. Please re-enter the number.`);
  return kind === 'plate' ? v.toUpperCase() : v;
}
export function driverLicense(text) {
  const match = text.match(/Driver\s+License\s+No\s*:\s*([\d\s]+?)\s*Name\s*:/i);
  if (!match) return null;
  const value = match[1].replace(/\s/g, '');
  return /^\d{1,9}$/.test(value) ? value : null;
}
/** Collect distinct customer/owner numbers in document order, excluding driver records. */
export function ownerNumbers(text) {
  if (/Driver\s+License\s+No\s*:/i.test(text)) throw new Error('This PDF is a driver record. Open a vehicle or residence results PDF to collect customer/owner numbers.');
  const results = [];
  // PDF text extraction preserves line breaks; never consume a following numeric column/line.
  const regex = /\b(?:Owner|Customer)\s+Number\s*:\s*(\d(?:[ \t]*\d)*)(?!\d)/gi;
  for (const match of text.matchAll(regex)) {
    try { const v = normalize('customer', match[1]); if (v && !results.includes(v)) results.push(v); } catch { /* Ignore malformed identifiers. */ }
  }
  if (!results.length) throw new Error('No Customer/Owner Numbers were detected on the open page.');
  return results;
}
/** Extract the first driver name and a real calendar DOB for SCUTTIES. */
export function driverIdentity(text) {
  if (!/Driver\s+License\s+No\s*:/i.test(text)) throw new Error('Open a driver record PDF. Both a last name and date of birth are required.');
  const lastName = text.match(/\bName\s*:\s*([^,:]+),/i)?.[1].trim().replace(/\s+/g, ' ');
  const dob = text.match(/\bDOB\s*:\s*(\d{2}\/\d{2}\/\d{4})\b/i)?.[1];
  if (!lastName || !dob) throw new Error(`Both a last name and date of birth are required. Missing: ${!lastName && !dob ? 'last name and DOB' : !lastName ? 'last name' : 'DOB'}.`);
  const [m, d, y] = dob.split('/').map(Number), date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new Error('The driver record contains an invalid date of birth.');
  return {lastName, dob};
}
/** Validate saved history again and reconstruct a replayable query, including legacy entries. */
export function historySearch(entry) {
  const kind = entry?.kind;
  if (['plate', 'license', 'customer', 'address'].includes(kind)) {
    const value = normalize(kind === 'address' ? 'license' : kind, entry.value);
    if (!value) throw new Error('This history entry has no search number.');
    return {kind, value};
  }
  if (kind === 'scutties') {
    const legacy = String(entry.value || '').match(/^(.*?)\s*·\s*(\d{2}\/\d{2}\/\d{4})$/);
    const saved = entry.identity || (legacy && {lastName: legacy[1].trim(), dob: legacy[2]});
    if (!saved?.lastName || !saved.dob) throw new Error('This SCUTTIES history entry is missing the last name or date of birth.');
    const identity = driverIdentity(`Driver License No: 0 Name: ${saved.lastName},\nDOB: ${saved.dob}`);
    return {kind, identity};
  }
  throw new Error('This search type cannot be rerun from history.');
}
