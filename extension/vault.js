/**
 * Local storage holds only salted AES-GCM ciphertext. Login and blacklist plaintext
 * and a vault encryption key live only in trusted browser-session storage. Passphrases
 * are never retained. Mutations merge the latest payload so edits cannot drop a login
 * or another edit. Version-1 credential-only vaults remain readable.
 */
import {blacklistEntry, validateBlacklist} from './blacklist.js';
const enc = new TextEncoder(), dec = new TextDecoder();
// Encode binary cryptographic fields for browser storage; never use these helpers to log plaintext.
const b64 = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
const bytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const vaultId = vault => JSON.stringify([vault.salt, vault.iv, vault.ciphertext]);
let operations = Promise.resolve();
/** Order vault reads and writes independently of other storage streams, recovering the queue after rejection. */
function serial(fn) { const task = operations.then(fn); operations = task.catch(() => {}); return task; }
/** Validate and trim login input once for both saved-login write paths. */
function validatedCredentials(credentials) {
  if (typeof credentials?.user !== 'string' || !credentials.user.trim() || typeof credentials?.password !== 'string' || !credentials.password) throw new Error('User ID and password are required.');
  return {user: credentials.user.trim(), password: credentials.password};
}
/** Derive an AES-GCM key from the passphrase and vault salt using PBKDF2-SHA-256. */
async function key(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt']);
}
/** Validate decrypted JSON and upgrade the credential-only schema to the login-and-blacklist schema. */
function payload(plaintext) {
  const data = JSON.parse(dec.decode(plaintext));
  const credentials = data.version === 2 ? data.credentials : data;
  if (typeof credentials?.user !== 'string' || typeof credentials?.password !== 'string') throw new Error('Invalid login');
  return {version: 2, credentials, blacklist: validateBlacklist(data.version === 2 ? data.blacklist : [])};
}
/** Unlock one persisted vault and return validated contents plus session-only key material. */
async function decrypt(vault, passphrase) {
  if (!vault) throw new Error('Save an encrypted DMV login before setting up the blacklist.');
  try {
    const encryptionKey = await key(passphrase, bytes(vault.salt));
    const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(vault.iv)}, encryptionKey, bytes(vault.ciphertext));
    return {data: payload(plaintext), material: b64(new Uint8Array(await crypto.subtle.exportKey('raw', encryptionKey)))};
  } catch { throw new Error('Could not unlock the vault. Check the passphrase.'); }
}
/** Mirror unlocked plaintext and key material into trusted session storage, bound to the current ciphertext. */
async function cache(data, vault, material, updateCredentials = true) {
  await chrome.storage.session.set({...(updateCredentials ? {credentials: data.credentials} : {}), blacklist: data.blacklist, vaultKey: material, unlockedVault: vaultId(vault)});
}
/** Persist a fresh-IV ciphertext and refresh its session identity; optionally replace cached credentials. */
async function encrypt(data, salt, encryptionKey, material, updateCredentials = true) {
  // Reusing the session key requires a fresh, random IV for every encryption.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, encryptionKey, enc.encode(JSON.stringify(data)));
  const vault = {salt, iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext))};
  await chrome.storage.local.set({vault});
  await cache(data, vault, material, updateCredentials);
}
/** Create a new salt and derived key when saving with an explicit passphrase. */
async function persist(data, passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Use a vault passphrase of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), encryptionKey = await key(passphrase, salt);
  const material = b64(new Uint8Array(await crypto.subtle.exportKey('raw', encryptionKey)));
  await encrypt(data, b64(salt), encryptionKey, material);
}
/** Decrypt the latest vault with its session key only if the unlocked ciphertext identity still matches. */
async function sessionVault() {
  const {vault} = await chrome.storage.local.get('vault');
  const session = await chrome.storage.session.get(['vaultKey', 'unlockedVault']);
  if (!vault || !session.vaultKey || session.unlockedVault !== vaultId(vault)) throw new Error('Unlock the vault before editing the blacklist.');
  try {
    const encryptionKey = await crypto.subtle.importKey('raw', bytes(session.vaultKey), {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
    const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: bytes(vault.iv)}, encryptionKey, bytes(vault.ciphertext));
    return {data: payload(plaintext), vault, encryptionKey, material: session.vaultKey};
  } catch { throw new Error('Unlock the vault again before editing the blacklist.'); }
}
/** Persist a blacklist edit with the current key while retaining the active session credentials. */
async function saveSessionVault(current) {
  await encrypt(current.data, current.vault.salt, current.encryptionKey, current.material, false);
}
/** Expose lock state and validated entries without returning credentials or encryption material. */
async function state() {
  const {vault} = await chrome.storage.local.get('vault');
  const session = await chrome.storage.session.get(['blacklist', 'unlockedVault', 'vaultKey']);
  const unlocked = !!vault && session.unlockedVault === vaultId(vault) && typeof session.vaultKey === 'string' && Array.isArray(session.blacklist);
  return {hasVault: !!vault, unlocked, entries: unlocked ? validateBlacklist(session.blacklist) : []};
}
/** Serialize the public vault-state read with edits so the UI sees a consistent entry list. */
export function blacklistState() { return serial(state); }
/** Save validated credentials and preserve the existing blacklist, unlocking it when necessary. */
export function saveCredentials(credentials, passphrase) {
  return serial(async () => {
    if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Use a vault passphrase of at least 12 characters.');
    credentials = validatedCredentials(credentials);
    const {vault} = await chrome.storage.local.get('vault'), current = await state();
    const blacklist = !vault ? [] : current.unlocked ? current.entries : (await decrypt(vault, passphrase)).data.blacklist;
    await persist({version: 2, credentials, blacklist}, passphrase);
  });
}
/** Unlock persisted credentials and blacklist once for the trusted browser session. */
export function unlockCredentials(passphrase) {
  return serial(async () => {
    const {vault} = await chrome.storage.local.get('vault');
    const {data, material} = await decrypt(vault, passphrase);
    await cache(data, vault, material); return data.credentials;
  });
}
/** Append one canonical, nonduplicate identifier and re-encrypt the latest vault payload. */
export function addBlacklistEntry(kind, value) {
  return serial(async () => {
    const entry = blacklistEntry(kind, value), current = await sessionVault(), {data} = current;
    if (data.blacklist.some(item => item.kind === entry.kind && item.value === entry.value)) throw new Error('That number is already blacklisted.');
    data.blacklist.push(entry); await saveSessionVault(current); return state();
  });
}
/** Require confirmation, remove exactly one matching identifier, and persist the revised vault. */
export function removeBlacklistEntry(kind, value, confirmed) {
  return serial(async () => {
    if (confirmed !== true) throw new Error('Confirm removal before deleting a blacklist entry.');
    const entry = blacklistEntry(kind, value), current = await sessionVault(), {data} = current;
    const index = data.blacklist.findIndex(item => item.kind === entry.kind && item.value === entry.value);
    if (index < 0) throw new Error('That number is not in the blacklist.');
    data.blacklist.splice(index, 1); await saveSessionVault(current); return state();
  });
}
/** Delete a removable vault only when its blacklist is empty, then clear its session mirrors. */
export function forgetCredentials() {
  return serial(async () => {
    const current = await state();
    if (current.hasVault && (!current.unlocked || current.entries.length)) throw new Error('Unlock the vault and remove its blacklist entries individually before deleting it.');
    await chrome.storage.local.remove('vault');
    await chrome.storage.session.remove(['credentials', 'blacklist', 'unlockedVault', 'vaultKey']);
  });
}
/** Replace the old persisted login while retaining this session's blacklist/key. */
export function replaceCredentials(credentials) {
  return serial(async () => {
    credentials = validatedCredentials(credentials);
    const current = await sessionVault();
    current.data.credentials = credentials;
    await encrypt(current.data, current.vault.salt, current.encryptionKey, current.material, true);
  });
}
/** Explicit reset from the login popup also removes the blacklist and session key. */
export function clearSavedUserInfo(confirmed) {
  return serial(async () => {
    if (confirmed !== true) throw new Error('Confirm deletion of saved user information and the vault.');
    await chrome.storage.local.remove('vault');
    await chrome.storage.session.clear();
  });
}
