/** Invented citation data only; captured records and sign-in tokens are never reused. */
const citation=(number,first,license,date,statute,offense,disposition)=>Object.freeze({
  number,first,lastName:'EXAMPLE',dob:'01/02/2000',license,state:'SC',date,statute,offense,disposition,
  address:'100 DEMONSTRATION RD',city:'COLUMBIA',zip:'29201',
  agency:'DEMONSTRATION AGENCY',officer:'DEMO OFFICER',court:'DEMONSTRATION COURT',
  trial:'12/01/2026 09:00 AM',location:'100 SAMPLE ST',county:'RICHLAND',
  vehicle:'2024 HOND DEMO',plate:'DEMO001',notes:'Fictional citation for workflow testing only.'
});
export const SCUTTIES_CASES=Object.freeze([
  Object.freeze({id:'SCUTTIES001',lastName:'EXAMPLE',dob:'01/02/2000',title:'Multiple citation results',
    description:'Three fictional citations, including two for Avery and one for Morgan.',
    citations:Object.freeze([
      citation('DEMO-CIT-001','AVERY','100000101','01/15/2024','DEMO-001','Demonstration speeding offense','Guilty'),
      citation('DEMO-CIT-002','AVERY','100000101','03/15/2025','DEMO-002','Demonstration equipment offense','Dismissed'),
      citation('DEMO-CIT-003','MORGAN','100000102','04/20/2025','DEMO-003','Demonstration traffic offense','Pending')
    ])}),
  Object.freeze({id:'SCUTTIES002',lastName:'DE LA CRUZ',dob:'02/29/2000',title:'Compound surname',
    description:'One citation for a fictional person with a compound surname and leap-day DOB.',
    citations:Object.freeze([Object.freeze({...citation('DEMO-CIT-004','TAYLOR','100000199','05/10/2025','DEMO-004','Demonstration traffic offense','Pending'),lastName:'DE LA CRUZ',dob:'02/29/2000'})])}),
  Object.freeze({id:'SCUTTIES003',lastName:'DEMO-NOMATCH',dob:'01/02/2000',title:'No citations found',
    description:'A deliberately empty local result; the no-results wording is demo-defined.',citations:Object.freeze([])})
]);
