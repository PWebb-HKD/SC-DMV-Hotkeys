# SC DMV Hotkeys

A Chromium Manifest V3 extension for authorized SCDMV member searches, PDF follow-ups, status alerts, and PDF417 data-entry barcodes. Current version: **1.8.12**.

## Install and update

1. Extract the source package to a permanent folder.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the `extension` folder, then pin the toolbar action if desired.
4. Open **Settings → Shortcut setup**. For simple setup, assign only **Open Shortcut Menu** to **Alt+H** and leave the other commands unassigned. Optionally assign individual functions to recommended keys or keys of your choice. Set their scope to **Global** if they must work outside the active browser window.

The packaged extension needs no build or npm installation. PDF.js and the barcode encoder run locally. For updates, replace files in the same folder and click **Reload** on the extension card. Keeping the folder preserves the extension ID and persistent settings. Run a fresh search after reloading; history, unlocked credentials, queue state, and captured reports belong to the current browser session.

## Commands

| Function | Preferred shortcut | Behavior |
| --- | --- | --- |
| Open shortcut menu | Alt+H | Open a compact menu of search and report action buttons at the right edge of the screen. |
| Plate search | Alt+P | Ask for a plate number and open its vehicle record. |
| DL search | Alt+L | Ask for a driver license number. |
| Customer search | Alt+O | Ask for a customer number. |
| Collect customer/owner numbers | Alt+J | Collect unique numbered parties from a vehicle or residence PDF. |
| Next queued customer | Alt+N | Search the next entry; collect numbers first if the queue is empty. |
| Previous queued customer | Alt+M | Return to the previous entry without wrapping. |
| Customers at same residence | Alt+I | Read the DL number from a driving-record PDF and search the residence. |
| SCUTTIES search | Alt+U | Read the driver's surname and date of birth from the PDF. |
| Generate PDF417 | Alt+B | Create an import barcode from the selected driver or vehicle report. |

The shortcut menu has one vertical column of action buttons and sizes itself to their labels and the available screen height. It retains the tab that was focused when opened for report follow-ups. Opening the menu leaves the current function running; selecting an action starts that function and closes the menu. Escape or its 90-second timeout dismisses it.

These are recommendations, not automatic assignments. Chromium owns key validity, conflicts, assignments, and Global scope. The setup guide shows actual assignments; the extension cannot read their scope. Toolbar buttons run the same workflows. **Stop current function** cancels pending automation, prompts, extraction, and announcements; it cannot recall a request already submitted to the DMV. The extension uses no native desktop companion.

Plate and customer inputs allow up to eight characters; DL inputs allow nine. Spaces are ignored. DL and customer searches remove leading zeroes before checking these limits; both are numeric. Customer searches also accept a leading C0 prefix and remove it before validation. Blacklist entry controls additionally require numeric customer/DL values and alphanumeric plates.

## Login and recovery

The extension reuses a DMV HTML tab, excludes PDF result tabs, and focuses its browser window before automation. Login uses credentials entered into the extension or unlocked from its encrypted vault. It ignores browser-autofilled portal values and reasserts the extension credentials immediately before submission.

A successful query permits a ten-minute login bypass. If the first requested form redirects to an empty transaction menu, the extension logs off and signs in again. An unexpected first page goes directly through login. Recovery retries the initial navigation once, before entering a search number. Dedicated server error pages are not accepted as successful login redirects.

Visible validation and server errors stop submitted searches and display the portal message. They appear in recent history as failed attempts; queued customer attempts advance so the next number remains usable. Server errors clear the ten-minute hint so the next requested search signs in again. A submitted transaction is not automatically repeated. PDF-download waits also detect related server-error tabs.

SCUTTIES is opened by clicking its transaction-page link so the DMV can establish the login sequence. Automation stays on `https://www.scdmvonline.com/`, covered by the existing required site permission. No broad optional HTTP/HTTPS access or additional site-permission prompt is used. A destination outside that origin stops automation before its form is read or filled. SCUTTIES history records a submitted search with no visible shared validation error; review its response in the browser.

## Customer queue and recent history

PDF commands use the focused report, or the newest tracked report when none is focused. Collection retains unique Owner Number, Customer Number, and Registrant/Lessee Number values in document order. A genuine driving record is not a queue source. Residence report titles take precedence over repeated driver-number page headers.

Alt+J on a **Customers at Same Residence** PDF retains every number, including the first, and starts with the second when at least two exist. Other collection starts with the first entry. Alt+N with an empty queue also starts with the first. Previous can return to the retained first residence entry. At the end, Next offers to restart.

Successful results, visible DMV search failures, and blocked blacklist attempts consume their queued position. Login failures, cancellation, and technical failures preserve the pending position. Blacklist blocks do not produce a completed-search history entry. The last twenty search attempts are retained in session history; clicking one reruns that entry without moving the queue.

## Encrypted vault and blacklist

Open the **Blacklist** tab to create an encrypted vault without running a search. Save the DMV login with a vault passphrase of at least twelve characters. At the beginning of a browser session, unlock the vault in the Blacklist tab or the login prompt. A saved, locked vault prevents searches until its blacklist can be checked.

Add plate, DL, or customer numbers below the entry table. Unlocking once permits repeated additions and removals for the session. Entries are encrypted alongside the saved login; they survive browser restarts. Searches are checked before navigation and again immediately before submission. A match displays a mandatory red warning independently of optional alerts. SCUTTIES follow-ups also check the originating report's identifiers.

The trashcan beside an entry requires confirmation before removal. **Use different credentials** replaces the saved login while retaining its blacklist and passphrase. **Clear saved user info/vaults** requires confirmation, deletes the saved login and blacklist, and clears private session state. Blacklisted numbers must be re-entered after a reset before that protection can block them again. Appearance and alert preferences remain saved.

The blacklist compares explicitly saved identifiers; it does not discover family relationships or infer other identifiers belonging to the same person.

## Status and voice alerts

Popup, spoken status, the suspended-status clip, repeat choice, voice source, gender, and selected local voice are saved between sessions. Alert switches remain off until enabled. Restoring preferences does not replay an earlier search or announcement. Turning popup alerts off dismisses optional status windows; mandatory blacklist warnings remain independent.

Plate rules use Plate Exp Date for temporary classes T45V, E45V, and E60V, and Decal Exp Date for other classes. A date earlier than the current South Carolina day is expired. Enforcement descriptions/statutes produce suspended status, including a combined expired-and-suspended result. Plate popups also show make, model, year, and body style when readable.

Driver rules prioritize suspended status. Active suspensions begin on or before today and have an indefinite end/requirements value or an end date after today. Reasons are grouped and counted. DUS violation entries in the inclusive preceding five calendar years are counted as prior DUS convictions. Otherwise, the first license number and Current credential determine valid, expired, ID-only, unlicensed, or no-longer-licensed status. Prior credential sections do not replace Current values. Unreadable required information produces **STATUS UNAVAILABLE**, never an assumed valid result.

Dates use South Carolina calendar days. Green alerts close after ten seconds; other status alerts after ninety seconds. Escape, Close, Stop, and a new search dismiss the current alert.

Additional voice settings appear only while **Voice status alerts** is enabled. Turning alerts off hides these controls without clearing their saved selections. Bundled recordings are the default voice source. A missing recording falls back to a matching-gender local voice. Microsoft text to speech is an alternative source with an optional installed-voice override. Remote voices are excluded. Announcements speak status headings without identifiers or suspension details, once by default or twice with a one-second pause when repetition is enabled. The optional suspended-status clip replaces speech for suspended results and plays exactly three times.

## Native dark modes and PDF follow-ups

**Settings → Dark Mode → Darkmode for the DMV website** is enabled by default and saved between sessions. Screen-only styling covers the DMV's forms, tables, menus, transaction controls, and footer. It preserves page layout and control visibility. Images retain their colors; header/footer emblems are lightened for contrast. Turning the theme off restores site styling.

The theme uses layered important user-origin CSS and a coexistence marker to take priority over ordinary page styles and compatible theme extensions. It neutralizes inversion and blending filters. Other equally privileged user styles or extensions that replace page content can still conflict. Reload DMV tabs after disabling the native theme if another theme engine needs to reapply.

**Toggle dark mode on or off for pdf results pages.** is the independent, opt-in PDF switch in the same Dark Mode group. It redirects new top-level attachment results to a local viewer in the same tab. Pages scroll continuously and render near the viewport. Neutral paper and ink are recolored outside embedded image regions so license photos retain their pixels. Unsupported image operations keep a page in original colors. Text selection remains available across pages even when distant canvases are released.

The viewer's Print button and Ctrl+P/Cmd+P open the exact loaded PDF in Chromium's native renderer for printing. Printing uses an immutable local copy, not a new request to the session-dependent attachment URL.

Captured text is tied to its report and tab. The attachment URL can return a different report later, so the extension refuses to borrow a newer report's data for an old tab. Re-run a search when its capture is unavailable. PDF extraction supports embedded text, not OCR of scanned pages. Limits are 24 MB, 300 pages, and one million extracted characters.

## PDF417 import barcodes

Alt+B maps a driver or vehicle report to a local PDF417 image. Parsed fields appear below the barcode with readable labels and remain read-only until **Edit Data** is clicked. Valid corrections update the barcode immediately; invalid input hides the barcode and marks the fields that need attention. Recognized reports with parsing errors can also be reviewed and corrected. Edits apply only to the open popup, without modifying the report or saved data. The popup closes after ninety seconds; changing a data field restarts that countdown, while changing barcode size does not. Verify imported fields against the report after scanning.

Driver/ID mapping uses the version-09 profile. It separates name suffixes, preserves a blank driver license number rather than substituting a customer number, and leaves unavailable credential-only metadata blank or marked `unavl`. SCUTTIES uses the surname without a generational suffix.

Vehicle mapping uses the SC registration v01 single RG subfile. Plate expiration is RAG, decal expiration is RBT, and owner names/address use RBD/RBE and RBI/RBK/RBL/RBM. Temporary plates use Plate Exp Date when their decal date is blank; appended display years are excluded from the tag. Mailing Address and party Relationship labels delimit fields rather than becoming part of a name or owner address. Field lengths are enforced without silently truncating data.

Only the first numbered owner/customer/registrant is used initially. Missing data is not borrowed from a later party. If that party is incomplete, the user may explicitly choose a later listed party when one exists, review and correct that party’s parsed data, or generate with incomplete fields blank. Ambiguous address boundaries require that decision; inferred boundaries are displayed for verification.

Names without commas currently use the business-name field; comma-delimited names use person-name fields. That heuristic is not reliable entity classification. Business-owner and insurance auto-import behavior in Coplogic requires an independently verified consumer mapping; registration identifiers do not establish whether an owner is a person or a business. Field-format references: [registration](https://api-docs.scanbot.io/android/api/io/scanbot/barcodescanner/entity/AAMVA.RegistrationData.html) and [AAMVA](https://www.aamva.org/).

## Local data and permissions

Persistent local storage contains the encrypted vault and non-sensitive appearance/alert preferences. Trusted session storage contains unlocked credentials and blacklist, derived encryption material, history, queue, report snapshots, and pending-panel data. Passphrases are not retained. Session data is cleared by browser restart or extension reload/update/disable; a service-worker suspension alone is not a session reset. Legacy persistent history is deleted rather than imported.

The vault uses PBKDF2-SHA-256 and AES-GCM, with a random salt and a fresh IV for every write. Unlocking keeps the derived key only in trusted session storage. Local and session storage access is restricted to extension contexts. Website theme scripts receive only an enabled flag, not private state.

Permissions support storage, DMV tab automation, scripting, navigation tracking, optional PDF redirection, and local audio. Host access is limited to `https://www.scdmvonline.com/*`; the manifest declares no optional host permissions. There is no external audio service or native helper.

## Development and validation

See [DEVELOPMENT.md](DEVELOPMENT.md) for module responsibilities, workflow/storage contracts, and review decisions. First-party files live in `extension/`, maintenance scripts in `tools/`, and synthetic regression cases in `tests/`. Third-party libraries and their licenses remain in `extension/vendor/`.

Run `npm run check` and `npm test` from the repository root. Browser tests require Playwright and a Chromium executable; set `CHROME_PATH` when it is not at the default Windows installation path. The test-only reference-theme dependency is installed with `npm ci --ignore-scripts` and is not bundled with the extension.

```sh
CHROME_PATH=/usr/bin/chromium node tests/browser.mjs
CHROME_PATH=/usr/bin/chromium npm run test:dmv-theme
CHROME_PATH=/usr/bin/chromium PYTHON=python3 node tests/barcode-browser.mjs
```

The barcode decoder test also requires Python `zxing-cpp` and Pillow. Optional local extraction checks accept `--residence-pdf /path/to/report.pdf`, `--customer-pdf /path/to/report.pdf`, and `--barcode-pdf /path/to/report.pdf` on `tests/browser.mjs`. They do not print identifiers. Generated outputs go to ignored test directories; never commit private reports, credentials, or extracted personal data.

## License and ownership

This extension is licensed on a perpetual basis. All rights to SC DMV Hotkeys belong to Preston Webb. All rights reserved. Third-party components retain their respective licenses, including the bundled PDF.js Apache-2.0 license.
