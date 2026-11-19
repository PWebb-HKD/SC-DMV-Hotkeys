/** Fictional driver records. Identifiers are fixed demo inputs, never live lookups. */
const definitions=[
  ['DRIVER001','100000101','10000001','Valid license','Avery Example, also the first vehicle owner.','valid','AVERY'],
  ['DRIVER002','100000102','10000002','Expired license','Morgan Example, also the second shared-address owner.','expired','MORGAN'],
  ['DRIVER003','100000111','10000011','Suspensions and reinstatement','Grouped active and pending periods, DUS and DUI/DUAC history.','suspended','JORDAN'],
  ['DRIVER004','100000112','10000012','Pending reinstatement','Completed suspension period with outstanding requirements.','pending','RILEY'],
  ['DRIVER005','100000113','10000013','License revocation','An indefinite REVO block counts as an active suspension.','revocation','CASEY'],
  ['DRIVER006','100000114','10000014','Temporary Alcohol License','A valid TAL with a display-only qualifier.','tal','CAMERON'],
  ['DRIVER007','100000115','10000015','Special DL privilege','A valid credential with a special-privilege qualifier.','privilege','QUINN'],
  ['DRIVER008','100000116','10000016','Valid license with IID','A valid license with an ignition-interlock requirement.','iid','ROWAN'],
  ['DRIVER009','100000117','10000017','Identification only','A current ID card rather than a driver license.','id','DREW'],
  ['DRIVER010','','10000018','Not licensed','A customer without a driver license number.','unlicensed','REMY'],
  ['DRIVER011','100000119','10000019','Status unavailable','An unreadable status must not become an assumed valid result.','unavailable','PARKER']
];
export const DRIVER_CASES=Object.freeze(definitions.map(([id,license,customer,title,description,kind,first])=>Object.freeze({id,license,customer,title,description,kind,first,recordType:'license',...(id==='DRIVER001'?{photo:'portrait'}:['DRIVER009','DRIVER010'].includes(id)?{photo:'placeholder'}:{})})));
export function driverCase(id){return DRIVER_CASES.find(record=>record.id===id);}
function period(kind,reason,{ticket='',end='INDEFINITE',met='INDEFINITE',causal='01/15/2024',iid='N'}={}){
  const label=kind==='REVO'?'Revocation':'Suspension';
  return [`${kind}: 001 - ${reason}${ticket?' Ticket#: '+ticket:''}`,'Special Driving Privilege: NONE',
    `${label} Beg: 01/01/2025 ${label} End: ${end}`,`Causal: ${causal} Post: 01/02/2025`,
    `Reinstatement Requirements Met: ${met} Reinstatement Fee Paid: N`,`IID Required: ${iid}`].join('\n');
}
/** Intentionally long enough to exercise genuine multi-page extraction. */
function mixedPeriods(){return [
  period('SUSP','Habitual Offender'),period('SUSP','Driving Under Suspension',{ticket:'DEMO-DUS'}),
  ...Array.from({length:3},(_,n)=>period('SUSP','Failure to Pay Traffic Ticket',{ticket:'DEMO-FTP-'+(n+1)})),
  period('SUSP','Driving Under the Influence',{ticket:'DEMO-DUI',iid:'Y'}),
  'VIOL: 499 - Driving Under the Influence Ticket#: DEMO-DUI Violation: 01/15/2024 Conviction: 02/01/2024 Recd: 02/02/2024',
  period('SUSP','Unlawful Alcohol Concentration',{ticket:'DEMO-DUAC',end:'01/01/2026'}),
  'VIOL: 499 - Unlawful Alcohol Concentration Ticket#: DEMO-DUAC Violation: 03/15/2023 Conviction: 04/01/2023 Recd: 04/02/2023',
  period('SUSP','Driving Under Suspension',{ticket:'DEMO-PENDING',end:'01/01/2026'}),
  'VIOL: 001 - Driving Under Suspension Ticket#: DEMO-DUS Violation: 01/01/2024 Conviction: 02/01/2024 Recd: 02/02/2024'
].join('\n');}
export function driverText(id){
  const record=driverCase(id);if(!record)throw new Error('Unknown demonstration driver.');
  const suspended=['suspended','pending','revocation'].includes(record.kind);
  const status=suspended?'SUSPENDED':record.kind==='tal'?'TEMPORARY ALCOHOL':record.kind==='unavailable'?'UNREADABLE':'NO SUSPENSION';
  const expires=record.kind==='expired'?'01/01/2025':'12/31/2099';
  return ['DEMONSTRATION - SYNTHETIC DATA','Driving Record',
    `Customer No: ${record.customer} Driver License No: ${record.license}`,
    `Name: EXAMPLE, ${record.first} Address: 100 DEMONSTRATION RD City: COLUMBIA State: SC Zip: 29201`,
    "County: RICHLAND DOB: 01/02/2000 Sex: F Driver Training: N Height: 5'05 Weight: 140 Eye Color: BRO Race: W",
    `Status - DL: ${status} CDL: NO DISQUALIFICATION`,
    ...(record.kind==='privilege'?['Special DL Privilege: DEMONSTRATION RESTRICTED PRIVILEGE']:[]),
    'License Information Type Class Function Issued Expires Printed Date Restr.Endor.Document Identifier',
    ...(record.kind==='unlicensed'?[]:[`Current (ACN / DDN) ${record.kind==='id'?'ID':'DL'} D Renewal 01/01/2024 ${expires} 01/02/2024 N N 1000000000000000001`]),
    ...(record.kind==='suspended'?[mixedPeriods()]:[]),
    ...(record.kind==='pending'?[period('SUSP','Driving Under Suspension',{end:'01/01/2026'})]:[]),
    ...(record.kind==='revocation'?[period('REVO','Delinquent Child Support')]:[]),
    ...(record.kind==='iid'?[period('SUSP','Driving Under the Influence',{ticket:'DEMO-IID',end:'01/01/2026',met:'01/01/2026',iid:'Y'})]:[]),
    'DEMONSTRATION ONLY - NOT A GOVERNMENT RECORD'
  ].join('\n');
}
