/** Canonical, category-specific identifiers shared by the worker and settings UI. */
import {normalize} from './core.js';
export const BLACKLIST_TYPES = {plate: 'Plate number', license: 'DL number', customer: 'Customer number'};
/** Validate the identifier category and return the canonical value used for storage and comparisons. */
export function blacklistEntry(kind, input) {
  if (!Object.hasOwn(BLACKLIST_TYPES, kind)) throw new Error('Choose Plate number, DL number, or Customer number.');
  const value = normalize(kind, input);
  if (!value) throw new Error('Enter a number to blacklist.');
  if (kind === 'plate' && !/^[A-Z0-9]+$/.test(value)) throw new Error('Plate numbers may contain only letters, numbers, and spaces.');
  if (kind !== 'plate' && !/^\d+$/.test(value)) throw new Error(`${BLACKLIST_TYPES[kind]}s may contain only numbers and spaces.`);
  return {kind, value};
}
/** Validate a vault entry list and remove duplicate category/value pairs in their original order. */
export function validateBlacklist(entries) {
  if (!Array.isArray(entries)) throw new Error('The vault blacklist is invalid.');
  const result = [];
  for (const entry of entries) {
    const normalized = blacklistEntry(entry?.kind, entry?.value);
    if (!result.some(item => item.kind === normalized.kind && item.value === normalized.value)) result.push(normalized);
  }
  return result;
}
/** Carry a mandatory blocking warning without exposing the protected identifier in its message. */
export class BlacklistedSearchError extends Error {
  constructor(kind) {
    const category = BLACKLIST_TYPES[kind];
    super(`${category} is blacklisted. Running this ${category.toLowerCase()} could cause your SCDMV access privileges to be suspended or revoked automatically by the DMV.`);
    this.name = 'BlacklistedSearchError';
  }
}
/** Throw a dedicated blocking error when the normalized search identifier matches a saved entry. */
export function checkBlacklist(entries, kind, input) {
  const entry = blacklistEntry(kind, input);
  if (entries.some(item => item.kind === entry.kind && item.value === entry.value)) throw new BlacklistedSearchError(kind);
}
/** Capture identifiers needed to protect later SCUTTIES history replay as well. */
export function driverIdentifiers(text) {
  const result = [];
  for (const [kind, pattern] of [['license', /\bDriver\s+License\s+No\s*:\s*(\d[\d \t]*)(?=\s*Name\s*:)/i], ['customer', /\bCustomer\s+No\s*:\s*(\d[\d \t]*)/i]]) {
    const value = String(text).match(pattern)?.[1];
    if (value) result.push(blacklistEntry(kind, value));
  }
  return result;
}
