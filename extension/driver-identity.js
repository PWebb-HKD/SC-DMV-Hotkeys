/** Private report identity stays in session/display data; only the preference is persistent. */
export function driverName(text) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim().split(/\bLicense\s+Information\b|\bSUSP\s*:|\bVIOL\s*:/i)[0];
  if (!/\bDriver\s+License\s+No\s*:/i.test(flat)) return '';
  const name = flat.match(/\bName\s*:\s*(.*?)(?=\b(?:Address|City|County|DOB|Sex|Height|Status\s*[-–—]\s*DL)\s*:|\bLicense\s+Information\b|$)/i)?.[1]?.trim();
  return name && name.length <= 150 ? name : '';
}
/** Accept bounded inline PNG data only, never external image URLs or arbitrary reader properties. */
export function safeDriverIdentity(value) {
  if (!value || typeof value !== 'object') return undefined;
  const name = typeof value.name === 'string' && value.name.length <= 150 ? value.name.trim() : '';
  const photo = value.noPhoto !== true && typeof value.photo === 'string' && value.photo.length <= 700000 && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value.photo) ? value.photo : '';
  return name || photo ? {name, photo, ...(value.noPhoto === true ? {noPhoto:true} : {})} : undefined;
}
