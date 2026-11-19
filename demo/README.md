# Local practice portal

Run `npm run demo` from the repository root, or `node server.mjs` from this demo folder, with Node.js 22 or newer. Open `http://127.0.0.1:4173`, sign in with **demo / demo**, and continue to transactions. No npm install or extra runtime dependency is needed. Use `node server.mjs --port 4174` to choose another port.

To update a running copy, stop it with **Ctrl+C**, replace its demo folder with the latest demo folder from the test branch, then run `node server.mjs` again and refresh Chrome. Demo-only work does not increment the extension release version. There is no extension reload required for this standalone site update.

The server binds only to 127.0.0.1, makes no outbound requests, accepts no POST credentials, and logs no request data. Login controls stay disabled until the local handler is ready. Demo credentials are compared only in the browser; the password field is cleared. Only a demo authentication flag, predefined selected records and an optional fictional customer queue enter this site's own sessionStorage. Reset demo clears keys in the scdmv-demo- namespace. It cannot read an installed extension's vault, blacklist or preferences.

## Vehicle records

| Plate | Scenario |
| --- | --- |
| DEMO001 | Valid plate, one owner |
| DEMO002 | Expired decal |
| DEMO003 | Suspended plate |
| DEMO004 | T60V temporary tag, blank decal date, appended display year |
| DEMO005 | Two owners with an omitted shared address |
| DEMO006 | Owner and registrant/lessee with separate addresses |
| DEMO404 | Record-not-found validation |

Select an owner in a vehicle status preview to open the synthetic customer result resolved from that owner's saved number. Avery and Morgan have profiles below. The business lessee does not have a fictional driver profile; its button explicitly explains that limitation and does not substitute another person.

## Driver and customer records

DL and customer searches use the **same Page 1 and Page 2**. Enter either number in its respective input, not both. Numeric normalization uses the production helper, including leading zeroes and the customer C0 prefix. For example, `C0 0010000001` resolves to customer 10000001. Unknown numbers display local validation rather than contacting the DMV.

| DL number | Customer number | Scenario |
| --- | --- | --- |
| 100000101 | 10000001 | Avery Example, valid license and first vehicle owner |
| 100000102 | 10000002 | Morgan Example, expired license and second shared-address owner |
| 100000111 | 10000011 | Six active suspensions, two pending reinstatement, DUS/DUI/DUAC history and IID warning |
| 100000112 | 10000012 | Completed period with pending reinstatement |
| 100000113 | 10000013 | Active license revocation |
| 100000114 | 10000014 | Valid Temporary Alcohol License |
| 100000115 | 10000015 | Valid license with special DL privilege |
| 100000116 | 10000016 | Valid license with IID requirement |
| 100000117 | 10000017 | Current identification card only |
| No DL number | 10000018 | Unlicensed customer |
| 100000119 | 10000019 | Unavailable license status |

The suspended example spans multiple PDF pages, with offense groups kept together. Production status parsing determines active/pending totals, DUI/DUAC ticket deduplication, reason order, IID warnings and qualifier text. Expand reason groups to see dates/tickets and exercise the normal popup timeout resets. These records contain no real person, portrait or uploaded driving-record data.

## Customers at the same residence

Use DL **100000101** or **100000102**. The searched person is first in the synthetic residence PDF. The page extracts the actual PDF through PDF.js, then uses the production ownerNumbers helper to collect three customer numbers in order, ahead of repeated driver headings.

Individual names open customer results. **Collect customers and run next** retains all three numbers and starts with the second. The customer results page shows Previous/Next controls, without wrapping, and Clear queue. This is a local demo queue, separate from the installed extension's queue and blacklist.

## PDFs and previews

Open PDF serves a genuine, selectable-text PDF at ViewAttachment.aspx. Chrome provides its native viewer; its shadow DOM is not copied. Every page is labeled **DEMONSTRATION - SYNTHETIC DATA** and **NOT A GOVERNMENT RECORD**. Report titles precede the watermark so residence classification can recognize its heading. PDFs are generated locally without dependencies and are not cached by the mock server.

Status and barcode previews use bundled production PDF.js to extract the generated PDF, followed by existing production parsers and panel/barcode controllers. An HTTP-only adapter supplies mock worker messages to those views. Barcode editing and popup timers work. Residence reports have no license-status or barcode preview. The adapter lives outside extension/ and is never loaded by the installed extension.

This prototype does not demonstrate installed-extension permissions, global hotkeys, native background-window behavior, vault/blacklist storage or remote DMV connectivity. Photos, audio and SCUTTIES are outside this iteration. The installed extension continues to permit automation only on SCDMV; connecting a separate, clearly labeled demo environment with isolated state remains a later integration step. Reviewers should eventually receive a launcher that does not require setting up a local server.

Raw HTML captures remain outside Git. [DOM-CONTRACT.md](DOM-CONTRACT.md) records the retained selector interface and exclusions. New samples supplied for driver/customer and residence pages were used as reference data only; their scripts, identifiers, hidden tokens and private display values are not served or committed.

## Checks

- `node --test tests/demo-portal.test.js`: local serving, scenario parsing and request/file boundaries.
- `CHROME_PATH=/usr/bin/chromium npm run test:demo`: both Chromium suites, including all vehicle/driver PDFs, production status/barcode views, shared input validation, owner follow-ups and the residence queue.

Browser checks require the same development Playwright/Chromium setup as the existing project tests. The server itself needs only Node. Screenshots and synthetic barcode payloads stay in ignored test-results/demo and test-results/demo-records directories.
