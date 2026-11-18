// Synthetic offense blocks: no uploaded records, real tickets, or identifying details.
export const statusNow = new Date('2026-11-17T17:00:00Z');
export function susp(reason, {ticket = 'TEST-1', end = 'INDEFINITE', met = 'INDEFINITE', causal = '01/15/2024', iid = 'N'} = {}) {
  return `SUSP: 001 - ${reason} Ticket#: ${ticket}
Special Driving Privilege: NONE
Suspension Beg: 01/01/2025 Suspension End: ${end}
Causal: ${causal} Post: 01/02/2025
Reinstatement Requirements Met: ${met} Reinstatement Fee Paid: N
IID Required: ${iid}`;
}
export const revo = (reason, options) => susp(reason, options).replace(/^SUSP:/, 'REVO:').replace(/Suspension (?=Beg:|End:)/g, 'Revocation ');
export const viol = (reason, ticket, date) => `VIOL: 499 - ${reason} Ticket#: ${ticket} Violation: ${date} Conviction: 01/01/2025 Recd: 01/02/2025`;
export const validHeader = 'Status - DL: NO SUSPENSION Driver License No: 123456789 Name: SYNTHETIC, PERSON License Information Type Class Function Issued Expires Printed Date Restr.Endor.Document Identifier Current (ACN / DDN) DL D Renewal 01/01/2025 12/31/2027 N N SYNTHETIC';
export const mixedSuspensions = ['Status - DL: SUSPENDED',
  susp('Driving Under the Influence', {ticket:'SYNTH-A', iid:'Y'}),
  viol('Driving Under the Influence', 'SYNTH-A', '01/15/2024'),
  viol('Unlawful Alcohol Concentration', 'SYNTH-B', '03/15/2023'),
  susp('Unlawful Alcohol Concentration', {ticket:'SYNTH-B', end:'01/01/2026', causal:'03/15/2023'}),
  susp('Unlawful Alcohol Concentration', {ticket:'SYNTH-C', causal:'02/01/2022'}),
  susp('Driving Under Suspension', {ticket:'SYNTH-D', end:'01/01/2026'}),
  susp('Failure to Pay Traffic Ticket', {ticket:'SYNTH-E'}),
].join('\n');
