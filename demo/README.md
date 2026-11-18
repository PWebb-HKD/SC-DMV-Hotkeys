# Local practice portal

Run `npm run demo` from the repository root with Node.js 22 or newer. Open `http://127.0.0.1:4173`, sign in with **demo / demo**, continue to transactions, and select a plate. No npm install or new runtime dependency is needed for the server. To choose another port, run `npm run demo -- --port 4174`.

The server binds only to 127.0.0.1. It makes no outbound requests, accepts no submitted credentials, and logs no request data. Login inputs and the submit button stay disabled until their local JavaScript handler is ready. Browser code compares the fixed demo credentials locally, clears the password field, and stores only a demo sign-in flag and the selected fictional plate in this site's sessionStorage. Reset demo clears those two keys. It cannot read an installed extension's vault, blacklist or preferences.

| Plate | Scenario |
| --- | --- |
| DEMO001 | Valid plate, one owner |
| DEMO002 | Expired decal |
| DEMO003 | Suspended plate |
| DEMO004 | T60V temporary tag, blank decal date, appended display year |
| DEMO005 | Two owners with an omitted shared address |
| DEMO006 | Owner and registrant/lessee with separate addresses |
| DEMO404 | Record-not-found validation |

Open PDF serves an actual generated, selectable-text PDF at a ViewAttachment.aspx route. Chrome supplies its own native PDF viewer. Its shadow DOM is not copied or modified. Each report is explicitly marked **DEMONSTRATION - SYNTHETIC DATA** and **NOT A GOVERNMENT RECORD**. Valid/expired scenarios use fixed future/past dates to remain repeatable.

Status and barcode previews use the submitted extension's actual PDF.js library to extract the generated PDF, then the existing status/barcode parsers and panel/barcode controllers. A local HTTP-only adapter supplies the worker message response to those views. Barcode editing and the existing popup timers still work. Customer follow-up buttons report that customer searches are outside this first prototype. The adapter lives outside extension/ and is never loaded by the installed extension.

## Scope and next integration step

This first prototype is manually navigable. The installed extension still permits automation only on the real SCDMV origin; pointing it at localhost is not yet supported. Global hotkeys, native background-window behavior, the production vault/blacklist, customer/driver/residence searches and SCUTTIES are not demonstrated by this site. The local preview is not proof of live DMV compatibility or Web Store approval.

A later, explicit demo environment can connect the shared workflow to these pages with isolated demo credentials/state and narrow origin checks. It must be visible to reviewers and users. Do not change DNS/hosts or proxy the real DMV site to make the prototype appear to be a live service. Reviewers should eventually have a launcher that does not require installing a local server.

The supplied HTML was used only to identify required controls and page order. Raw captures stay outside Git. See [DOM-CONTRACT.md](DOM-CONTRACT.md) for the retained interface and removed material.

## Checks

`node --test tests/demo-portal.test.js` checks local serving, boundaries, PDFs and scenario parsing. `CHROME_PATH=/usr/bin/chromium node tests/demo-browser.mjs` exercises real browser navigation, PDF.js extraction, all six production status/barcode views, validation, reset, local-only requests, and the production origin guards.
