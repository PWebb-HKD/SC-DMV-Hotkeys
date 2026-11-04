/**
 * Credential storage boundary. Local storage holds only a salted AES-GCM ciphertext;
 * unlocked credentials live in browser-session storage. The passphrase/key is not saved.
 * A fresh salt and IV are generated on each save; no network service is involved.
 */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const bytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
async function key(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
/** Encrypt for persistence and retain the unlocked values only for this browser session. */
export async function saveCredentials(credentials, passphrase) {
  if (passphrase.length < 12) throw new Error('Use a vault passphrase of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await key(passphrase, salt), enc.encode(JSON.stringify(credentials)));
  await chrome.storage.local.set({vault: {salt: b64(salt), iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext))}});
  await chrome.storage.session.set({credentials});
}
/** Decrypt the stored vault; authentication failures never expose partial plaintext. */
export async function unlockCredentials(passphrase) {
  const {vault} = await chrome.storage.local.get('vault');
  if (!vault) throw new Error('There are no saved credentials.');
  try {
    const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(vault.iv)}, await key(passphrase, bytes(vault.salt)), bytes(vault.ciphertext));
    const credentials = JSON.parse(dec.decode(plaintext));
    await chrome.storage.session.set({credentials}); return credentials;
  } catch { throw new Error('Could not unlock the vault. Check the passphrase.'); }
}
