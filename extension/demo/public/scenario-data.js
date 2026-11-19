/** Fixed, explicitly simulated record-search outcomes. No arbitrary delays, destinations or requests. */
export const SCENARIOS=Object.freeze([
  {id:'normal',label:'Normal search'},
  {id:'expire-before',label:'Session expires before the search'},
  {id:'expire-results',label:'Session expires while results load'},
  {id:'error',label:'Transaction fails (service error)'},
  {id:'slow',label:'Delayed results (2 seconds)'},
  {id:'timeout',label:'Results time out (3 seconds)'},
  {id:'report-failure',label:'PDF service unavailable (HTTP 503)'}
].map(Object.freeze));
export const SLOW_MS=2000,TIMEOUT_MS=3000;
export const knownScenario=value=>SCENARIOS.some(s=>s.id===value)?value:'normal';
export function scenarioControls(){return `<details class="card demo-test-controls"><summary>Demo test controls · simulate the next record search</summary><label for="demo-scenario">Next plate, DL, customer or same-residence search</label><select id="demo-scenario">${SCENARIOS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}</select><p class="muted">Each selection applies once to the next valid record search, then resets to Normal. These conditions are simulated; no live service is contacted. SCUTTIES uses its separate local search.</p></details>`;}
