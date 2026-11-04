# SC DMV Hotkeys

A Manifest V3 extension for SCDMV member searches, PDF follow-ups, and SCUTTIES form entry. The interface uses `#181a1b` and `#0c3d70`, with a palmetto-and-crescent icon.

## Install the extension

1. Open your browser's extension manager: `chrome://extensions` in Chrome, `edge://extensions` in Edge, or its equivalent in your Chromium browser.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this project's **extension** folder (the folder containing `manifest.json`). Keep the folder in place after installation.
4. Pin the extension. Click its icon to open **Recent searches**, **Settings**, and **About**.
5. Open **Settings → Open browser keyboard shortcut settings**. Assign each search command and change its Scope from **In Chrome** to **Global**. The About tab lists the actual browser assignments and explains each command.

No build, npm installation, or external script download is required to run the packaged extension. PDF.js 5.6.205 is bundled locally, including its license and supporting assets.

## Blacklist (1.6.0)

Open **Settings → Blacklist**, immediately below Voice status alerts. Select **Create encrypted vault** to save your DMV login and a vault passphrase of at least 12 characters without running a DMV search. Existing credential vaults are supported. At the beginning of each browser session, unlock the vault in Settings or when prompted before the first search. A locked vault blocks searches even when the DMV session is still active.

The table shows each number and its category. To add an entry, choose **Plate number**, **DL number**, or **Customer number**, enter the number and vault passphrase, then select **Add to blacklist**. Plates accept up to eight letters/digits; DL numbers accept up to nine digits; customer numbers accept up to eight digits after leading-zero normalization. Matching ignores spaces and plate letter case; DL leading zeroes are retained. Add every known identifier for each protected person: the extension cannot infer that an unlisted number belongs to that person.

Use the trashcan beside an entry to remove it. Enter the vault passphrase and confirm that future searches for that number will no longer be blocked. Additions/removals are encrypted in the same vault as the login and survive browser restarts. Each change requires the passphrase again; neither the passphrase nor an encryption key is retained. Updating saved login details preserves the blacklist. A vault containing entries cannot be silently deleted through the old Forget credentials action.

Blacklisted numbers stop manual searches, history reruns, Collect/Next/Previous customer searches, and same-address lookups before the identifier is submitted to DMV. A large flashing red popup explains the suspension/revocation risk; it remains enabled even when optional status alerts are off. Flashing is disabled when the OS requests reduced motion. A blocked queued customer remains saved but its position is consumed so Next can continue. SCUTTIES checks identifiers from the driver report or saved history; older SCUTTIES history without identifiers must be rerun from the driver report when a blacklist is active. Barcode generation from an already-open report does not submit a DMV search.

## Keyboard shortcuts and compatibility

| Command | Preferred shortcut |
| --- | --- |
| License plate search | Alt+P |
| Driver's license search | Alt+L |
| Customer number search | Alt+O |
| Collect PDF customer/owner numbers | Alt+J |
| Search next queued customer | Alt+N |
| Search previous queued customer | Alt+M |
| Customers at same address | Alt+I |
| Driver through SCUTTIES | Alt+U |
| Generate PDF417 import barcode | Alt+B |

Set each command manually in your browser's extension keyboard shortcut settings and select **Global**. Preferred Alt shortcuts are recommendations; the extension does not assign them. The browser must remain running. If a combination conflicts, choose another. Global availability depends on the browser and operating system.

The extension uses desktop Chromium Manifest V3 APIs and targets Chromium 120 or newer. Chrome, Edge, Brave, Vivaldi, and Opera are intended targets; they have not all been tested live. In **About**, the extension displays actual browser assignments. **Settings** contains the shortcut editor link and setup guide. No separate Windows program or installer is needed.

## Search behavior

- Input panels close on Escape, empty Enter, or after 90 seconds. Space characters are removed. Plates allow 8 characters; DL numbers allow 9. Customer numbers must be numeric and allow 8 digits after leading zeroes are removed.
- The extension reuses a `https://www.scdmvonline.com/` tab and excludes `ViewAttachment.aspx` tabs. The selected portal tab is activated and its browser window restored/focused before navigation, including when an existing session skips login.
- After ten minutes without a successful query, it returns to login. Login always obtains credentials from extension session memory, the encrypted extension vault, or the extension login panel. It ignores browser-autofilled values and autofill indicators, overwrites both portal fields with the extension credentials, dispatches bubbling input/change events, and allows one second plus 100 ms for form synchronization. Immediately before clicking Login, it reasserts the extension values if another process changed them. After navigating to logon.aspx, a completed redirect to any other URL on the exact https://www.scdmvonline.com origin verifies success and immediately starts navigation to the requested search; visible login errors and password-update/extra-login pages are surfaced.
- Missing credentials can be entered for the current browser session, or saved in an encrypted vault. Saved credentials require a separate vault passphrase of at least 12 characters, unlocked once per browser session. The passphrase is not saved. After a password change, choose **Use a different login** in the saved-login panel and enter the updated credentials; select encrypted storage again to replace the saved vault.
- The disclaimer page has no special role in login verification. Any other HTTPS URL on the exact SCDMV origin is accepted after login; lookalike hosts and logon.aspx with a query string are not. The extension never clicks disclaimer acknowledgement controls.
- Login activates its tab and restores/focuses its browser window while entering extension credentials and submitting. Searches that skip login also activate the working tab and restore/focus its window before navigation. Input/credential/permission panels necessarily take focus. Closing a panel leaves focus behavior to the browser and operating system. Results detection observes tab creation and navigation before clicking Download, accepts a loading/pending attachment URL or supported built-in PDF viewer URL, and handles a reused named tab or same-tab PDF. It focuses the results without requiring the viewer to emit a complete status. Results and errors are brought forward. Websites, browser policies, and OS focus restrictions can affect window behavior.
- Starting any new command cancels the previous search immediately, including pending input/credential/permission panels, waits, and PDF extraction. Cancelled work cannot continue with later navigation, form submissions, focus changes, history/queue writes, or error popups. A request already submitted to the website cannot be recalled. PDF text is cached in the background after results; it never locks out another command. The queue advances after a successful result or a visible DMV search error. Cancelled searches and technical failures remain pending for retry. Exhausting a queue offers to start again. The queue is unique by normalized customer number and is cleared when the browser session ends.
- The toolbar popup records the last 20 successful DMV searches and submitted SCUTTIES searches. SCUTTIES has no supplied results/error selector, so its history entry means the search button was triggered and no shared validation-summary error was visible; inspect its response yourself.

## Session status alerts (1.1.0)

Enable **Plate & license status alerts** in the popup to analyze new plate and driver-record query results. The switch starts off each browser session and is stored only in session memory, not local or sync storage. Turning it off dismisses any current status alert. Residence-list and SCUTTIES results do not receive driver-record alerts.

- Plates: T45V TEMPORARY PLATE-VEHICLE uses Plate Exp Date; other plate classes use Decal Exp Date. Expired means earlier than today. Suspensions use Enforcement Description and Enforcement Statute. An expired and suspended plate produces a single combined popup. Expiration age is shown in calendar years/months/days with total days where useful.
- Suspended drivers: a suspension begins on or before today and has an indefinite end/requirements value or an end date strictly after today. Active reasons are grouped without their three-digit codes and sorted by descending count. The popup includes the active total and the number of Driving Under Suspension VIOL entries dated within the inclusive five-calendar-year window, excluding future dates. Those entries are labeled as prior DUS convictions according to the supplied rule; no other disposition field is evaluated.
- No-suspension driver records: an empty first Driver License No is NOT LICENSED. A Current ID class, ignoring single-letter parentheses, is NOT LICENSED ID ONLY. Other Current rows use the second date (Expires) as expiration, regardless of Function (Renewal, Modify, Duplicate, etc.) or whether Printed Date is present. An expiration of today or later is VALID LICENSE; an earlier date is LICENSE EXPIRED. A nonempty license number with no Current license entry is NO LONGER LICENSED IN SC. Prior sections do not override an existing Current entry.
- Date comparisons use South Carolina calendar dates (America/New_York), avoiding daylight-saving hour differences. Five years means five calendar years; a leap-day anniversary is clamped to February 28 when needed.
- Red status alerts close after 90 seconds. Green TAG VALID and VALID LICENSE alerts close after 10 seconds. Escape, Close, starting another search, or turning alerts off dismisses them. Long suspension lists scroll.
- Unreadable/missing required data produces an amber STATUS UNAVAILABLE alert, never an assumed green valid result. Incomplete suspension entries are reported alongside the known suspended status. PDF text extraction remains subject to the existing font/layout, encryption, session, and scan limitations.

These rules are implemented from the requested report sequences. Synthetic fixtures cover the branches and date boundaries; real plate/driver report variants still need validation in an authorized session.

## Recent searches

Click a searched number or SCUTTIES entry in Recent searches to run the same search again immediately, without an input prompt or a source PDF. The stored search type is preserved, including same-address searches. SCUTTIES reruns use the saved last name and DOB; older entries containing those values are supported. Reruns follow the normal login checks, cancel older work, and appear as a new history entry after submission succeeds.

The selected-customer (Alt+K) function has been removed. Reloading the extension removes the browser command.

## PDF extraction

The browser's built-in PDF viewer is a protected extension page. This extension does not try to inject scripts into that viewer. It fetches the attachment using your authenticated DMV session and extracts text with a local PDF.js worker. Ordinary PDF copy restrictions are not used as an extraction gate. Password-encrypted PDFs without a password, image-only scans, unusual fonts/text order, and server/session restrictions can prevent extraction. OCR is not included. An explicit error directs you to enter identifiers manually when extraction is unavailable.

Each newly opened attachment tab is tracked and its text cached in session memory immediately. Because the same attachment URL can return different reports over time, the extension will not silently re-fetch an uncached older report as if it were the original. Re-run that search if its text is unavailable, including for PDF tabs opened before extension installation. Keep the member tab open and avoid performing concurrent manual DMV queries during capture.

- **Alt+J** selects the active DMV PDF, otherwise the most recently created tracked DMV PDF. It rejects driver records, collects `Owner Number:` / `Customer Number:` labels in document order, normalizes and deduplicates numbers, then runs the first customer. For tabs predating tracking, tab ID is a best-effort ordering fallback, but a fresh search is required for extraction.
- **Alt+N** runs the next unique queued number; a visible DMV search error consumes that item so the next press proceeds past it. Cancellation and technical failures leave it pending. If no queue exists, it first reads customer/owner numbers from the open results report and starts with the first number. Progress is committed before the PDF tab receives focus, so an immediate next press advances correctly. Use Alt+J to replace an existing queue with numbers from another report.
- **Alt+I** requires the sequence `Driver License No: <up to 9 digits> Name:`.
- **Alt+U** requires a driver record with `Name: <last name>,` and `DOB: mm/dd/yyyy`. Multi-part surnames are preserved.

## SCUTTIES permissions and sign-in

The extension follows the supplied transaction-list link and waits up to three minutes for the supplied search inputs. The requirements do not name the final external SCUTTIES/SSO origin. On encountering a new origin, it requests permission for that specific site through an extension panel. Approve only the intended destination. Interactive login, MFA, and password updates remain in the browser; no credentials are injected into external SSO pages.

It uses native input value setters, then explicitly dispatches bubbling input/change/keyup/blur events on both SCUTTIES fields after both values are present. It allows the form to update and waits for Search to become enabled before clicking it. Synthetic events are not trusted hardware events. If the live application rejects them or changes its Angular/React form behavior, that integration will need adjustment after a real-session test.

## Local data and permissions

- Recent history: browser-session extension storage only, never synced. Encrypted saved login: local extension storage. Browser shortcut assignments are managed by the browser.
- Saved login: AES-256-GCM encryption, PBKDF2-SHA256 with a random salt and 310,000 iterations; unlocked credentials and blacklist entries stay in trusted session storage.
- PDF text and queued identifiers: session storage, accessible only to trusted extension contexts. Closing a PDF tab removes its cached text. The browser's session-storage quota limits the total cached text; large reports can fail with an error.
- Network traffic: the authenticated DMV attachment and normal site navigation. No analytics, telemetry, external AI service, or third-party backend.
- Site access: SCDMV by default. Other HTTP(S) origins are optional and requested only when needed for SCUTTIES navigation. The `tabs` permission exposes tab URLs/pending URLs so PDF viewer wrappers and attachments in other windows can be identified; it does not grant access to arbitrary page contents.

## Validation

No live searches, logins, registry installation, or password-manager changes were made while building this project. Browser fixture tests intercept all database requests and use fictional records.

With Node.js installed:

```powershell
node tools\check.mjs
node --test tests\*.test.js
```

The optional browser/worker tests use Playwright and pdf-lib. They can use Codex's bundled dependencies or locally installed packages of those names. Set `CHROME_PATH` if Chrome is not at its standard Windows location:

```powershell
node tests\browser.mjs
```

Browser tests cover all four DMV form flows, login timing/errors, inactive-tab behavior, SCUTTIES destination permission and framework events, popup UI, plate validation, and real PDF.js worker extraction. Screenshots are written to `test-results`.

To verify a local residence report without embedding its data in the test suite, optionally run `node tests\browser.mjs --sample-pdf "C:\path\to\report.pdf"`. This checks the twelve-customer sample used for the 1.0.2 regression. The report stays local and is not included in the distribution package.


Live validation still needs your authorized sessions, representative report layouts, and actual SCUTTIES redirects and status-report layouts. Start with one plate, DL, and customer search, verify the reports, then test the PDF commands and minimized-browser behavior. Do not assume site compatibility from fixture results alone.

## Updating from an earlier version

Replace the files in the existing unpacked extension folder and click **Reload** on its extension-manager card. Keeping that folder in place preserves the extension ID and saved settings. Recent history is session-only and clears when the extension reloads or updates. Version 1.4.4 uses browser-managed Global shortcuts exclusively. Existing browser assignments remain unchanged; users who relied on automatic Windows shortcuts must assign them in Settings. The extension no longer launches or reconnects to the retired companion. Old installed companion files/registry registrations are not deleted by an extension update; they are no longer used.


## Source layout

- `extension/`: installable extension, including bundled PDF.js and icon sizes.
- `tests/`: unit, queue, browser fixture, PDF worker, and vault checks.
- `tools/`: syntax/packaging checks and asset-generation script. The asset script accepts `-PdfJsRoot` for a different local PDF.js distribution; no asset rebuild is needed for installation.

## License & ownership

This extension is licensed on a perpetual basis. All rights to SC DMV Hotkeys belong to Preston Webb. All rights reserved. Third-party components retain their respective licenses, including the bundled PDF.js Apache-2.0 license.


## Audio status alerts (1.1.6)

Popup, spoken status, and suspended-clip alerts have independent session-only switches. All start off each browser session. Speech says only the status once by default. Enable Repeat spoken status in Settings to say it twice with a one-second pause after the first announcement ends. Combined suspended/expired tags announce both statuses. Suspension reasons, counts, identifiers, and personal information are never spoken.

Choose Female or Male for automatic selection of a recognized installed local voice (for example, Microsoft Zira or David). Chromium ignores its deprecated gender parameter, so selection uses the installed voice name. The Installed voice dropdown lets the user select another local voice explicitly. If no matching voice is installed, the status area explains how to select one; the independently enabled suspension clip still plays. Remote voices are excluded.

The optional supplied suspended MP3 plays three times sequentially for TAG SUSPENDED or LICENSE SUSPENDED, instead of synthesized speech when both audio options are enabled (including combined suspended/expired tag alerts). It does not play for expiration, unlicensed status, valid status, or unreadable results. Audio uses Chromium TTS and an AUDIO_PLAYBACK offscreen document. There are no external audio services.

Starting a new query, changing an audio setting, clicking Stop audio, or dismissing a visible status popup stops playback and queued repeats. Speech and clip alerts can also operate when popup alerts are off. Version 1.1.5 includes the earlier parser fixes for ticket numbers, optional suspension fields, varying license Functions, and missing Printed Date values. Keep manifest.json and package.json synchronized when incrementing future patch or feature releases; the asset check now verifies this.



## PDF417 record import (1.2.0)

Use **Alt+B** (or the **Barcode** quick action) with a DMV driver or vehicle record open. The focused DMV PDF is used first, otherwise the most recently created tracked report. A white popup displays the barcode with a 32-pixel outer margin plus the encoder's quiet zone. Small, Medium, and Large sizes use integer module scales; Esc or Close dismisses it. The popup automatically closes after 90 seconds, and changing scale does not restart that timer. A new search closes the popup. Barcode data remains in extension session storage and is removed when the popup closes; no barcode or personal data is sent to an external generator or written to history.

Driver records use the AAMVA v09 SC header found in the existing example record. Identity and address fields come from the first record heading. Class, issue date, expiration date, and document discriminator come from the first Current credential row, including Modify, Duplicate, Original, and missing Printed Date layouts. Prior entries never supply a current class. ID records use class **I** (as requested), with an ID subfile. Unavailable mandatory information is represented by **unavl**, not a guessed date or privilege. A missing or blank driver/ID number is encoded as an empty DAQ field; the customer number is not substituted. Invalid nonempty numbers still cause an explanatory error. A Current-row N restriction or endorsement flag becomes NONE; a Y flag does not disclose the actual code, so that field remains unavl. Credential-only inventory and other metadata are left blank when the report does not provide them. The barcode encodes selected standardized fields, not every report heading (e.g. county and driver training are not assigned invented element IDs).

Vehicle records now use the official SC version-01 single RG subfile decoded from the supplied screenshot (1.2.4). Owner family/given names use RBD/RBE, owner address/state use RBI/RBK/RBL/RBM, issue date uses RBB, plate expiration uses RAG, and SC decal expiration uses RBT (confirmed against the source report). RAM is padded to nine characters. VIN, make, model year, body style, and decal number use VAD/VAK/VAL/VAO/RBU, with model included as VAM when available. Missing decal serials remain blank. Title Issue Date is never substituted for registration Date of Issue. The owner address must be separable. This registration import is not a full IRP cab card.


The barcode is intended for data entry into Ethos Coplogic. Exact PDF417 round-trip decoding was verified for driver, ID, and vehicle fixtures at all three sizes, including control bytes, subfile lengths and offsets, and class mapping. Import into the actual Coplogic installation/scanner has not been verified. Compare imported fields with the source report on first use; software-specific parser differences may require a profile adjustment.

References: [AAMVA DL/ID structure](https://www.aamva.org/getmedia/81af105d-8b1b-45e1-aa46-f1800a259ed1/AAMVADLIDCardDesignStandard2025.pdf), [FMCSA PRISM registrant field mappings](https://www.fmcsa.dot.gov/sites/fmcsa.dot.gov/files/docs/PRISM_IRP_Cab_Card_and_Bar_Code_Specifications_v3_5_July_2014_508.pdf), [published RG/VH examples](https://www.nj.gov/treasury/purchase/noa/attachments/a1628-a-t.pdf). Encoding uses the locally bundled bwip-js 4.11.4 library with its license notices. No runtime network dependency is added.

To repeat the independent barcode browser/decoder check, install the test-only decoder with Python `-m pip install --target tests/tmp/python zxing-cpp==3.1.1`, then run `node tests/barcode-browser.mjs`. The decoder and test images are excluded from the release archive.

### Vehicle-address parsing patch (1.2.1)

Vehicle barcode imports now accept addresses without a comma between street and city, including the SCDMV layout `123 EXAMPLE DR ROCK HILL SC, 297321234`. When a single recognized street suffix or PO Box pattern separates the street and city, the popup displays the parsed address for verification. Apartment/unit suffixes stay with the street. Existing comma-delimited addresses continue to work, including an optional comma after the state. Ambiguous boundaries still stop generation instead of silently assigning part of a street to the city.

### Race/ethnicity encoding patch (1.2.2)

The version-09 DCL field now translates both full report labels and recognized abbreviations to D20 Driver Race And Ethnicity codes. Examples: WHITE/WHT/WHI/W -> W, BLACK/BLK/B/BK -> BK, ASIAN/ASN/ASI/AP -> AP, NATIVE AMERICAN/AI -> AI, HISPANIC/HISPAN/HISP/H -> H, UNKNOWN/UNK/U -> U. Encoded values are right-padded to the field's three-character width. An unrecognized label is omitted with a visible warning rather than passed through as an invalid code or inferred from other demographic fields.

Insurance company and policy fields are not added to the vehicle barcode. Although D20 defines insurance data concepts, that does not establish the barcode identifiers consumed by Ethos Coplogic. The visible insurance area in a scan preview alone does not identify an interoperable mapping. Coplogic's supported barcode field/subfile specification or a vendor-confirmed example is needed before encoding these values for automatic import.



### Official SC barcode alignment (1.2.4)

Both supplied official screenshots were decoded locally. The vehicle uses `AAMVA6360050101` with a single RG subfile, not the previous three-subfile RG/IR/VH encoding. Coplogic can therefore find owner name and state inside RG. The field identifiers/order in `tests/sc-barcode-layouts.json` are a de-identified record of the decoded layouts. With the same field values, the new vehicle payload matched the supplied payload byte-for-byte, adding only its missing final CR segment terminator so that the encoded directory length is correct.

The driver image uses ANSI version 09, which the extension already used. Driver field order and optional field slots now follow that sample. Current class (including ID to I), race translation, empty missing license numbers, and all available demographics/dates remain supported. Unknown credential-specific values (inventory number, actual restriction codes when only a Y flag is printed, limited-duration/hazmat/donor metadata) are not copied from the example or guessed. These blank/unavailable values mean that generating from a text report cannot reconstruct every value of an original credential barcode.

The official vehicle sample contains no insurance-company or policy-number fields. Confirmed insurance auto-import requires a Coplogic mapping. Verified registration field semantics are also documented in [Scanbot's AAMVA RegistrationData reference](https://api-docs.scanbot.io/android/api/io/scanbot/barcodescanner/entity/AAMVA.RegistrationData.html). SC's observed RBT value is the full decal-expiration date, rather than treating it as a generic four-digit registration year.


### First-install shortcut setup (1.2.5)

A focused shortcut-setup popup opens only for a fresh installation. It links to the browser keyboard shortcut editor in a normal browser window, explains assigning all nine commands and setting Scope to Global, and lists all nine preferred shortcuts beside their actual browser assignments. Refresh assignments rereads the browser values; the Commands API does not report Scope, so that setting must be checked in the browser UI. Done, Esc, or the window close button dismisses the guide. Existing users can reopen it with Settings > Open shortcut setup guide. Updates do not reopen the guide; browser customizations remain managed by the browser. An unavailable/conflicting suggestion can remain unassigned, and Global scope availability depends on the browser/OS.


### Manual browser bindings restored (1.2.6)

Removed all suggested_key entries and restored global: true on all nine named commands. The first-install guide and its Settings link remain, with instructions to assign every command manually and ensure its Scope is Global. The preferred Alt combinations are displayed as recommendations, not reported as assigned keys. Existing browser assignments may remain after an update; users manage them on the browser shortcut page.


## Previous customer, Stop, and Settings (1.3.0)

Alt+M is the preferred shortcut for Previous Customer Number. It looks up the previous entry relative to the last successfully displayed queued customer. It does not create a new queue or wrap before its first entry; a message explains when there is no previous item. Lookup failures preserve the position. After going back, Alt+N moves forward again. The queue caption now reports its position rather than a total-ever-run count. Browser shortcuts remain manually assigned with global declarations, and the setup guide includes all nine commands.

Stop current function is directly below the popup status box on every tab. It immediately cancels the active extension workflow, pending panels, PDF extraction and audio; queued customer numbers and search history remain. A new command can start immediately. A request already submitted to the DMV server cannot be recalled, but stopped work cannot perform later extension actions or report stale errors.

Recent searches remains the default tab. Settings now contains plate/license popup alerts, voice selection and spoken alerts, the suspended audio clip, and shortcut setup instructions and links. About retains the current keyboard assignments, command descriptions and licensing information. Spoken alerts play once by default; Repeat spoken status enables a second announcement after one second. This repeat preference is session-only and off by default. The special suspended clip still replaces speech for suspended results and plays exactly three times.

Assign Alt+M to Previous Customer Number in the browser shortcut settings and set its Scope to Global.

## Bundled voice announcements (1.4.0)

Settings > Voice status alerts now offers one Announcement source selector: **Bundled voice recordings** is the first/default choice, and **Microsoft text to speech** is the alternative. Only one source is selected at a time. The supplied archive contributes 18 MP3 files (nine statuses for each gender); WAV files are not extracted or included. Alerts remain off by default each session.

Choose Female or Male for the recordings. Matching recordings play once, or twice with a one-second pause when Repeat voice announcement is enabled. The combined expired-and-suspended tag status uses its single combined recording. No additional suspension reasons, customer values or other personal details are spoken.

When a status has no recording (including Status Unavailable), the whole announcement falls back to Microsoft/system TTS with the selected recording gender. An opposite-gender Microsoft voice override is ignored for this fallback. If no matching local voice is installed, the status area reports that fact rather than silently substituting the other gender. Failed media playback also closes its player before same-gender TTS fallback. Microsoft mode bypasses matching recordings completely. The installed-voice override is enabled only in Microsoft mode.

Repeat voice announcement applies to recorded announcements, Microsoft announcements, and missing-file fallbacks. The older special suspended audio clip is independent: when enabled, it replaces either normal source for suspended statuses and still plays three times. Stop current function, Stop audio, new searches, and audio-setting changes cancel pending playback and repeats as before. Audio files remain local extension assets; nothing is sent to an external voice service.

### Valid-tag recordings (1.4.1)

Added Male_Valid_Tag.mp3 and Female_Valid_Tag.mp3, bringing the bundled library to 20 MP3 recordings. TAG VALID now plays the selected gender's recording in bundled mode and honors the once/twice preference. Microsoft mode still uses TTS. WAV files are excluded. Status Unavailable and other unmapped statuses retain same-gender TTS fallback.


### Temporary tag display-year fix (1.4.2)

For T45V temporary-plate reports, a final space-separated four-digit year is removed from Plate Number before validating or encoding RAM and before displaying the barcode summary. The tag itself is preserved, including digits that are part of its number. Plates without that display suffix and other plate classes are unchanged. The supplied temporary record was verified to generate a barcode containing its eight-character tag without the appended year.


### Maintainability review (1.4.3)

Added module and workflow comments plus [the maintenance guide](DEVELOPMENT.md), covering execution contexts, cancellation, storage, report parsing, audio, tests, and packaging. Queue initialization and recording validation now share their existing sources of truth. Website behavior and shortcut assignments are unchanged.

### Browser-managed shortcuts only (1.4.4)

Removed the Windows companion, its installer/protocol harness, native-messaging connection and focus-return messages, and retry alarms. The nativeMessaging and alarms permissions are no longer requested. Update migration clears only retired companion preferences. Searches, report tools, alerts, existing browser shortcut assignments, and history are retained. Configure each shortcut in Settings and select Global.

### Session history and barcode timeout (1.4.5)

Recent searches and click-to-rerun now use session storage, retaining up to 20 searches while the extension remains loaded. History clears on browser restart or extension reload/update/disable. Old persistent history is deleted, not migrated. Barcode windows close automatically 90 seconds after rendering; changing scale does not restart the timeout. Esc, Close, and new-search dismissal still work. Other credential, security, audio, and alert behavior is unchanged.


### Residence queue (1.5.1)

Collect (Alt+J) on a report headed Customers at Same Residence keeps all unique customer numbers in report order, including the first, and automatically searches the second. Next (Alt+N) then advances to the third; Previous (Alt+M) can return through the second to the first. Visible DMV search errors count as completed attempts; cancellation and technical failures leave the customer pending. Other report types, and Next with an empty queue, still begin at the first customer. A residence report with only one unique customer also starts with that customer.

Pause/resume shortcut actions and the Alt+Minus command were removed in 1.5.1. All nine existing shortcuts remain active.


### Stale-session recovery (1.5.2)

When a search reuses the ten-minute login window, the extension checks the first requested search page after it loads. If it unexpectedly lands on TransactionList.aspx, it clicks Log Off, invalidates the cached session time, signs in with the extension credentials, and retries the original search once. No recovery check runs while filling or submitting a transaction or reading its results, and normal fresh logins are unaffected. A repeat redirect reports an error rather than logging off repeatedly. SCUTTIES deliberately opens the transaction menu and does not trigger this URL-mismatch recovery.

If that first requested search page instead lands on an unrecognized URL, the extension navigates directly to its fixed login page, signs in, and retries the original request once. It does not attempt to use page controls or credentials on the unexpected page. A second unexpected page reports an error rather than repeating recovery. This fallback also covers unexpected first pages after a fresh login; the known login-page and transaction-menu cases keep their existing handling.


### Queued DMV errors (1.5.3)

A visible DMV error on the requested customer search page consumes that queued attempt for Collect, Next, and Previous. The error alert is still shown; the next shortcut moves relative to the attempted customer instead of getting stuck on it. Failed DMV attempts appear in Recent searches with a DMV error label and their error message, and can be clicked to retry. Cancellation, login failures, connection problems, and other technical failures leave the queue position unchanged.
