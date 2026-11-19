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

The suspended example spans multiple PDF pages, with offense groups kept together. Production status parsing determines active/pending totals, DUI/DUAC ticket deduplication, reason order, IID warnings and qualifier text. Expand reason groups to see dates/tickets and exercise the normal popup timeout resets. These records contain no real person, photograph or uploaded driving-record data.

### Driver photo and name previews

On a driver/customer results page, enable **Show driver photo and name in status preview**, then open **Preview status alert**. This separate demo preference defaults off and stays in this tab's session. It does not change the installed extension's setting.

- **100000101 / customer 10000001 (Avery)** embeds a procedurally drawn fictional portrait in the PDF. The actual production extractor reads that image and name for the alert.
- **100000117 / customer 10000017 (Drew)** and **customer 10000018 (Remy)** embed a synthetic standard-layout no-photo placeholder. The production detector suppresses its image; the alert retains the name and says No photo available.
- Other profiles contain no image. With the preference enabled, the alert retains the name and says Photo unavailable.

The PDF writer embeds a real RGB image XObject in the first-page header, separated from selectable report text. All images are generated locally without image libraries or private source images. The no-photo fixture recreates the detector's existing non-personal text-mask signature; this validates that known signature and the full extraction/rendering path, rather than establishing detection accuracy for unrelated placeholder designs.

## Session expiration and failed-search testing

On plate, DL/customer and same-residence search forms, expand **Demo test controls** and choose the next outcome before submitting a known demo number. Invalid/not-found inputs do not consume the selection. A valid form submission consumes it once, so the next search defaults to Normal.

| Outcome | Behavior |
| --- | --- |
| Session expires before the search | Clears this tab's demo login/record/queue selections and returns to login |
| Session expires while results load | Visits a waiting results page, then returns to login without a completed record |
| Transaction fails | Opens the local ErrorPage.aspx with HTTP 503 and the normal error-message interface |
| Delayed results | Waits two seconds with PDF/preview actions hidden, then shows the result |
| Results time out | Waits three seconds, then shows a timeout with a return-to-search link; no PDF or queue collection runs |
| PDF service unavailable | The result page loads, but its PDF endpoint returns HTTP 503 and status/barcode previews report the extraction failure |

**Expire demo session** in the header also exercises a manual expiration, including from SCUTTIES. Sign back in with demo/demo and submit again; searches are not automatically resubmitted. Expiration clears only this tab's authentication and record/queue/fault selections, retaining its photo-preview preference. Reset demo clears the entire scdmv-demo- namespace. Other open tabs have separate demo session state.

These failures are explicit, bounded fixtures, not reproductions of an observed live outage. Delay/timeout timing is fixed locally and does not change production extension timeouts. Cancel / return to search leaves no newly completed record; failed or pending searches do not advance an existing customer queue. A failed PDF cannot reuse a previous alert or portrait. Record fault controls do not intercept the separate SCUTTIES matching workflow; its header expiration action remains available.

## Customers at the same residence

Use DL **100000101** or **100000102**. The searched person is first in the synthetic residence PDF. The page extracts the actual PDF through PDF.js, then uses the production ownerNumbers helper to collect three customer numbers in order, ahead of repeated driver headings.

Individual names open customer results. **Collect customers and run next** retains all three numbers and starts with the second. The customer results page shows Previous/Next controls, without wrapping, and Clear queue. This is a local demo queue, separate from the installed extension's queue and blacklist.

## PDFs and previews

Open PDF serves a genuine, selectable-text PDF at ViewAttachment.aspx. Chrome provides its native viewer; its shadow DOM is not copied. Every page is labeled **DEMONSTRATION - SYNTHETIC DATA** and **NOT A GOVERNMENT RECORD**. Report titles precede the watermark so residence classification can recognize its heading. PDFs are generated locally without dependencies and are not cached by the mock server.

Status and barcode previews use bundled production PDF.js to extract the generated PDF, followed by existing production parsers and panel/barcode controllers. An HTTP-only adapter supplies mock worker messages to those views. Barcode editing and popup timers work. Residence reports have no license-status or barcode preview. The adapter lives outside extension/ and is never loaded by the installed extension.

This prototype does not demonstrate installed-extension permissions, global hotkeys, native background-window behavior, vault/blacklist storage or remote DMV connectivity. Audio is outside this iteration. The installed extension continues to permit automation only on SCDMV; connecting a separate, clearly labeled demo environment with isolated state remains a later integration step. Reviewers should eventually receive a launcher that does not require setting up a local server.

Raw HTML captures remain outside Git. [DOM-CONTRACT.md](DOM-CONTRACT.md) records the retained selector interface and exclusions. New samples supplied for driver/customer and residence pages were used as reference data only; their scripts, identifiers, hidden tokens and private display values are not served or committed.

## SCUTTIES citations

After signing into the practice portal, select **SCUTTIES** from Transactions. A separate foreground tab simulates automatic sign-in, then opens the citation search. No second account is needed; no credentials or tokens are exchanged. The catalog also provides buttons to fill these sample searches:

| Last name | Date of birth | Result |
| --- | --- | --- |
| EXAMPLE | 01/02/2000 | Three citations: two for Avery and one for Morgan |
| DE LA CRUZ | 02/29/2000 | One citation; compound surname and leap-day DOB |
| DEMO-NOMATCH | 01/02/2000 | No citations found |

Click **Search**, then **View** beside a citation. The read-only display contains that occurrence's identity, address, offense, disposition, vehicle, court, officer and location. **Back to results** retains the search and focuses the corresponding View button. Reloading restores the selected known demo search/citation in that tab. **Print fictional citation** prints the demo detail page with its synthetic-data label. **Clear** removes the search and result selection.

Surname/DOB comparisons happen only in the browser; searches never put those values in a request or URL. Only known catalog/citation IDs enter scdmv-demo- session state. Unknown identities return no results, malformed dates show validation, and invalid saved selections cannot borrow an earlier record. The no-results wording and the brief sign-in transition are demo-defined because those live states were not supplied. Citation editing, saved drafts, data entry, reports and account administration are not implemented.

The captured search puts Search first and Show SAVED Citations second. The current installed extension's positional SC_SEARCH selector targets the second button, so it would select the saved-citation action on this captured layout. The demo preserves the supplied order; correcting that production selector is deferred to the versioned extension/demo integration work. No extension code or host permission changes are included here.

## Checks

- `node --test tests/demo-portal.test.js`: local serving, scenario parsing and request/file boundaries.
- `CHROME_PATH=/usr/bin/chromium npm run test:demo`: all four Chromium suites, including vehicle/driver PDFs, production status/barcode views, shared input validation, owner follow-ups, the residence queue, SCUTTIES, photo/placeholder extraction and recovery scenarios.
- `CHROME_PATH=/usr/bin/chromium node tests/demo-scutties-browser.mjs`: focused SCUTTIES handoff, calendar validation, citations/details, restoration, mobile layout and local-only request checks.
- `CHROME_PATH=/usr/bin/chromium node tests/demo-recovery-browser.mjs`: focused real photo/placeholder PDF extraction, optional identity rendering, session expiration, pending/cancelled/timed-out searches, HTTP failures and successful retries.

Browser checks require the same development Playwright/Chromium setup as the existing project tests. The server itself needs only Node. Screenshots and synthetic barcode payloads stay in ignored test-results/demo, test-results/demo-records, test-results/demo-scutties and test-results/demo-recovery directories.
