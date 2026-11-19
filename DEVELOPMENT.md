# Maintaining SC DMV Hotkeys

This guide covers first-party code. Start with the module overview, read each function's contract and cancellation/ownership comments, then run the relevant tests. The extension loads directly from `extension/`; development dependencies are not runtime requirements.

## Module responsibilities

`demo/` is a standalone loopback-only synthetic record portal, outside the installed extension package. Start it with npm run demo (or node server.mjs from demo/). It reconstructs the supplied vehicle, shared driver/customer and residence interfaces using fresh HTML and local handlers. DL and customer inputs share one Page 1 and Page 2. Predefined catalog records generate real multi-page synthetic PDFs without additional runtime dependencies; offense groups stay together and each page has a watermark/footer. The report title precedes the watermark for residence classification. HTTP-only previews extract all PDF pages with bundled production PDF.js and use existing status/barcode parsers/controllers. A saved owner index resolves a known fictional customer; residence collection uses ownerNumbers on actual PDF text, retains all customers and starts at the second, with a separate local Previous/Next queue. Unknown cases never fall back to a stale result. Demo state uses only the scdmv-demo- session namespace, which Reset clears. Production origin checks, permissions, vault and automation remain unchanged. Node tests live in tests/demo-portal.test.js; all three browser suites run with npm run test:demo. SCUTTIES has a simulated foreground handoff, local surname/DOB matching, a citation table and read-only detail/print view, with known catalog IDs only in session state. The captured Search-first/Saved-second button order exposes a positional selector mismatch in automation.js; record it for the subsequent versioned integration rather than changing production code in demo-only work. Raw captures remain outside Git; demo/DOM-CONTRACT.md records interface/provenance facts. Demo-only changes do not increment extension versions. The source ZIP includes demo/; a Web Store runtime ZIP should include extension/ contents only.

| Area | Modules | Contract and useful checks |
| --- | --- | --- |
| Commands, URLs, report identifiers | `core.js` | Shared command IDs, input limits, report recognition, and history replay; core/shortcut tests. |
| Worker orchestration | `background.js` | One active command, pending UI, queue commits, history, report snapshots, and message authorization; queue/history tests. |
| Portal workflow | `automation.js`, `page.js` | Login, focus, form events, one-time initial recovery, and classified errors; login/browser tests. |
| Results discovery | `results.js`, `pdf-routing.js` | Attribute changed tabs to Download and route only top-level attachments; results/routing tests. |
| Cancellation | `run.js` | Guard API calls and continuations against replaced commands; run/queue tests. |
| PDF extraction and display | `reader.js`, `pdf-dark-view.js`, `pdf-print.js` | Job-bound text extraction, continuous rendering, image preservation, selection, and immutable native printing; browser tests. |
| Status evaluation | `status-alerts.js` | Pure South Carolina calendar/date rules and display-only alert data; status/report-layout tests. |
| Barcode mapping and rendering | `barcode-data.js`, `barcode-editor.js`, `barcode.js` | ASCII field mapping, framing, selected-party isolation, popup-local corrections, local PDF417 drawing; mapping/decoder tests. |
| Vault and search protection | `vault.js`, `blacklist.js` | Serialized encrypted persistence, canonical identifiers, and mandatory blocking errors; vault/blacklist/queue tests. |
| Alert preferences | `alert-settings.js` | Whitelisted persistent preferences and session mirrors; preference/queue tests. |
| Audio | `voice-recordings.js`, `audio-alerts.js`, `audio-player.js` | Shared asset catalog, exclusive source selection, cancellation, and offscreen playback; audio/browser tests. |
| DMV theme | `dmv-theme-start.js`, `dmv-theme.js`, `dmv-theme-settings.js`, `dmv-theme.css` | Early-paint styling and narrowly authorized appearance updates; theme-browser/queue tests. |
| Extension UI | `popup.js`, `panel.js`, `shortcut-setup.js`, `shortcut-menu.js` and their HTML/CSS | Settings, prompt/status rendering, actual shortcut assignments, and user confirmations; browser tests. |

## Status popup owner details and settings grouping

`plateStatus` attaches ordered `owners: [{name,address,number?}]` display data for numbered Owner, Customer and Registrant/Lessee blocks in the vehicle body. `vehicleOwners` starts at VIN and stops at enforcement/footer data. Read category-matched Name/Address fields between known labels, including Relationship/Mailing Address boundaries and short Lessee Address / Registrant Address aliases for registrant-lessee blocks. Track address-label presence separately from its value. Only a later same-category owner/customer with an omitted registered-address label inherits the first co-owner’s address for popup display; explicitly blank addresses and registrant/lessee blocks never inherit. Mailing addresses are not substitutes. Barcode selection remains strict about incomplete party fields. Preserve Unicode, punctuation and report order rather than applying barcode name/address normalization. Unresolved missing fields stay empty and the panel labels them unavailable. Normalize a block’s Number field using the same customer rules (including C0 and leading zeroes); omit malformed identifiers. Shared-address inheritance is for popup display, not a relaxation of strict barcode mapping. Owner queue collection remains unchanged.

The plate panel renders an ordered owner list after its vehicle grid, including unavailable-status results when owners were parsed. Names/addresses use textContent, white supporting text and the existing dynamic height/font controller; main status headings remain fixed. Owner details never enter voice sections, persistent preferences or license/blacklist cards. They remain derived display data within the existing trusted-session report/panel lifecycle.

An owner with a valid saved number is a native button styled as its name, supporting mouse and keyboard. The view sends only panel ID and owner index through alert-owner-search. The worker requires the live plate-alert entry, owning panel URL, current run and valid index, then resolves/normalizes the number from entry.data rather than accepting a view-supplied number. Dispatch customer with replay=true and the saved source report tab so no input prompt appears; ordinary vault/blacklist authorization and hidden/foreground settings still apply. Beginning the new command closes the old alert. Stale/foreign views and malformed indices cannot submit queries. No list of owners is persisted outside the existing trusted-session alert/report lifecycle.

Ordinary valid tag/DL/customer alerts now last 30 seconds, including TAL and privilege-qualified valid licenses. Warning/danger alerts and the valid-license IID warning retain their 90-second lifetime. Voice playback policy is independent of this timer.

The Settings status-alert switch controls `statusAlertSettings`, which contains the existing photo/name and background-search switches. Keep their saved preference keys and choices when collapsing or disabling the parent. Voice controls remain independent. Photo/name stays a single combined toggle and no owner-display preference is added.

## Execution contexts and trust boundaries

The manifest requires Chrome 140 or newer because worker startup restricts both local and session storage to `TRUSTED_CONTEXTS`. `StorageArea.setAccessLevel` existed for session storage earlier, but support for local storage starts in Chrome 140 ([compatibility reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/setAccessLevel#browser_compatibility)). Keep the minimum aligned with this requirement; skipping the local-storage restriction would change the storage access policy.

The Manifest V3 worker owns browser APIs and private state. Popup, prompt, barcode, and setup pages are trusted extension contexts. Render report and error strings with `textContent`; no report text should be interpolated into HTML. Interactive panels use unpredictable job IDs, and the worker normalizes replies before acting.

`pageOperation` is serialized into the website's MAIN world. Its helpers and origin literals must stay inside that function; imported extension bindings are unavailable after serialization. Native input setters and bubbling events synchronize portal frameworks. Credential injection is restricted to the DMV login URL, and PDF requests are restricted to same-origin attachment URLs. These checks deliberately repeat checks made by the worker because serialization crosses a context boundary.

The theme-init message is the only website-content-script path into the worker. It returns `{enabled}` and inserts USER-origin CSS into the exact authorized sender document. All other message requests require an extension-owned sender URL and extension ID. Theme code must never read credentials, form values, or hidden portal state. External theme-coexistence metadata and the test reference-engine API use fixed protocol identifiers; their literal names are compatibility requirements, not explanatory documentation.

The reader's job ID is bound to its tab and, for same-tab viewers, committed document ID. Offscreen audio accepts extension messages and only catalogued packaged assets. SCUTTIES enters through the transaction-page link and automates only the declared DMV HTTPS origin. No optional host permissions or permission-request UI are present. A different origin is rejected before DOM inspection or input filling.

## Search lifecycle and failure handling

The optional background query window lives in `background-search.js`. Routing requires status popups, explicit background opt-in, and a plate/license/customer/address query. Customer collection/queue/history entry points share this routing. SCUTTIES explicitly retains its original foreground flow even with the setting enabled, per user instruction. The method selector and offscreen iframe transport were removed after user testing; whitelisted preference migration drops the retired method while preserving the background toggle. Offscreen permission/document support remains necessary for existing packaged voice audio.

The worker creates a blank regular window with `url:'about:blank',type:'normal',focused:false,state:'minimized'` and an active tab. This replaces the popup that the user reported appearing immediately despite the minimized flag. Do not load a DMV URL in windows.create. Read the new window's actual state; if it is not minimized, issue at most one `windows.update` on that owned blank helper with `state:'minimized',focused:false`, then verify again. Only navigate to LOGIN after Chrome reports the helper minimized. Failure stops before DMV navigation and closes the owned blank tab. Do not include width/height with minimized creation.

Background startup also waits for the owned about:blank tab to complete with no pending URL (10-second bound), then waits for the initial login navigation to commit and finish before entering shared search automation (60-second bound). Chrome's tabs.update resolves before commitment, so an old blank URL must not trigger a competing login load. Shared login likewise recognizes pendingUrl=LOGIN and waits for pending navigation to settle rather than accepting the old committed page. A native Navigation rejected error permits at most one retry of the initial login GET after a short delay and a fresh check that the tab remains blank in the owned helper. A login already pending/committed is awaited without retry; moved or manually navigated tabs stop startup and are preserved. Cancellation guards cover both waits and recovery. No credentials or search number have been submitted at this recovery point. Query-form/result navigation and submitted transactions are never retried by this recovery.

The shared navigateTab adapter adds a fixed workflow stage to Chrome's otherwise generic Navigation rejected error, without exposing report URLs or identifiers. It does not retry. Login, query-form and captured-PDF viewer failures are distinguishable; persistent hidden startup rejection also explains that no search was submitted and suggests normal foreground search. Chromium's tabs API uses this message for multiple underlying content-layer failures, so the user's exact native trigger is not established merely by reproducing a startup race in fixtures. Installed Windows verification remains necessary.

Initialization ends before DMV navigation. There are no window-state observers or repeated minimize calls. A user who manually restores the helper during a query must retain control. The query-task navigation focus path and its error handler do not focus, restore, minimize or reselect existing windows/tabs. Cleanup removes only the owned blank/portal tab still in the helper window; moved tabs and unrelated user pages are retained. The report destination is resolved before helper creation, so the new regular helper cannot be selected as the main results window.

Only completed same-address results intentionally use ordinary focusTab with the run/API adapter and without queryTask: these reports have no status popup. This happens after immutable PDF capture, helper cleanup, report publication, and the original resultReady history/queue commit. It selects the report tab and restores/focuses the destination browser window if needed. Plate/license/customer results stay inactive and use the status popup. Cancellation or replacement after publication/commit must prevent stale result focus. SCUTTIES does not enter this transport.

The report watcher intercepts the owned Download handoff (`window.open`, blank handles with location assignment, or direct attachment links), rejects unsupported destinations, and fetches the report using the query's DMV context. An expiring tab-local sessionStorage marker reinstalls interception before scripts after an ASP.NET postback. The packaged top-frame MAIN hook is generated from the canonical `pageOperation` by `node tools/build-background-report.mjs`; `npm run check` detects stale output. Ordinary DMV tabs have no marker. Unsupported report flows stop without automatic transaction retry. Existing pre-submission warm-session recovery remains intact.

`publishBackgroundReport` reuses the newest tracked query viewer in the destination window, or creates an inactive tab. `reusableBackgroundResult` requires this extension's exact reader page, query/pdf flags, a job ID, a recognized attachment source matching trusted session pdfSources, and a creation timestamp. It excludes native print/other-extension tabs, other windows, and pending navigation away from the reader. Recheck the chosen tab immediately before publication; adopt older-version query viewers when those checks match. Do not close old duplicates or move a user-moved viewer back. Existing selection is preserved on reuse; the separate same-address completion policy remains in effect.

Every publication gets fresh immutable bytes and a new one-use job, expected reader URL and document binding. Cancel any old capture and serialize old snapshot writes with cache invalidation before navigating the reused viewer, so delayed text/photo writes cannot bleed into the new report. Bind the first handshake to the expected URL, then require the bound document on results; reject one-shot results before handshake. Navigation failure may remove a newly allocated blank tab but must never close a reused viewer. Worker regressions exercise successive reports, stale URLs/documents/jobs, delayed snapshot writes, manual navigation during candidate selection, a closed target and navigation failure.

PDF.js extraction sends text and optional identity to the worker **before** starting display rendering. Its `reader-result` means parsing is complete, not that the first PDF page has painted. PDF.js display tasks use requestAnimationFrame, which may pause in hidden/minimized tabs. Optional cropped-photo extraction uses PDF.js `intent:'print'` solely to paint without animation frames; it does not invoke printing. Display runs independently, exposes `body.dataset.pdfView` as loading/ready/error, and reports display errors locally after the parsing job is consumed. Printing retains the same loaded document/bytes, independent of paint and worker acknowledgement. Cancellation and stale reader/document guards still apply; reloading a query viewer never refetches an old mutable report URL.

Browser regression fixtures pause animation frames while parsing reports in both color modes with identity on/off, then resume frames and verify normal rendering without duplicate reader results. Worker tests verify that parsed text triggers the status popup while the results tab stays inactive and no window-focus updates occur. Managed browser policy blocks extension installation here, so these checks do not prove native Windows focus/minimized-window behavior or live DMV compatibility. Do not bypass that policy.

1. `dispatch` creates a `SearchRun`. `beginRun` cancels the previous command, capture work, panels, and announcements. New UI waits for cleanup.
2. Basic commands ask for a number. PDF commands capture their source context and use its snapshot. A saved vault must be unlocked before protected identifiers can be checked.
3. Automation focuses a non-PDF DMV tab and establishes a session using extension credentials. A completed same-origin non-error redirect away from login verifies sign-in; no disclaimer acknowledgment is needed.
4. The first requested form may recover once through login before any identifier is submitted. A stale transaction menu uses logoff first. Repeated recovery is refused.
5. Native setters and framework events fill the selected form. Blacklist authorization runs before navigation and again immediately before submission.
6. Visible validation or public server errors stop the request. Dedicated error pages invalidate `lastQuery`. Search-phase errors become `PortalSearchError`; login, cancellation, and transport failures remain distinct.
7. Install and arm the results watcher before clicking Download. It recognizes new or navigated named results, including related error tabs, and releases listeners in `finally`.
8. Commit a successful or DMV-rejected queue attempt once. Record success/error history before presenting the result or error; do not automatically resubmit a transaction already sent to the portal.
9. Capture PDF text separately so Next remains responsive. Recheck alert preferences after extraction before publishing optional alerts/audio.

`SearchRun.step` races work against abort and checks again afterward. `guardedApi` preserves each API method's receiver and applies that boundary recursively. Stop cannot recall an HTTP request already submitted; it suppresses further actions, stale focus, and stale messages. Keep guards around new asynchronous boundaries, especially window creation, storage commits, and result callbacks.

The `help` command opens a singleton shortcut menu without calling `beginRun`. Its separate `SearchRun` lets Stop or a selected command cancel even a late window creation. Once a menu enters PiP, search dispatch preserves its independent run and owner window; Stop and private-state reset still close it. The menu captures the active tab before taking focus; `shortcut-menu-run` resolves that stored source ID and then dispatches through the normal command entry point. It never accepts an arbitrary source supplied by its page. Reopening focuses the existing menu without replacing its source. Closing it does not cancel an already running search. `shortcut-menu-layout.js` sizes content plus window decoration and aligns the accepted outer size to the current display's usable right edge, including displays with negative coordinates. Menu controls retain 44-pixel minimum touch targets and 8-pixel action gaps. Compact mode reduces surrounding padding; smaller work areas scroll only the actions and error feedback, preserving the header Close button and footer countdown.

Worker Maps hold live callbacks, not resumable jobs. Browser session data can survive worker suspension, but a restarted worker cannot resume an old callback or a partly submitted transaction.

## Queue and replay invariants

A queue stores `{values, index, sourceTabId}`. Values are canonical unique customer identifiers in report order. Before any attempt, index is zero. Thereafter it is the one-based position of the last completed/blocked attempt and the zero-based next candidate. Previous targets `index - 2` and never wraps.

Collect on a residence report starts at index one when at least two customers exist, retaining the first customer for Previous. Empty Next and other report types start at zero. A residence title takes precedence over repeated driver-number page headers. Generic driving records remain invalid collection sources.

`runSearch` consumes a queued position once on result discovery, `PortalSearchError`, or a blacklist block. Technical/login failures and cancellation preserve it. Visible DMV errors enter history with `outcome: 'error'` and `errorMessage`; blocked attempts do not become completed-search history. Replay looks up an existing session entry and validates it again; it does not move the customer queue. SCUTTIES replay carries the originating report identifiers, and identifier-free legacy replay is refused while blacklist entries exist.

## Storage and cryptography

| Location | Contents and lifetime |
| --- | --- |
| Persistent local storage | `vault` ciphertext/salt/IV, `dmvDarkMode`, `pdfDarkMode`, and whitelisted `alertPreferences`. |
| Trusted session storage | Unlocked credentials/blacklist, `vaultKey`, ciphertext identity `unlockedVault`, portal ID, login hint, queue, history, and status. |
| Report metadata in session | `tabCreated`, `pdfCreated`, `pdfSources`, `pdfViewSources`, and `pdf:TAB_ID` snapshots with capture time and optional document identity. |
| Panel data in session | `panel:UUID`, removed when a panel completes, closes, or is cancelled. |

Local/session access is restricted to trusted extension contexts. The passphrase derives an AES-GCM key through PBKDF2-SHA-256 with 310,000 iterations and a random 16-byte salt. Each encryption uses a fresh 12-byte IV. Version-2 plaintext contains credentials and blacklist; version-1 credential-only payloads migrate when saved. The passphrase is never retained. Derived key material is exported only to trusted session storage so repeated blacklist edits do not ask for the passphrase again.

Vault edits serialize, decrypt the latest matching ciphertext, merge the requested change, and re-encrypt. `unlockedVault` identifies salt/IV/ciphertext, preventing an old key cache from silently authorizing a changed vault. Alternate credentials replace the saved login while preserving blacklist/passphrase. Blacklist edits preserve the chosen active credentials.

Confirmed reset cancels work, drains tracking writes, serializes vault removal, clears all private session data, and restores only non-sensitive alert preference mirrors. New commands wait for reset to finish. The legacy forget-login action refuses to erase a locked/nonempty blacklist. Reset intentionally permits complete deletion after its explicit warning.

Alert preference writes have their own serialized lane. First migration preserves active legacy selections where no saved value exists. Saved choices win thereafter. Startup restores mirrors without replaying reports, history, or announcements. Do not allow arbitrary session properties into persistent preferences.

## PDF ownership, rendering, and printing

The attachment URL is session-dependent; the same address can return another person's report later. Never fetch an old tab URL and assume it still represents that subject. Use the captured text or request a new search. Named-window reuse invalidates old snapshots. Creation timestamps and explicit Download attribution distinguish historical tabs from current results.

Same-tab viewers bind captures to committed document IDs. A loading event alone can follow `history.replaceState` without replacing the document. Check the current top-level frame before cancelling a reader or clearing text in response to a delayed commit event.

The viewer renders near-viewport canvases serially and evicts distant canvases while retaining lightweight selectable text layers. Color changes invalidate render generations. Neutral pixels are recolored only outside image footprints; unsupported image operations keep original colors. Cancellation releases observers, render/text tasks, and the PDF document.

Printing owns the already-loaded document and text. `doc.getData()` creates an immutable extension-owned PDF Blob; the worker validates the trusted reader and Blob URL and opens/reuses a native PDF tab. Do not depend on background capture completion, mutable reader URLs, or current frame lookup to print. `pdfViewSources` is `true` for a same-tab viewer and an exact Blob URL for native-print tabs. Native-print snapshots inherit the loaded text, not the reader document ID.

## Parsing contracts

Customer normalization also accepts a case-insensitive leading C0 prefix. DL/customer normalization removes spaces and leading zeroes before applying the nine/eight-digit limits. Manual input, history replay, report follow-ups, and blacklist entries use that canonical form. Decrypted vault entries are validated again, so legacy padded identifiers are normalized and duplicate variants collapse without changing encryption formats. Plate leading zeroes remain significant.

Owner-number extraction preserves line breaks to avoid merging adjacent numeric columns. Label-based status/barcode parsing flattens whitespace. These serve different layouts and are intentionally separate. Fixture data must be synthetic; no private records or viewstate belong in source.

Dates are strict South Carolina calendar days. Month/year shifts clamp month ends. Temporary classes T45V/T60V/E45V/E60V use Plate Exp Date; a blank decal date inherits it only for temporary barcode mapping. Current credential fields take precedence over Prior entries. Unreadable required status data yields an explicit unavailable result.

Barcodes use ASCII so directory offsets equal byte counts. Driver v09 and SC registration v01 have different framing and field vocabularies. Keep SC's RAG plate-expiration/RBT decal-expiration mapping. A missing DL number stays blank; metadata absent from the report is not guessed. Registration initially binds name/address to the first numbered party. Mailing Address and Relationship labels are boundaries, not parts of identity fields. Incomplete data requires explicit user choice before selecting another party or emitting blank fields. Name punctuation remains a limited business/person heuristic, not reliable entity classification. Preserve field limits without silent truncation.

The driver/ID race mapper accepts `MLT RA`, `MULTIRACIAL`, `MULTI RACIAL` (including normalized hyphenated/whitespace variants), and `MR`. These encode as `DCLMR `, with a trailing space retaining the three-character field width. This Coplogic compatibility code was specified by the user; it is not a change to the v09 header or a claim that MR belongs to the legacy DDVRAC vocabulary. The editor exposes Multiracial and preserves byte-for-byte round trips. Unknown labels continue to be omitted with a warning instead of guessed.

`barcode-editor.js` reads the single-subfile directory and exposes human-readable fields without mutating worker-owned data. Untouched values retain their original bytes, including padding, unavailable markers, and credential inventory. Valid corrections rebuild the directory through `frameAamva`; field limits and ASCII/date/number validation apply before rendering. A recognized parsing failure produces an unencoded draft using the same report extraction. Drafts retain invalid values for review, preserve the selected party, and require validation before scanning. Unknown report types still stop with an error.

The barcode view starts read-only and unlocks through Edit Data. Invalid input or rendering errors hide the canvas to avoid scanning an older payload. Data input events renew its ninety-second deadline, including invalid edits; size changes and the edit/lock button do not. Corrections live only in the popup and never update report snapshots, history, the vault, or DMV pages.

## Theme and audio boundaries

The DMV predicate is shared with portal URL recognition. Screen-only CSS preserves form/control visibility, image colors, and print appearance. Layered important user rules take priority over ordinary page styles; the coexistence marker asks compatible competing engines to yield. The startup marker and later controller remain separate because the first must run before paint and the second manages updates/observers.

The recording catalog is shared by selection, offscreen validation, and asset checks. Audio policy chooses one source, and a generation token cancels stale speech/repeats. Offscreen document lifecycle is serialized separately from playback. Status text is derived once per announcement and excludes identifying details. Recheck cancellation after asynchronous voice/file operations.

## Review and redundancy decisions

The 1.8.6 review covers all first-party extension modules, UI/style files, tests, and maintenance scripts. Function comments now explain responsibilities, decisions, and ownership rather than development history.

- Reuse the shared DMV-tab predicate instead of maintaining an equivalent theme-specific implementation.
- Resolve a requested DOM control once per state read, reuse parsed owner-name boundaries, and build the spoken phrase once per announcement.
- Share credential validation across saved-login write paths and local-PDF browser setup across optional extraction checks. Local report checks do not assume the record count of one historical file.
- Consolidate historical documentation into current contracts and remove provenance-specific descriptions.
- Preserve independent vault, preference, tab-metadata, panel, and audio mutation lanes; combining them would couple unrelated lifetimes and error recovery.
- Preserve pre-submit authorization, post-extraction preference checks, and page-world origin checks. They close distinct races or cross trust boundaries rather than duplicating work unnecessarily.
- Keep small UI response wrappers local to separate extension documents. A shared abstraction would add coupling without reducing workflow complexity.
- Keep third-party source, generated assets, and legal notices outside first-party refactoring. Compatibility/API identifiers remain literal where required by another component.

## Validation and packaging

Run `npm run check` and `npm test` from the repository root. Browser checks require Playwright; the pinned reference-theme engine is a test-only dependency installed with `npm ci --ignore-scripts`. Tests first resolve local modules and then a managed development runtime when present.

```sh
CHROME_PATH=/usr/bin/chromium node tests/browser.mjs
CHROME_PATH=/usr/bin/chromium npm run test:dmv-theme
CHROME_PATH=/usr/bin/chromium PYTHON=python3 node tests/barcode-browser.mjs
```

The barcode suite requires Python `zxing-cpp` and Pillow, independently decodes every generated image, and compares payload bytes. The main browser harness covers real DOM events, packaged audio, PDF.js extraction/rendering, selection, native printing, portal recovery, and UI behavior against local fixtures. The theme harness compares computed colors with a reference engine and tests competing styles, scope, toggles, and print behavior. Generated screenshots and decoder outputs are ignored artifacts.

The optional installed-extension blacklist smoke test requires a browser policy that permits unpacked extensions. Use it only on an authorized development browser; do not bypass a managed policy that prohibits installation.

`tools/check.mjs` verifies synchronized package/manifest/lockfile versions, commands, asset presence, and first-party JS syntax. `tools/package.ps1` creates a source ZIP from an explicit allowlist, including synthetic fixtures and the dependency lockfile; private extracts, test outputs, attachments, and old distributions are excluded. `tools/build-assets.ps1 -PdfJsRoot PATH` copies a local PDF.js distribution and generates icons on a supported PowerShell/System.Drawing host. Bump the manifest, package, lockfile, and README release version together. Normal installation requires neither script. Test platform-specific maintenance scripts on their supported host before publishing their generated artifacts.

## Hotkey menu preferences

`shortcutMenuAlwaysOnTop` and `shortcutMenuNoTimeout` are non-sensitive local preferences. Worker writes serialize; always-on-top forces no timeout, and switching it off retains no timeout. New menu panel snapshots include both flags, and open menus respond to local storage changes. Ordinary menus close on new actions. Pinned menus remain open across hotkeys and repeated menu actions; Stop, Close, Escape, and private-state reset still dismiss them.

The floating menu uses Document Picture-in-Picture after the user clicks Keep on top. A document gesture is required by Chrome; an extension command opening a new popup does not supply one. Controls move into the PiP document with their original event listeners, while the owning extension window and worker-owned source snapshot remain alive. PiP Close dismisses the owner; disabling the preference restores the controls to the owner. No repeated focus stealing, native helper, extra host permissions, or install-policy changes are used. Chrome controls PiP placement and window chrome. Fixture tests exercise the real PiP API; managed policy still prevents installed-extension validation here.

A shortcut menu reports real PiP entry/exit through `shortcut-menu-pin-state`. The worker validates the menu ID and exact owning document URL, and keeps the transient pin flag on its panel entry. Enabling the preference alone does not mark an ordinary window as pinned. Search dispatch opts into preserving pinned menus during cleanup, while Stop and sensitive-state operations use full cleanup. The renderer registers entry before moving controls and reenables buttons after a successful pinned-menu action. Disabling pinning restores normal menu cancellation. The captured report source remains the one from when the launcher originally opened.

## Suspension and alcohol-offense alerts

License status remains driven by the report's DL status and Current credential. Within suspended results, Suspension End alone selects active periods (future date or INDEFINITE). REVO blocks follow the same rules using Revocation Beg / Revocation End and join the existing Active Suspensions or Pending Reinstatement columns and totals; matching SUSP/REVO reasons share groups. A completed end date with future/INDEFINITE Reinstatement Requirements Met selects Pending Reinstatement; one block cannot enter both buckets. End dates equal to today are completed, and reinstatement dates equal to today are satisfied. Missing or invalid end dates are reported as unreadable rather than guessed. DUI/DUAC reasons share a group within each bucket. SUSP, REVO and VIOL all delimit offense blocks, Current credential data, privileges and header identity, so fields cannot leak from a neighboring revocation.

DUI/DUAC lookback counts use a ten-calendar-year inclusive window and ignore future dates. Normalize ticket case but preserve digits and hyphens; never deduplicate missing tickets by date alone. When VIOL and SUSP/REVO share a ticket, prefer the VIOL Violation date over SUSP/REVO Causal dates. IID Required: Y is scoped to DUI/DUAC SUSP/REVO blocks and applies regardless of offense age or current license status. Render it as a display-only red warning and use 90 seconds even for success alerts. Headings still drive voice selection; warnings, columns, counts, and privilege qualifiers are not announcements.

Suspension columns retain ordered groups with occurrence records from their own SUSP/REVO blocks. Render one native details/summary disclosure per group and one mini-header/detail row per occurrence. Optional tickets preserve original display spelling; missing dates remain unavailable. Revocation occurrences carry revocation=true so the panel labels their own dates Revocation Begin / Revocation End, even within a group containing suspensions. DUI/DUAC group normalization must not erase the individual occurrence reason. Expanding or collapsing refreshes the alert deadline and tells the existing layout controller to restore original text sizes and allow scrolling for the rest of that popup. Initial fitting remains active until the first toggle; pending or later resize work must not reapply font compression. Do not create a second timer or duplicate window listeners. Treat occurrence data as private display text, exclude it from voice announcements, and keep actual records out of committed fixtures.

## Optional driver photo and name

The persisted showDriverIdentity preference defaults to false. capturePdf snapshots the preference into the authorized reader job; only an opted-in first-page reader extracts the name and image. Read the name from the header before License Information or offense blocks. Locate an unambiguous portrait-sized header image via PDF graphics transforms, render its rectangle locally from the same loaded document, and use a bounded inline PNG. Preserve cancellation and report/tab/document ownership; never refetch an old mutable attachment to recover a photo. Extraction failures leave text/status processing usable.

The standard no-photo graphic is identified by a central text-only perceptual signature with white-background and ink limits. The sampled region excludes edge identifiers. Detection was verified against two distinct placeholder records, resampling/compression variants, and a real-photo negative case; unknown artwork is not inferred to mean no photo. No report image or personal identifier is stored in the detection signature or committed fixtures. A match returns a noPhoto flag without the placeholder PNG.

Accept driverIdentity only from the job-bound reader and only when requested. Keep identity in the existing pdf:TAB_ID session snapshot and optional license alert payload; exclude it from persistent preferences, history, plate/blacklist popups, logs, and audio. Disabling the display preference gates future alert payloads; existing captured reports are not refetched. The Settings hint explains that photo extraction applies to newly captured records. Validate inline PNG type/size again before display and render names with textContent.
