/** Invented records only. No uploaded HTML, session tokens or real report data. */
import {DRIVER_CASES,driverText} from './driver-cases.mjs';
export const DEMO_PATHS=Object.freeze({
  login:'/SCTRNS/Member/logon.aspx',disclaimer:'/SCTRNS/Member/Disclaimer.aspx',
  menu:'/SCTRNS/Member/Transactions/TransactionList.aspx',
  search:'/SCTRNS/Member/Transactions/VehRec/Page1.aspx',
  result:'/SCTRNS/Member/Transactions/VehRec/Page2.aspx',
  pdf:'/SCTRNS/Member/Transactions/ViewAttachment.aspx',
  driverSearch:'/SCTRNS/Member/Transactions/DrvRec/Page1.aspx',driverResult:'/SCTRNS/Member/Transactions/DrvRec/Page2.aspx',
  addressSearch:'/SCTRNS/Member/Transactions/DrvSameRes/Page1.aspx',addressResult:'/SCTRNS/Member/Transactions/DrvSameRes/Page2.aspx',
  scuttiesHandoff:'/SCTRNS/Member/Transactions/SCUTTIES/SCUTTIES.aspx',scuttiesSearch:'/SCTRNS/Member/Transactions/SCUTTIES/Search.aspx'
});
const definitions=[
  ['DEMO001','Valid plate','One registered owner.','valid'],
  ['DEMO002','Expired plate','A completed decal expiration date.','expired'],
  ['DEMO003','Suspended plate','An enforcement description and statute.','suspended'],
  ['DEMO004','Temporary tag','T60V with a blank decal date and appended display year.','temporary'],
  ['DEMO005','Shared-address owners','Two owners; the second address is omitted.','shared'],
  ['DEMO006','Owner and lessee','A separate lessee with its own address.','lessee']
];
export const DEMO_CASES=Object.freeze(definitions.map(([plate,title,description,kind])=>Object.freeze({id:plate,plate,title,description,kind,recordType:'plate'})));
export const ADDRESS_CASES=Object.freeze([
  Object.freeze({id:'ADDRESS001',license:'100000101',title:'Avery’s household',description:'Three fictional customers, with Avery listed first.',recordType:'residence',members:Object.freeze(['DRIVER001','DRIVER002','DRIVER003'])}),
  Object.freeze({id:'ADDRESS002',license:'100000102',title:'Morgan’s household',description:'The same address, with Morgan listed first.',recordType:'residence',members:Object.freeze(['DRIVER002','DRIVER001','DRIVER003'])})
]);
export const ALL_DEMO_CASES=Object.freeze([...DEMO_CASES,...DRIVER_CASES,...ADDRESS_CASES]);
export function demoCase(id) {return ALL_DEMO_CASES.find(record=>record.id===String(id||'').trim().toUpperCase());}
export function residenceText(id){
  const record=demoCase(id);if(record?.recordType!=='residence')throw new Error('Unknown demonstration residence.');
  return ['Customers at Same Residence','DEMONSTRATION - SYNTHETIC DATA',
    'Address: 100 DEMONSTRATION RD City: COLUMBIA State: SC Zip: 29201',
    ...record.members.map(id=>{const member=demoCase(id);return `Customer Number: ${member.customer}\nDriver License No: ${member.license} Name: EXAMPLE, ${member.first}`;}),
    'DEMONSTRATION ONLY - NOT A GOVERNMENT RECORD'].join('\n');
}
export function recordText(id){
  const record=demoCase(id);if(!record)throw new Error('Unknown demonstration record.');
  return record.recordType==='plate'?vehicleText(id):record.recordType==='license'?driverText(id):residenceText(id);
}
/** Produce label-compatible fictional vehicle data for the real production parsers. */
export function vehicleText(plate) {
  const record=demoCase(plate);if(record?.recordType!=='plate')throw new Error('Unknown demonstration plate.');
  const temporary=record.kind==='temporary',expired=record.kind==='expired';
  return [
    'DEMONSTRATION - SYNTHETIC DATA','Vehicle Record',
    'VIN: 1DEMA12345X000001 Year: 2024 Make: HOND Model: DEMO Body: SD',
    'Empty Weight: 3000 Title Number: 100000001 Status: ACTIVE Issue Date: 01/01/2024 Dup: N',
    'Owner Number: 10000001 Owner Name: EXAMPLE, AVERY',
    'Owner Address: 100 DEMONSTRATION RD COLUMBIA SC 29201',
    ...(record.kind==='shared'?['Owner Number: 10000002 Owner Name: EXAMPLE, MORGAN']:[]),
    ...(record.kind==='lessee'?['Registrant/Lessee Number: 10000003 Registrant/Lessee Name: DEMONSTRATION SERVICES LLC',
      'Lessee Address: 200 SAMPLE ST LEXINGTON SC 29072']:[]),
    'Last Transaction: RENEWAL',
    `Plate Number: ${record.plate}${temporary?' 2026':''} Plate Class: ${temporary?'T60V TEMPORARY PLATE-VEHICLE':'ABC PRIVATE PASSENGER'}`,
    'Vehicle Type: PC Date of Issue: 01/01/2024',
    `Plate Exp Date: 12/31/2099 Decal Exp Date: ${temporary?'':expired?'01/01/2000':'12/31/2099'}`,
    'Decal Number:',
    `Enforcement Description: ${record.kind==='suspended'?'Demonstration insurance suspension':''} Enforcement Statute: ${record.kind==='suspended'?'56-10-240':''}`,
    'DEMONSTRATION ONLY - NOT A GOVERNMENT RECORD'
  ].join('\n');
}
