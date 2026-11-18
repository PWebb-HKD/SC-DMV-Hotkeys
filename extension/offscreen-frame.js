// The isolated world supplies this extension's exact origin to the MAIN bridge.
// The website can already see its own DOM; the parent must still be our host.
if(window!==top)window.postMessage({target:'scdmv-bridge-origin',origin:chrome.runtime.getURL('').replace(/\/$/,'')},location.origin);
