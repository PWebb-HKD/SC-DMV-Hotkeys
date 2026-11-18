/**
 * Pure report-to-alert rules. Dates are South Carolina calendar days, not elapsed
 * 24-hour intervals, so daylight-saving changes cannot alter an expiration decision.
 * The output is display data (sections/tone/timeout), never HTML or browser actions.
 */
const DAY = 86400000;
const DATE = '(\\d{2}\\s*\\/\\s*\\d{2}\\s*\\/\\s*\\d{4})';
const FLAT_DATE = /\d{2}\s*\/\s*\d{2}\s*\/\s*\d{4}/;
const LICENSE_HEADER = 'Type\\s+Class\\s+Function\\s+Issued\\s+Expires\\s+Printed\\s+Date\\s+Restr\\.?\\s*Endor\\.?\\s*Document\\s+Identifier';
const flat = text => String(text || '').replace(/\s+/g, ' ').trim();

/** Construct a validated UTC day ordinal used only for calendar comparisons, not local clock arithmetic. */
function calendar(year, month, day) {
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return {year, month, day, ordinal: date.getTime() / DAY};
}
/** Parse mm/dd/yyyy strictly; invalid calendar days return null rather than rolling over. */
export function parseReportDate(value) {
  const match = String(value || '').match(/^\s*(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})\s*$/);
  return match ? calendar(+match[3], +match[1], +match[2]) : null;
}
/** Convert an instant into a South Carolina calendar date with an integer day ordinal. */
export function reportToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now).map(part => [part.type, part.value]));
  return calendar(+parts.year, +parts.month, +parts.day);
}
/** Move a calendar date by whole months, clamping invalid month-end days to the last valid day. */
function shiftMonths(date, delta) {
  const total = date.year * 12 + date.month - 1 + delta;
  const year = Math.floor(total / 12), month = total % 12 + 1;
  let day = date.day;
  while (day > 0) { const result = calendar(year, month, day); if (result) return result; day--; }
}
/** Describe elapsed calendar years/months/days, clamping month ends consistently. */
export function expirationAge(expired, today) {
  let years = today.year - expired.year;
  if (shiftMonths(expired, years * 12).ordinal > today.ordinal) years--;
  const anniversary = shiftMonths(expired, years * 12);
  let months = (today.year - anniversary.year) * 12 + today.month - anniversary.month;
  if (shiftMonths(anniversary, months).ordinal > today.ordinal) months--;
  const days = today.ordinal - shiftMonths(anniversary, months).ordinal;
  const units = [[years, 'year'], [months, 'month'], [days, 'day']].filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}${count === 1 ? '' : 's'}`);
  const totalDays = today.ordinal - expired.ordinal;
  return {years, months, days, totalDays, text: `${units.join(', ') || '0 days'}${years || months ? ` (${totalDays} days total)` : ''}`};
}
/** Build display-only status data and choose the standard success or warning/error lifetime. */
function alert(recordType, tone, sections, extra = {}) {
  return {type: 'record-alert', recordType, tone, sections, autoCloseMs: tone === 'success' ? 10000 : 90000, ...extra};
}
/** Report unreadable status explicitly instead of inferring a valid license or plate. */
export function unavailableAlert(recordType, message) {
  return alert(recordType, 'warning', [{title: 'STATUS UNAVAILABLE', lines: [message]}]);
}

/** Recognize 45-day, EVR 45-day, and EVR 60-day temporary vehicle plate classes. */
export function isTemporaryPlate(plateClass) {
  return /^(?:T45V|E45V|E60V)\b/i.test(flat(plateClass));
}

/** Read the vehicle heading only; VIN is a delimiter, never display data. */
function vehicleDetails(text) {
  const start = text.search(/\bVIN\s*:/i);
  if (start < 0) return null;
  const match = text.slice(start).match(/^VIN\s*:\s*[^:]*?\bYear\s*:\s*([^:]*?)\bMake\s*:\s*([^:]*?)\bModel\s*:\s*([^:]*?)\bBody\s*:\s*([^:]*?)(?=\bEmpty\s+Weight\s*:)/i);
  if (!match) return null;
  const [, year, make, model, body] = match;
  return {make: flat(make), model: flat(model), year: /^\d{4}$/.test(flat(year)) ? flat(year) : '', body: flat(body)};
}

/** Combine enforcement and expiration findings; temporary tags use Plate Exp Date. */
export function plateStatus(raw, now = new Date()) {
  const text = flat(raw), today = reportToday(now), sections = [];
  const vehicle = vehicleDetails(text), details = vehicle ? {vehicle} : {};
  const enforcement = /\bEnforcement\s+Description\s*:\s*([\s\S]*?)\bEnforcement\s+Statute\s*:\s*/gi;
  for (const match of text.matchAll(enforcement)) {
    const description = flat(match[1]);
    if (!description) continue;
    const statute = text.slice(match.index + match[0].length).match(/^(\d{1,4}\s*[-–—]\s*\d{1,4}\s*[-–—]\s*\d{1,4})(?!\d)/)?.[1].replace(/\s/g, '').replace(/[–—]/g, '-');
    sections.push({title: 'TAG SUSPENDED', lines: [description, statute ? `Statute: ${statute}` : 'Suspension statute could not be read.']});
  }
  const classTail = text.match(/\bPlate\s+Class\s*:\s*(.*)$/i)?.[1];
  const hasClass = !!classTail && !/^(?:Plate|Decal)\s+Exp\s+Date\s*:/i.test(classTail);
  const temporary = hasClass && isTemporaryPlate(classTail);
  const label = temporary ? 'Plate\\s+Exp\\s+Date' : 'Decal\\s+Exp\\s+Date';
  const expirationText = text.match(new RegExp(`\\b${label}\\s*:\\s*${DATE}`, 'i'))?.[1];
  const expiration = hasClass && parseReportDate(expirationText);
  if (expiration && expiration.ordinal < today.ordinal) {
    const age = expirationAge(expiration, today);
    sections.push({title: 'EXPIRED', lines: [`Expired for ${age.text}.`]});
  }
  if (sections.length) {
    if (!expiration) sections.push({title: '', lines: ['Expiration status could not be determined from this report.']});
    return alert('plate', 'danger', sections, details);
  }
  if (!expiration) return {...unavailableAlert('plate', hasClass ? `A valid ${temporary ? 'Plate' : 'Decal'} Exp Date was not found.` : 'Plate Class was not found in the results PDF.'), ...details};
  return alert('plate', 'success', [{title: 'TAG VALID', lines: []}], details);
}

/** Read one suspension-block field up to the next known label without crossing blocks. */
function field(block, label, next) {
  return flat(block.match(new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=${next}\\s*:|$)`, 'i'))?.[1] || '');
}
/** Count DUS violations in the inclusive five-calendar-year window, excluding future dates. */
function recentDus(text, today) {
  const cutoff = shiftMonths(today, -60).ordinal;
  let count = 0;
  for (const match of text.matchAll(/\bVIOL\s*:\s*([\s\S]*?)(?=\bVIOL\s*:|\bSUSP\s*:|\bLicense\s+Information\b|$)/gi)) {
    if (!/^.+?\s*[-–—]\s*Driving\s+Under\s+Suspension\s+Ticket\s*#\s*:/i.test(match[1])) continue;
    const date = parseReportDate(match[1].match(new RegExp(`\\bViolation\\s*:\\s*${DATE}`, 'i'))?.[1]);
    if (date && date.ordinal >= cutoff && date.ordinal <= today.ordinal) count++;
  }
  return count;
}
/** Split offense blocks at explicit block markers, keeping dates and flags tied to their offense. */
function offenseBlocks(text) {
  return [...text.matchAll(/\b(SUSP|VIOL)\s*:\s*([\s\S]*?)(?=\b(?:SUSP|VIOL)\s*:|\bLicense\s+Information\b|$)/gi)]
    .map(match => ({kind: match[1].toUpperCase(), text: match[2]}));
}
/** Extract just the offense description, excluding ticket numbers and later block fields. */
function offenseReason(block) {
  return flat(block.split(/\b(?:Ticket\s*#|Special\s+Driving\s+Privilege|Suspension\s+Beg|Violation|Causal|IID\s+Required)\s*:/i)[0])
    .replace(/^\d{3}\s*[-–—]\s*/, '').trim();
}
const isDuiDuac = reason => /\b(?:Driving\s+Under\s+the\s+Influence|Unlawful\s+Alcohol\s+Concentration)\b/i.test(reason);
/** Read an optional ticket without borrowing a neighboring field; preserve its display spelling. */
function offenseTicket(block) {
  return block.match(/\bTicket\s*#\s*:\s*(?!(?:Special\s+Driving|Suspension\s+Beg|Violation\s*:|Causal\s*:|Post\s*:|ACD\s*:|Conviction\s*:))([A-Za-z0-9][A-Za-z0-9-]*)\b/i)?.[1] || '';
}
/** Retain only this suspension's labeled dates and reason for its expandable occurrence row. */
function suspensionOccurrence(block, reason) {
  const date = label => flat(block.match(new RegExp(`\\b${label}\\s*:\\s*(INDEFINITE|${DATE})`, 'i'))?.[1] || '');
  return {reason: /^Driving Under the Influence$/i.test(reason) ? 'DUI' : /^Unlawful Alcohol Concentration$/i.test(reason) ? 'DUAC' : reason,
    ticket: offenseTicket(block), begin: date('Suspension\\s+Beg'), end: date('Suspension\\s+End'), violationDate: date('(?:Causal|Casual)')};
}
/** Count DUI/DUAC offenses once per ticket, preferring a VIOL date over a matching SUSP causal date.
 * Missing tickets remain separate; matching dates alone do not prove the same offense. */
function duiDuacSummary(blocks, today) {
  const offenses = new Map(); let anonymous = 0, iidRequired = false;
  for (const block of blocks) {
    if (!isDuiDuac(offenseReason(block.text))) continue;
    if (block.kind === 'SUSP' && /\bIID\s+Required\s*:\s*Y\b/i.test(block.text)) iidRequired = true;
    const ticket = offenseTicket(block.text).toUpperCase();
    const key = ticket ? `ticket:${ticket}` : `anonymous:${anonymous++}`;
    const dateLabel = block.kind === 'VIOL' ? 'Violation' : 'Causal';
    const date = parseReportDate(block.text.match(new RegExp(`\\b${dateLabel}\\s*:\\s*${DATE}`, 'i'))?.[1]);
    const entry = offenses.get(key) || {violations: [], suspensions: []};
    entry[block.kind === 'VIOL' ? 'violations' : 'suspensions'].push(date);
    offenses.set(key, entry);
  }
  const cutoff = shiftMonths(today, -120).ordinal;
  const count = [...offenses.values()].filter(entry => (entry.violations.length ? entry.violations : entry.suspensions)
    .some(date => date && date.ordinal >= cutoff && date.ordinal <= today.ordinal)).length;
  return {count, iidRequired};
}
/** Classify suspension periods and separate outstanding reinstatement requirements.
 * End dates at or before today have completed their active period; neither bucket counts twice. */
function suspensionSummary(text, today) {
  const active = new Map(), pending = new Map(); let unreadable = 0;
  for (const {kind, text: block} of offenseBlocks(text)) {
    if (kind !== 'SUSP') continue;
    const rawReason = offenseReason(block), reason = isDuiDuac(rawReason) ? 'DUI/DUAC' : rawReason;
    if (!reason) { unreadable++; continue; }
    const ending = field(block, 'Suspension\\s+End', 'Causal');
    const requirements = field(block, 'Reinstatement\\s+Requirements\\s+Met', 'Reinstatement\\s+Fee\\s+Paid');
    const endDate = parseReportDate(ending.match(FLAT_DATE)?.[0]);
    const requirementDate = parseReportDate(requirements.match(FLAT_DATE)?.[0]);
    let bucket;
    if (/^INDEFINITE\b/i.test(ending) || endDate && endDate.ordinal > today.ordinal) bucket = active;
    else if (!endDate) { unreadable++; continue; }
    else if (/^INDEFINITE\b/i.test(requirements) || requirementDate && requirementDate.ordinal > today.ordinal) bucket = pending;
    if (!bucket) continue;
    const key = reason.toLocaleUpperCase('en-US'), current = bucket.get(key);
    const occurrence = suspensionOccurrence(block, rawReason);
    if (current) { current.count++; current.occurrences.push(occurrence); }
    else bucket.set(key, {reason, count: 1, occurrences: [occurrence]});
  }
  const sorted = (bucket, prioritize = false) => {
    const priority = reason => !prioritize ? 2 : /^Habitual Offender$/i.test(reason) ? 0 : /^Driving Under Suspension$/i.test(reason) ? 1 : 2;
    return [...bucket.values()].sort((a, b) => priority(a.reason) - priority(b.reason) || b.count - a.count || a.reason.localeCompare(b.reason));
  };
  const groups = sorted(active, true), pendingGroups = sorted(pending);
  const total = groups => groups.reduce((sum, group) => sum + group.count, 0);
  return {groups, pendingGroups, active: total(groups), pending: total(pendingGroups), unreadable};
}
/** Suspended status takes precedence. Otherwise inspect only Current credentials;
 * a Prior section cannot override a current license or supply its expiration date. */
function evaluateLicenseStatus(raw, now = new Date()) {
  const text = flat(raw), today = reportToday(now);
  const statuses = new Set([...text.matchAll(/\bStatus\s*[-–—]\s*DL\s*:\s*(NO\s+SUSPENSION|SUSPENDED|TEMPORARY\s+ALCOHOL(?:\s+LICENSE)?)\b/gi)].map(match => flat(match[1]).toUpperCase()));
  if (statuses.size !== 1) return unavailableAlert('license', 'A single recognizable Status - DL value was not found.');
  if (statuses.has('SUSPENDED')) {
    const summary = suspensionSummary(text, today), priors = recentDus(text, today);
    const duiDuac = duiDuacSummary(offenseBlocks(text), today);
    const lines = [`${priors} Prior DUS convictions within 5 years`, `${duiDuac.count} Prior DUI/DUAC convictions within 10 years`, `${summary.active} active suspension${summary.active === 1 ? '' : 's'}`];
    if (summary.pending) lines.push(`${summary.pending} pending reinstatement`);
    if (!summary.groups.length) lines.push('No active suspension blocks matched the date criteria.');
    if (summary.unreadable) lines.push(`${summary.unreadable} suspension entr${summary.unreadable === 1 ? 'y could' : 'ies could'} not be evaluated.`);
    const items = summary.groups.map(group => `${group.reason} × ${group.count}`);
    const columns = [{title: 'Active Suspensions', items, groups: summary.groups}];
    if (summary.pending) columns.push({title: 'Pending Reinstatement', items: summary.pendingGroups.map(group => `${group.reason} × ${group.count}`), groups: summary.pendingGroups});
    return alert('license', 'danger', [{title: 'LICENSE SUSPENDED', lines, listTitle: 'Suspension Reasons:', items, columns}], {activeSuspensions: summary.active, pendingReinstatement: summary.pending, priorDus: priors, priorDuiDuac: duiDuac.count});
  }
  const current = text.match(new RegExp(`\\b${LICENSE_HEADER}\\s+Current\\b(?:\\s*\\(\\s*ACN\\s*\\/\\s*DDN\\s*\\))?\\s*([\\s\\S]*?)(?=\\bLicense\\s+Information\\b|\\bPrior\\b|\\bSUSP\\s*:|\\bVIOL\\s*:|$)`, 'i'))?.[1];
  const number = text.match(/\bDriver\s+License\s+No\s*:\s*([\s\S]*?)\bName\s*:/i)?.[1];
  if (number == null) return unavailableAlert('license', 'The first Driver License No / Name sequence was not found.');
  if (!number.trim()) return alert('license', 'danger', [{title: 'NOT LICENSED', lines: []}]);
  if (!current) return alert('license', 'danger', [{title: 'NO LONGER LICENSED IN SC', lines: []}]);
  const type = current.replace(/\(\s*[A-Za-z]\s*\)/g, '').trim().match(/^[A-Za-z0-9]+/)?.[0];
  if (type?.toUpperCase() === 'ID') return alert('license', 'danger', [{title: 'NOT LICENSED ID ONLY', lines: []}]);
  // Issued and Expires are the first two dates; Function varies and Printed Date can be blank.
  const dates = current.match(new RegExp(`^[^/]*?${DATE}\\s+${DATE}`, 'i'));
  const expiration = dates && parseReportDate(dates[2]);
  if (!type || !expiration) return unavailableAlert('license', 'The current license expiration date could not be read.');
  if (expiration.ordinal < today.ordinal) return alert('license', 'danger', [{title: 'LICENSE EXPIRED', lines: []}]);
  // Keep the credential qualifier in display lines so audio uses only VALID LICENSE.
  const temporaryAlcohol = [...statuses].some(status => /^TEMPORARY ALCOHOL(?: LICENSE)?$/.test(status));
  return alert('license', 'success', [{title: 'VALID LICENSE', lines: temporaryAlcohol ? ['TEMPORARY ALCOHOL LICENSE'] : []}]);
}

/** Read the report-level privilege line without including neighboring fields or suspension privileges. */
function specialDlPrivileges(raw) {
  const values = [];
  const boundary = /\b(?:Status\s*[-–—]\s*DL|CDL|Driver\s+License\s+No|Customer\s+No|Name|DOB|Address|City|State|Zip|County|Sex|Height|Weight|Eye\s+Color|Race|License\s+Type|Issued|Expires|Special\s+DL\s+Privileges?)\s*:|\bLicense\s+Information\b|\b(?:SUSP|VIOL)\s*:/i;
  for (const match of String(raw || '').matchAll(/\bSpecial[ \t]+DL[ \t]+Privileges?[ \t]*:[ \t]*([^\r\n]*)/gi)) {
    const value = flat(match[1].split(boundary)[0]);
    if (!value || /^(?:NONE|N\/A|NOT APPLICABLE)$/i.test(value)) continue;
    if (!values.some(existing => existing.toUpperCase() === value.toUpperCase())) values.push(value);
  }
  return values;
}
/** Add display-only privileges after the normal status decision; audio consumes headings only. */
export function licenseStatus(raw, now = new Date()) {
  const result = evaluateLicenseStatus(raw, now);
  const section = result.sections[0];
  // IID is independent of the main status, expiration, and conviction lookback window.
  if (duiDuacSummary(offenseBlocks(flat(raw)), reportToday(now)).iidRequired) {
    section.warnings = ['IGNITION INTERLOCK DEVICE REQUIRED'];
    result.iidRequired = true;
    result.autoCloseMs = 90000;
  }
  if (!['VALID LICENSE', 'LICENSE SUSPENDED', 'LICENSE EXPIRED'].includes(section.title)) return result;
  const normalized = value => flat(value).toUpperCase().replace(/\s+LICENSE$/, '');
  const privileges = specialDlPrivileges(raw).filter(value => !(section.lines || []).some(line => normalized(line) === normalized(value)));
  if (privileges.length) section.qualifiers = privileges;
  return result;
}

/** Dispatch search kinds to the correct pure parser; unrelated searches have no status. */
export function recordStatus(kind, text, now = new Date()) {
  if (kind === 'plate') return plateStatus(text, now);
  if (kind === 'license' || kind === 'customer') return licenseStatus(text, now);
  return null;
}
