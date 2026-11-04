/**
 * Local storage holds only salted AES-GCM ciphertext. Login and blacklist plaintext
 * live only in trusted browser-session storage. Passphrases/keys are never retained.
 * Mutations reauthenticate and merge the latest payload so edits cannot drop a login
 * or another edit. Version-1 credential-only vaults remain readable.
 */
import {blacklistEntry, validateBlacklist} from './blacklist.js';
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
const bytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const vaultId = vault => JSON.stringify([vault.salt, vault.iv, vault.ciphertext]);
let operations = Promise.resolve();
function serial(fn) { const task = operations.then(fn); operations = task.catch(() => {}); return task; }
async function key(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
async function decrypt(vault, passphrase) {
  if (!vault) throw new Error('Save an encrypted DMV login before setting up the blacklist.');
  try {
    const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(vault.iv)}, await key(passphrase, bytes(vault.salt)), bytes(vault.ciphertext));
    const data = JSON.parse(dec.decode(plaintext));
    const credentials = data.version === 2 ? data.credentials : data;
    if (typeof credentials?.user !== 'string' || typeof credentials?.password !== 'string') throw new Error('Invalid login');
    return {version: 2, credentials, blacklist: validateBlacklist(data.version === 2 ? data.blacklist : [])};
  } catch { throw new Error('Could not unlock the vault. Check the passphrase.'); }
}
async function cache(data, vault) {
  await chrome.storage.session.set({credentials: data.credentials, blacklist: data.blacklist, unlockedVault: vaultId(vault)});
}
async function persist(data, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Use a vault passphrase of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await key(passphrase, salt), enc.encode(JSON.stringify(data)));
  const vault = {salt: b64(salt), iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext))};
  await chrome.storage.local.set({vault});
  await cache(data, vault);
}
async function state() {
  const {vault} = await chrome.storage.local.get('vault');
  const session = await chrome.storage.session.get(['blacklist', 'unlockedVault']);
  const unlocked = !!vault && session.unlockedVault === vaultId(vault) && Array.isArray(session.blacklist);
  return {hasVault: !!vault, unlocked, entries: unlocked ? validateBlacklist(session.blacklist) : []};
}
export function blacklistState() { return serial(state); }
export function saveCredentials(credentials, passphrase) {
  return serial(async () => {
    if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Use a vault passphrase of at least 12 characters.');
    if (typeof credentials?.user !== 'string' || !credentials.user.trim() || typeof credentials?.password !== 'string' || !credentials.password) throw new Error('User ID and password are required.');
    credentials = {user: credentials.user.trim(), password: credentials.password};
    const {vault} = await chrome.storage.local.get('vault'), current = await state();
    const blacklist = !vault ? [] : current.unlocked ? current.entries : (await decrypt(vault, passphrase)).blacklist;
    await persist({version: 2, credentials, blacklist}, passphrase);
  });
}
export function unlockCredentials(passphrase) {
  return serial(async () => {
    const {vault} = await chrome.storage.local.get('vault');
    const data = await decrypt(vault, passphrase);
    await cache(data, vault); return data.credentials;
  });
}
export function addBlacklistEntry(kind, value, passphrase) {
  return serial(async () => {
    const entry = blacklistEntry(kind, value), {vault} = await chrome.storage.local.get('vault');
    const data = await decrypt(vault, passphrase);
    if (data.blacklist.some(item => item.kind === entry.kind && item.value === entry.value)) throw new Error('That number is already blacklisted.');
    data.blacklist.push(entry); await persist(data, passphrase); return state();
  });
}
export function removeBlacklistEntry(kind, value, passphrase, confirmed) {
  return serial(async () => {
    if (confirmed !== true) throw new Error('Confirm removal before deleting a blacklist entry.');
    const entry = blacklistEntry(kind, value), {vault} = await chrome.storage.local.get('vault');
    const data = await decrypt(vault, passphrase);
    const index = data.blacklist.findIndex(item => item.kind === entry.kind && item.value === entry.value);
    if (index < 0) throw new Error('That number is not in the blacklist.');
    data.blacklist.splice(index, 1); await persist(data, passphrase); return state();
  });
}
export function forgetCredentials() {
  return serial(async () => {
    const current = await state();
    if (current.hasVault && (!current.unlocked || current.entries.length)) throw new Error('Unlock the vault and remove its blacklist entries individually before deleting it.');
    await chrome.storage.local.remove('vault');
    await chrome.storage.session.remove(['credentials', 'blacklist', 'unlockedVault']);
  });
}
