// Regression coverage for deidentified report layout variations.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {licenseStatus} from '../extension/status-alerts.js';

// Minimal, de-identified layout excerpts extracted with the shipped PDF.js reader.
const reports = JSON.parse(readFileSync(new URL('./report-layouts.json', import.meta.url)));
const now = new Date('2026-10-28T16:00:00Z');
const cases = [
  ['blank license number with suspended status', 'LICENSE SUSPENDED', 2, 2],
  ['current ID with suspended status', 'LICENSE SUSPENDED', 2],
  ['current Class D with suspended status', 'LICENSE SUSPENDED', 1],
  ['prior license without Current entry', 'NO LONGER LICENSED IN SC'],
  ['current unexpired beginner permit', 'VALID LICENSE'],
];
cases.forEach(([name, title, active, pending], i) => test(`report layout: ${name}`, () => {
  const result = licenseStatus(reports[i], now);
  assert.equal(result.sections[0].title, title);
  if (active != null) assert.equal(result.activeSuspensions, active);
  if (pending != null) assert.equal(result.pendingReinstatement, pending);
  assert.equal(result.autoCloseMs, title === 'VALID LICENSE' ? 10000 : 90000);
}));

test('current ID layout becomes ID ONLY when the DL status is NO SUSPENSION', () => {
  const report = reports[1].replace('Status - DL: SUSPENDED', 'Status - DL: NO SUSPENSION');
  assert.equal(licenseStatus(report, now).sections[0].title, 'NOT LICENSED ID ONLY');
});
