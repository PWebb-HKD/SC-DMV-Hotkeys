# Maintaining SC DMV Hotkeys

This guide describes first-party source. Read it alongside the module/function comments, then run the existing regression tests before changing behavior. No build is required to load extension/ as an unpacked extension.

## Start here

| Change | Start in | Check |
| --- | --- | --- |
| Commands and preferred shortcuts | extension/core.js, manifest.json | shortcuts tests |
| Login or portal selectors | extension/automation.js, page.js | login tests; browser harness |
| Customer queue / Stop / history | extension/background.js | queue and history tests |
| PDF recognition and extraction | extension/core.js, results.js, reader.js | results and browser tests |
| License/tag status rules | extension/status-alerts.js | status-alerts and report-layouts tests |
| Barcode fields | extension/barcode-data.js | barcode unit and browser decoder tests |
| Recorded voices / TTS | extension/voice-recordings.js, audio-alerts.js, audio-player.js | audio-alerts and browser tests |
| Toolbar / settings / About | extension/popup.html, popup.js, style.css | browser harness |
| Prompt / alert / credential UI | extension/panel.html, panel.js | browser and queue tests |

## Execution contexts and boundaries

- **background.js:** Manifest V3 service worker. Owns command orchestration, browser APIs, pending panels/readers, storage. The toolbar and browser shortcuts converge on dispatch().
- **automation.js:** Portal transactions. Receives a context containing a SearchRun and worker callbacks. The table of transactions shares the same Page1 -> submit -> Page2 -> Download workflow.
- **page.js:** A single serialized function injected into the website MAIN world. It cannot close over extension imports or variables. Its DOM setters and bubbling events notify website frameworks. Credential and PDF origin checks deliberately live inside this function as well as in the caller.
- **popup/panel/barcode/shortcut-setup pages:** Extension-owned UI. Render report text with textContent, not HTML. Panels use unpredictable IDs to associate replies with worker jobs. Permission prompts request destination access from a user gesture.
- **reader.js:** A temporary inactive extension tab using bundled PDF.js. This reads PDF bytes rather than attempting to inspect Chromium's internal PDF viewer. Text-only extraction cannot recover image-only scans.
- **audio-player.js:** An offscreen document, because service workers have no Audio DOM. Only catalogued packaged recordings are accepted.

## A search from start to finish

1. dispatch() starts a SearchRun. beginRun() cancels the old search, pending extraction, audio, and panels; cleanup finishes before new UI opens.
2. Basic searches ask for a number. PDF commands select the focused report, or the newest tracked report, and use its captured text.
3. automation.js reuses a non-PDF portal tab. It focuses the login window, uses extension credentials, allows form synchronization, and submits. A completed same-origin redirect away from logon.aspx verifies login; the disclaimer needs no acknowledgment.
4. The search form is filled using native setters and bubbling events. Visible portal validation messages stop the workflow.
5. The results watcher is installed before Download is clicked. It accepts a new or navigated/reused PDF tab without waiting for the built-in viewer to report complete.
6. Result discovery commits queue position and history before focusing the result. PDF text capture runs separately so the next command remains responsive.
7. Enabled session alerts analyze the captured snapshot. Settings are rechecked after extraction to suppress late alerts following Stop, a new query, or disabling alerts.

SearchRun.step() races work against cancellation and checks again after it resolves. guardedApi() applies this to browser APIs. Cancellation cannot undo a request already submitted to the website; it prevents further actions, stale focus, and stale messages. Keep these checks around any new awaits, especially window creation and result callbacks. Event listeners and temporary readers must be released in finally blocks.

The worker's panels/readers/captures Maps are live jobs, not durable job storage. Session data survives a worker restart, but pending callbacks do not. There is no automatic resumption of a partially submitted transaction.

## Storage and messages

| Location | Keys / lifetime |
| --- | --- |
| local | vault (salt/IV/ciphertext) |
| session | history (last 20 successful searches), credentials (unlocked values), portalId, lastQuery, queue, status |
| session alert preferences | alertsEnabled, speechEnabled, suspendedClipEnabled, repeatSpeech; voiceSource/voiceGender/voiceName |
| session report bookkeeping | tabCreated, pdfCreated, pdfSources, pdf:TAB_ID with text and capture timestamp |
| session panels | panel:UUID, removed on submission/close/cancellation |

Local/session access is restricted to trusted extension contexts. The vault derives an AES-GCM key from a user passphrase using PBKDF2. Neither the passphrase nor its derived key is persisted. Clear credentials removes both the vault and session plaintext.

The worker validates extension sender identity/URL. UI requests receive {ok: true, value} or {ok: false, error}; returning true from the listener keeps its asynchronous response channel open. Reader replies additionally bind their job ID to the temporary reader tab. The offscreen player has its own target and playback reply contract.

The queue contains {values, index, sourceTabId}. Values are canonical unique customer numbers in report order. index is zero before any success and otherwise the one-based displayed position; it is also the zero-based next candidate. Previous targets index - 2. Only successful result discovery commits a cursor change, so retrying a failed search does not skip a customer. Clearing or stopping does not erase history unless explicitly requested.

## Report parsing invariants

The attachment URL is fixed while its contents change with the server session. Do not fetch an old tab's URL and assume its bytes still identify that tab's subject. Use captured text; when it is unavailable and a newer report exists, ask for the search to be rerun. Reused result tabs invalidate the older snapshot.

Owner extraction preserves line boundaries to avoid merging adjacent numeric columns. Other parsers flatten whitespace for label matching. These approaches serve different layouts and should not be merged indiscriminately. Fixture changes must use invented/deidentified data, never checked-in personal records.

Status rules use America/New_York calendar dates. An expiration today is valid; a dated suspension ending today is inactive under the configured rules. Suspended status takes precedence over credential type. Only Current credential data decides current license/ID validity; Prior rows never override it. Suspension reasons omit Ticket#: and following identifiers. Unreadable data yields a warning rather than a false valid status.

Barcode generation uses ASCII so directory offsets equal byte counts. Driver v09 and the observed SC registration v01 have different headers and fields. Preserve SC's RAG plate expiration and RBT decal expiration mapping, separate owner names (RBD/RBE), and state RBL. A blank driver license stays blank instead of using the customer number. ID class becomes I. T45V reports may append a space and a year that is not part of the plate. Ambiguous address splits fail; inferred splits are displayed for verification. Vendor encoder code and libraries remain unmodified.

## Audio and shortcuts

The special suspended clip overrides both normal sources and plays three times. Otherwise bundled recordings and Microsoft/local TTS are mutually exclusive. Missing or failed recordings fall back to a local voice of the selected gender. Normal playback is once, or twice with a one-second gap when enabled. A generation token cancels pending repeats; offscreen lifecycle operations are serialized without waiting for audio to finish.

Browser assignments come from commands.getAll(); preferred Alt combinations are documentation recommendations, not manifest suggested_key assignments. Keep the manifest unbound as requested: users manually assign keys and set Global in the install guide. Chrome does not expose shortcut scope through getAll(). Browser shortcut validity and scope are managed by Chromium.

## Tests and packaging

Run from this directory:

~~~powershell
node --test tests\*.test.js
node tools\check.mjs
node tests\browser.mjs
node tests\barcode-browser.mjs
~~~

Unit tests cover pure parsers, mocked worker workflows, cancellation races, audio policy, and crypto round trips. Browser tests use local fixtures with Chrome rather than live DMV queries; they exercise real DOM events, PDF.js, and packaged media. Barcode browser tests decode generated images and compare exact payloads. tests/runtime.mjs resolves installed dependencies first, then this development environment's bundled runtime. Other development machines must provide those dependencies locally (Playwright; Python zxing-cpp for barcode decoding).

Browser tests may require sandbox permission for localhost. No Windows helper is required.

Update package.json and extension/manifest.json together for every release. tools/check.mjs validates version agreement, commands, syntax, and required assets. tools/package.ps1 creates the delivery ZIP. Only top-level test sources are included; tests/tmp, output, private attachments, and nested old distributions are not source. Never ship report samples or generated personal-data extracts. DEVELOPMENT.md belongs in the package alongside README.md.

## Redundancy decisions in 1.4.3

Queue initialization is now shared by Collect and an empty Next. Audio selection, playback validation, and asset verification share voice-recordings.js. Small UI response wrappers and page-world checks remain local because they execute in different contexts or keep contracts explicit; merging them would add coupling without simplifying the workflows. Third-party code and generated assets are intentionally excluded from commenting/refactoring.

## Browser-only cleanup in 1.4.4

The Windows host, native protocol tests, retry alarms, nativeMessaging/alarms permissions, and focus-restoration messages have been removed. onInstalled clears legacy local bindings and session nativeStatus/nativeErrors without altering browser assignments or search history. Browser Global shortcuts are the only shortcut registration mechanism. Extension updates do not delete an old host installation from the operating system, but the worker never connects to it. Packaging reads current source directly so retired files from an old staging directory cannot reenter the ZIP.

## Scoped retention changes in 1.4.5

History reads, writes, replay lookup, and clearing all use storage.session. Worker boot removes legacy storage.local history without migrating it, while leaving existing session history intact across service-worker suspension/restart. The browser clears session storage on extension reload/update/disable and browser restart. Barcode views start a single 90-second timer after rendering and cancel it on close; scale changes do not extend the deadline. No other reviewed security recommendations were implemented.


## Shortcut gating and residence collection (1.5.0)

Keyboard commands pass through a serialized event queue before dispatch. The session shortcutsPaused flag gates only keyboard entry; the toggle, toolbar actions, and history remain available. A pause does not begin a new SearchRun or cancel current work. Chromium exposes getAll/onCommand but no runtime unregister/update API, so this flag does not release Global keys to other programs.

collectQueue is shared by Collect and empty Next. Only Collect opts into starting at index 1 for a report headed Customers at Same Residence with at least two unique customers. All values remain stored; index 1 treats the source customer as the initial position until the second lookup commits index 2. A failed second lookup leaves index 1 so Next retries it. Ordinary report collection and empty Next retain index 0 initialization.
