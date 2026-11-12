# Maintaining SC DMV Hotkeys

This guide covers first-party code. Start with the module overview, read each function's contract and cancellation/ownership comments, then run the relevant tests. The extension loads directly from `extension/`; development dependencies are not runtime requirements.

## Module responsibilities

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

## Execution contexts and trust boundaries

The manifest requires Chrome 140 or newer because worker startup restricts both local and session storage to `TRUSTED_CONTEXTS`. `StorageArea.setAccessLevel` existed for session storage earlier, but support for local storage starts in Chrome 140 ([compatibility reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/setAccessLevel#browser_compatibility)). Keep the minimum aligned with this requirement; skipping the local-storage restriction would change the storage access policy.

The Manifest V3 worker owns browser APIs and private state. Popup, prompt, barcode, and setup pages are trusted extension contexts. Render report and error strings with `textContent`; no report text should be interpolated into HTML. Interactive panels use unpredictable job IDs, and the worker normalizes replies before acting.

`pageOperation` is serialized into the website's MAIN world. Its helpers and origin literals must stay inside that function; imported extension bindings are unavailable after serialization. Native input setters and bubbling events synchronize portal frameworks. Credential injection is restricted to the DMV login URL, and PDF requests are restricted to same-origin attachment URLs. These checks deliberately repeat checks made by the worker because serialization crosses a context boundary.

The theme-init message is the only website-content-script path into the worker. It returns `{enabled}` and inserts USER-origin CSS into the exact authorized sender document. All other message requests require an extension-owned sender URL and extension ID. Theme code must never read credentials, form values, or hidden portal state. External theme-coexistence metadata and the test reference-engine API use fixed protocol identifiers; their literal names are compatibility requirements, not explanatory documentation.

The reader's job ID is bound to its tab and, for same-tab viewers, committed document ID. Offscreen audio accepts extension messages and only catalogued packaged assets. SCUTTIES enters through the transaction-page link and automates only the declared DMV HTTPS origin. No optional host permissions or permission-request UI are present. A different origin is rejected before DOM inspection or input filling.

## Search lifecycle and failure handling

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

The `help` command opens a singleton shortcut menu without calling `beginRun`. Its separate `SearchRun` lets Stop or a selected command cancel even a late window creation. The menu captures the active tab before taking focus; `shortcut-menu-run` resolves that stored source ID and then dispatches through the normal command entry point. It never accepts an arbitrary source supplied by its page. Reopening focuses the existing menu without replacing its source. Closing it does not cancel an already running search. `shortcut-menu-layout.js` sizes content plus window decoration and aligns the accepted outer size to the current display's usable right edge, including displays with negative coordinates. Menu controls retain 44-pixel minimum touch targets and 8-pixel action gaps. Compact mode reduces surrounding padding; smaller work areas scroll only the actions and error feedback, preserving the header Close button and footer countdown.

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

Dates are strict South Carolina calendar days. Month/year shifts clamp month ends. Temporary classes T45V/E45V/E60V use Plate Exp Date; a blank decal date inherits it only for temporary barcode mapping. Current credential fields take precedence over Prior entries. Unreadable required status data yields an explicit unavailable result.

Barcodes use ASCII so directory offsets equal byte counts. Driver v09 and SC registration v01 have different framing and field vocabularies. Keep SC's RAG plate-expiration/RBT decal-expiration mapping. A missing DL number stays blank; metadata absent from the report is not guessed. Registration initially binds name/address to the first numbered party. Mailing Address and Relationship labels are boundaries, not parts of identity fields. Incomplete data requires explicit user choice before selecting another party or emitting blank fields. Name punctuation remains a limited business/person heuristic, not reliable entity classification. Preserve field limits without silent truncation.

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

`shortcutMenuAlwaysOnTop` and `shortcutMenuNoTimeout` are non-sensitive local preferences. Worker writes serialize; always-on-top forces no timeout, and switching it off retains no timeout. New menu panel snapshots include both flags, and open menus respond to local storage changes. Normal action, Stop, Close, and Escape cancellation still apply.

The floating menu uses Document Picture-in-Picture after the user clicks Keep on top. A document gesture is required by Chrome; an extension command opening a new popup does not supply one. Controls move into the PiP document with their original event listeners, while the owning extension window and worker-owned source snapshot remain alive. PiP Close dismisses the owner; disabling the preference restores the controls to the owner. No repeated focus stealing, native helper, extra host permissions, or install-policy changes are used. Chrome controls PiP placement and window chrome. Fixture tests exercise the real PiP API; managed policy still prevents installed-extension validation here.
