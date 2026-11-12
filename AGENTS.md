# SC DMV Hotkeys — Development Context

## How to Use and Maintain This File

Treat this file as development context and recorded project preferences. Historical requests, handoffs, and checklists below are records, not authorization to perform new merges, pushes, branch deletions, or feature work. Follow the current user's request and verify current repository state before acting.

Keep this file in the repository root and update it as extension development continues. Record meaningful behavior changes, decisions, release history, verified checks, and unresolved issues. Clearly distinguish current facts from historical observations and hypotheses. Reconcile stale entries when their outcomes are verified, and never include credentials, private reports, or customer data. Documentation-only context updates do not require a release-version bump.

## v1.8.16 Patch Test Branch — 2026-11-12

- Branch: fix/v1.8.16-shortcut-menu-settings, created from main after the v1.8.15 merge. This is patch development, not a merge to main.
- Settings → Hotkey Menu now has Always on top and Do not time out toggles. Preferences persist in local storage. Always-on-top automatically enables no timeout and prevents switching it off until always-on-top is disabled. Disabling always-on-top leaves no timeout enabled.
- Always-on-top uses Document Picture-in-Picture. Chrome requires a document user gesture, so the user opens the menu and selects Keep on top. An extension hotkey opening a new window does not supply this gesture. Do not claim that ordinary chrome.windows.create/update can set alwaysOnTop.
- PiP retains the owning extension window and captured source tab. Closing PiP dismisses the menu; disabling the preference moves controls back to the ordinary menu. Menu actions, Stop, Close, and Escape retain their normal behavior. Chrome controls PiP placement and window controls.
- The user explicitly accepted closing and reopening the floating menu instead of minimizing it. No native helper or OS utility is required.
- Non-floating menus retain the default 90-second timeout unless no timeout is enabled. Preferences apply to open menus; turning no timeout off starts a fresh 90 seconds. PiP unavailability or denial leaves the ordinary menu usable.
- Verified repository checks, 232 unit tests, and all 66 browser/fixture checks. Real Chromium PiP fixture checks cover action dispatch, closing PiP, restoring normal controls, and unavailable/denied fallback. Installed-extension validation remains blocked by managed browser policy; do not bypass it.

## v1.8.15 Merge — 2026-11-12

- The user explicitly authorized merging v1.8.15 into main and deleting both v1.8.15 and v1.8.14 test branches after main is pushed.
- Merged fix/v1.8.15-trace-address (5e9e105) into main without conflicts in merge commit 7aad04b. Its ancestry includes fix/v1.8.14-browser-requirements (2a97ee5), so main now contains both fixes and declares version 1.8.15 with minimum Chrome 140.
- Verified on merged main: npm run check; all 230 unit tests; all 39 exact PDF417 decodes across 13 fixtures and 3 sizes, including TRACE/TRCE; barcode UI checks. The full general browser and theme suites were not rerun for this merge.
- This resolves the historical pending-merge handoff below. Branch cleanup must follow successful main push; verify actual remote refs before any future cleanup.

## Context Review — 2026-11-12

- The current request is to review and commit this context file to main and maintain it during future development.
- Remote refs checked during this review: main is c7e532076cd7a9715ea780713a966f9adca32df5 (v1.8.13); the browser-requirements branch is 2a97ee5736cc610a366e01c6f6e11511ea52312c; the TRACE-address branch is 5e9e1059f2e3043b9a757df341a318c56c070c94. Neither test branch was merged or deleted as part of adding this file.
- Cloud onboarding validated v1.8.13: repository checks, 228 unit tests, 61 browser/fixture checks, 10 DMV theme browser checks, and 36 exact barcode decodes plus barcode UI checks passed. These results do not validate the unmerged v1.8.14/v1.8.15 branches.
- For barcode browser tests in this prepared cloud environment, use PYTHON=/workspace/.venvs/scdmv/bin/python with CHROME_PATH=/usr/bin/chromium. Managed Chromium policy blocks the optional installed-extension smoke test; do not bypass it.

## Project

- Repository: https://github.com/PWebb-HKD/SC-DMV-Hotkeys
- Typical cloud checkout: /workspace/SC-DMV-Hotkeys
- Chromium Manifest V3 extension for automating searches on the South Carolina DMV member portal.
- Supports driver, plate, customer, residence, SCUTTIES, report parsing, barcode generation, status alerts, encrypted credentials, and blacklist protection.
- The extension is loaded from unpacked files. End users do not need an npm build.

This document combines development history and previously verified implementation details. Inspect the repository before assuming file names, branches, or behavior remain unchanged.

## Historical Handoff: Requested Merge

The user requested:
1. Merge the v1.8.15 test branch into main.
2. Delete both the v1.8.15 and v1.8.14 test branches after main is successfully pushed.

Last verified refs:
- main: c7e5320 — version 1.8.13
- fix/v1.8.14-browser-requirements: 2a97ee5 — version 1.8.14
- fix/v1.8.15-trace-address: 5e9e105 — version 1.8.15

The v1.8.15 branch was created from v1.8.14 and includes its changes.

The merge and branch deletion did not run in the previous chat because the cloud workspace was unavailable. Another chat may have since changed the repository. Fetch and inspect actual remote refs before acting.

The final worktree previously verified was clean, on the v1.8.15 branch, with its changes pushed.

Do not claim that a merge, push, branch deletion, or verification succeeded without checking its actual result.

## Working Preferences

- Use Semantic Versioning: Major.Minor.Patch.
- The user explicitly considers recent usability fixes and shortcut-menu work to be patches.
- Update release versions together in:
  - extension/manifest.json
  - package.json
  - package-lock.json, including its root package entry
  - README version references
- Version 1.4.6 was intentionally skipped because its proposed changes were deprecated.
- Create test branches for development.
- When fixes depend on an existing unmerged test branch, preserve that work in the new branch.
- Push changes when requested so the user can test in the live environment.
- When merging and deleting branches, push main successfully before deleting test branches.
- Stop promptly when instructed.
- Do not resume discarded work without authorization.
- Keep changes focused and avoid unrelated UI redesigns.
- Use clear, human-readable field labels.
- Comment function purpose, important actions, and non-obvious constraints.
- First-party comments should not refer to user-provided example reports or name a competing dark-mode extension.
- Preserve compatibility identifiers when technically required.
- Never commit real customer records, personal identifiers, uploaded PDFs, credentials, or extracted private report text.

## Discarded UI Work

The user rejected a broad UI accessibility review and instructed that its branch be scrapped.

The discarded branch was:
- fix/v1.8.14-ui-accessibility

Its uncommitted application changes, test helpers, generated audit folder, and branch were removed. Main was restored to version 1.8.13.

Do not resurrect the canceled broad changes, including general target enlargement, enlarged switches, responsive popup tabs, new keyboard navigation, or global layout/font changes.

This canceled branch is different from:
- fix/v1.8.14-browser-requirements

The browser-requirements branch is valid and is included in v1.8.15.

The smaller, approved touch improvements already incorporated into v1.8.13 remain valid.

## Latest Fix: v1.8.14 Browser Requirements

A user installing version 1.8.13 received:
- Service worker registration failed. Status code: 15
- TypeError: chrome.storage.local.setAccessLevel is not a function

The implementation uses trusted-context access restrictions on local storage.

Previously verified compatibility research:
- chrome.storage.local.setAccessLevel requires Chrome 140.
- Earlier support for session storage does not imply support for local storage.
- Version 1.8.13 incorrectly declared minimum_chrome_version as 120.

The v1.8.14 fix:
- Sets minimum_chrome_version to 140.
- Updates release version files.
- Documents browser requirements in README and DEVELOPMENT.
- Adds a browser-floor guard to tools/check.mjs.
- Retains the trusted-storage restriction instead of silently bypassing it.

Relevant compatibility reference:
https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/setAccessLevel#browser_compatibility

Users on an unsupported Chrome version should update through chrome://settings/help, relaunch Chrome, and reload the extension.

Previously run verification:
- npm run check
- Existing shortcut tests

## Latest Fix: v1.8.15 TRACE/TRCE Address Parsing

A vehicle report failed barcode generation because its owner address used TRCE as the abbreviation for Trace.

Cause:
- The street-suffix recognition in extension/barcode-data.js did not include TRACE or TRCE.
- This caused ownerAddress parsing to fail to separate street, city, state, and ZIP.

The fix adds both suffix spellings.

Previously verified:
- Abbreviation and full spelling
- Lowercase and punctuation
- Unit information
- Multiword cities
- Out-of-state addresses
- TRACE used as part of the street name
- Ambiguous multiple-suffix cases
- Isolation of the first owner's identity and address

The actual uploaded report parsed successfully through both pdftotext and the bundled PDF.js worker.

A synthetic browser fixture was added. The barcode browser checks produced 39 exact PDF417 decodes across 13 fixtures and 3 render sizes.

Previously passed:
- npm run check
- Barcode and barcode-editor unit tests
- Relevant browser/PDF parsing checks

Private report data was not committed.

## Open Investigation: Keyboard Bindings Reset During Updates

This issue is not conclusively diagnosed or fixed.

User observations:
- Updates replace files in the same folder, followed by Reload.
- Missing assignments are blank in Chrome's own shortcut settings.
- The issue is not limited to the extension's display of assignments.
- Reloading without replacing files preserves a newly assigned shortcut.
- Reinstalling the same patch version also preserved shortcuts.
- A controlled upgrade that changes the version number has not been verified.
- Chrome had recently updated.
- Reported Chrome version: 157.0.8103.38.
- Reported extension ID: hloaffjfdnmnpolmahknbllflffemfag.
- The user believes IDs changed previously while shortcuts remained assigned; no older IDs were retained.

Previously verified:
- Command declarations and installation-handler behavior were unchanged across v1.8.12, v1.8.13, and v1.8.14.
- Chrome owns shortcut assignments.
- The extension can read assignments through chrome.commands.getAll().
- The public API does not let this extension restore arbitrary shortcut keys and Global scope.
- The manifest has no fixed public key.
- Removing the legacy local-storage item named bindings does not delete Chrome's browser-level shortcut preferences.

Unpacked extension IDs normally derive from the full folder path unless a manifest key supplies identity. Do not casually add a key: doing so can change the ID once and affect settings, shortcuts, and vault access.

A Chrome-update-related reset is a possibility, not a confirmed cause.

Installed-extension reproduction in the managed browser was blocked by enterprise policy:
- ExtensionInstallBlocklist: ["*"]

Do not bypass that policy. Fixture browser tests can still run.

## Architecture Guide

Verify these paths against the current checkout.

- core.js:
  Command identifiers, URL recognition, input normalization, and report identifiers.

- background.js:
  Privileged service worker, command dispatch, popup/panel lifecycle, report captures, queue, history, and message authorization.

- automation.js and page.js:
  DMV navigation and DOM interaction.

- run.js:
  Cooperative cancellation and guarded boundaries for a SearchRun.

- results.js and pdf-routing.js:
  Result discovery and routing between native and custom PDF views.

- reader.js, pdf-dark-view.js, and pdf-print.js:
  PDF extraction, continuous dark viewer, and printing original report bytes.

- status-alerts.js:
  Driver and plate status interpretation.

- barcode-data.js:
  Report parsing, barcode field construction, and framing.

- barcode-editor.js and barcode.js:
  Editable barcode data and barcode rendering.

- vault.js and blacklist.js:
  Encrypted credentials and protected identifiers.

- alert-settings.js, audio-alerts.js, voice-recordings.js, and audio-player.js:
  Persistent alert preferences and audio playback.

- dmv-theme*.js and dmv-theme.css:
  DMV website appearance.

- popup.*, panel.*, shortcut-setup.*, and shortcut-menu.*:
  Extension interface, dialogs, setup guide, and shortcut menu.

Read README and DEVELOPMENT for current lifecycle and implementation contracts.

The pageOperation function is serialized into the page's MAIN world. Any helpers or imports it depends upon must remain available inside the serialized function.

## Browser Permissions and Origins

The intended host permission is:
- https://www.scdmvonline.com/*

Broad optional HTTP/HTTPS host permissions were removed and tested.

SCUTTIES was observed to remain on the DMV origin. The transaction-page link must still be clicked to initiate its login sequence.

Hostname capitalization does not create a different origin.

Do not restore broad host permissions without a demonstrated need.

## Commands and Recommended Keys

Recommended assignments:
- Plate Search: Alt+P
- DL Number: Alt+L
- Customer Number: Alt+O
- Collect Customer/Owner Numbers: Alt+J
- Next Queued Customer: Alt+N
- Previous Queued Customer: Alt+M
- Customers at Same Residence: Alt+I
- SCUTTIES: Alt+U
- Generate Barcode: Alt+B
- Open Shortcut Menu: Alt+H

Commands start unassigned on a fresh installation.

Recommended keys are not the same as actual browser assignments.

The setup guide recommends assigning only Alt+H for a simple setup. Users may optionally assign individual functions to recommended or custom keys.

Global scope allows use while another application has focus or the browser is minimized. The browser must remain running.

chrome.commands.getAll() does not expose the assignment's scope.

A pause/resume shortcut feature was removed at the user's request. Do not restore it.

## Identifier Normalization

Apply consistent canonicalization to manual entry, replay, follow-up actions, queues, and blacklist comparisons.

- Plate:
  Uppercase; maximum 8 characters.
  Leading zeroes are significant.

- Driver's license:
  Numeric; maximum 9 significant digits.
  Remove permitted formatting and leading zeroes before length validation.

- Customer number:
  Numeric; maximum 8 significant digits.
  Accept and remove a case-insensitive C0 prefix, then normalize leading zeroes before validation.

Do not reject an otherwise valid number merely because its original display form included leading zeroes.

For SCUTTIES, drop a name suffix and use the person's last name. Preserve appropriate date-of-birth validation.

## Search Lifecycle and Recovery

- New search/report work replaces the prior SearchRun.
- Cancel obsolete readers, audio, panels, and pending cooperative work.
- Guard asynchronous boundaries to prevent stale navigation, submission, focus changes, or status updates.
- Cancellation cannot recall a request already submitted to the DMV.

Bring both the browser window and the working DMV HTML tab into focus. PDF tabs are not the working navigation tab.

Login bypass normally applies within a 10-minute window.

Warm-session recovery:
- Perform the special check after navigation to the first requested page.
- If the portal instead lands on an empty TransactionList page, log off and retry once through full login.
- An unexpected first page may also trigger one login recovery attempt.
- Dedicated error pages and visible validation errors must not be mistaken for successful navigation.
- Do not automatically repeat a transaction that has already been submitted.

Preserve explicit portal-error detection as well as URL-based handling.

## Customer Queue and History

Recognize identifiers labeled:
- Customer Number
- Owner Number
- Registrant/Lessee Number

Collect unique identifiers in document order.

A Customers at Same Residence report can contain repeated driver headings. The residence report classification must take precedence over those headings.

Genuine driver records are not a valid source for collecting an owner/customer queue.

Residence behavior:
- Keep the first customer number in the saved list.
- If at least two numbers exist, automatically run the second.
- Continue normal Next/Previous navigation afterward.

Other collection flows begin with the first queued identifier.

Previous moves to the previous attempted queue entry without wrapping.

A DMV rejection of a queued customer must consume that queue position so the user can continue to the next number.

Previously implemented queue rules also consume a blacklist-blocked position. Cancellation, login failures, and technical failures preserve the position.

DMV-rejected attempts should appear in recent history with their outcome/error instead of leaving only a status-bar message.

Blacklist blocks are not completed searches in history.

Recent history holds the last 20 session entries. Replaying history does not move the queue.

## Vault and Blacklist

Blacklist protection prevents users from accidentally submitting identifiers associated with themselves or family members, which may cause automatic suspension or revocation of DMV access.

- Check protected identifiers before navigation and immediately before submission.
- Apply protection through every relevant entry point.
- A saved, locked vault must be unlocked before protected searches proceed.
- Do not add a bypass through a new interface.

Storage design:
- Persistent local storage: encrypted vault and non-sensitive preferences.
- Trusted session storage: unlocked credentials, blacklist, and derived key.
- Never persist the passphrase.

Previously documented cryptography:
- PBKDF2 with SHA-256
- 310,000 iterations
- 16-byte salt
- AES-GCM with a fresh 12-byte IV
- Minimum passphrase length of 12 characters

Unlock once per session. Adding/removing entries during that session must not repeatedly prompt for the passphrase.

Serialize decrypt/merge/re-encrypt operations and bind the unlocked key to the correct vault identity.

Blacklist UI:
- Dedicated Blacklist tab
- Current-entry table
- Type selector and appropriately validated input
- Trash icon for removal
- Confirmation that removal means future searches will no longer be blocked

Blocked attempts display a prominent red warning identifying the number category and the risk of DMV access suspension or revocation.

Login must retain an option to use different credentials.

The user requested that different credentials overwrite or remove saved user information/vaults. Verify the current implementation and its blacklist consequences before changing this flow; do not assume stale session keys can modify a replacement vault.

The login popup also has a clear/delete saved information action.

Before clearing saved information, confirm:
- Saved credentials will be deleted.
- Blacklisted numbers must be re-entered before blacklist protection is enabled again.

Clearing private state should cancel relevant work while preserving non-sensitive user preferences.

The blacklist does not infer relatives or automatically discover additional related identifiers.

## PDF Capture and Viewer

Report attachment URLs can refer to mutable session state.

- Capture immutable report bytes associated with the tab, job, and document.
- Do not refetch an old attachment URL assuming it still represents the same person.
- Prefer the focused report when choosing a source.
- Capture source context before the shortcut menu takes focus.

Previously documented limits:
- 24 MB
- 300 pages
- 1,000,000 extracted characters

The parser is not OCR.

The custom PDF viewer:
- Uses continuous scrolling.
- Supports selecting and copying text.
- Virtualizes canvas rendering.
- Preserves the original pixels of photographs.
- Avoids whole-page inversion.

Printing:
- Print button, Ctrl+P, and Cmd+P open the exact loaded original PDF in Chromium's native renderer.
- Use the retained original bytes/Blob.
- Do not print the HTML viewer.
- Do not silently refetch a mutable attachment or substitute a newer report.

## Barcode Rules

Driver/ID barcodes use the implemented AAMVA version 09 structure.

South Carolina registration barcodes use version 01 and a single RG subfile with different framing.

The framing function owns:
- ASCII framing
- Directory offsets
- Lengths
- Terminators

Do not silently truncate fields or guess missing values.

Use full, human-readable editor labels rather than AAMVA element abbreviations.

Names:
- Parse first, middle, last, and suffix separately.
- Support suffixes such as JR, SR, II, III, and IV.
- Do not substitute a customer number for a missing driver's license number.

Registration expiration fields:
- RAG: plate expiration
- RBT: decal expiration

Temporary plates:
- Recognized temporary classes include T45V, E45V, and E60V.
- Plate status uses Plate Exp Date.
- A blank temporary-plate Decal Exp Date inherits Plate Exp Date.
- Do not overwrite a nonblank decal date.
- Remove an appended display year from the parsed plate value.

Owner selection:
- Initially use the first unique numbered owner/customer/registrant/lessee.
- Bind that party's name and address together.
- Relationship and mailing labels delimit party data.
- Never silently borrow missing fields from a later party.

If the selected party is incomplete:
- Explain the parsing problem.
- Offer another owner only when another owner exists.
- Permit generation with incomplete fields blank when the user chooses.
- Support manual correction.

Business entities:
- Existing comma/name heuristics are imperfect.
- Do not assume every identifier belongs to a person.
- No special Coplogic business-entity mapping has been conclusively verified.

Barcode editor:
- Show parsed fields immediately in read-only form.
- Edit Data unlocks the fields.
- Valid edits regenerate the barcode live.
- Invalid edits hide the invalid barcode and show validation.
- Recognized parsing failures can open an unencoded draft for correction.
- Preserve invalid/raw values where needed for correction.
- Edits affect only the current popup.

Barcode timeout:
- 90-second countdown.
- Editing fields, including invalid edits, resets the countdown.
- Changing display scale does not reset it.
- Escape and Close dismiss the popup.

## Approved Interface Behavior

- Main popup tabs include Recent, Settings, Blacklist, and About.
- Voice-alert additional controls are hidden while voice alerts are disabled.
- Disabling voice alerts preserves the saved choices.
- Alert and appearance preferences persist across sessions.
- DMV website styling is restricted to the DMV site.
- Preserve the current relationship between website appearance and PDF appearance controls.
- Prefer native styling over competing injected themes where technically possible.
- Preserve photographs and print behavior.

Approved v1.8.13 usability work:
- Setup guide body text is consistent at approximately 14px.
- Existing header sizes remain.
- Extra spacing separates the shortcut-settings link from the setup-guide button.

Shortcut menu:
- Opens through Alt+H.
- Vertically arranged action buttons.
- Width follows its content with reasonable padding.
- Right edge aligns with the user's screen/work area.
- Handle window-frame dimensions and monitors with negative coordinates.
- Do not request a display permission merely to position it.
- Touch targets have a 44px minimum with approximately 8px gaps.
- Short displays may scroll the action area while retaining usable controls.
- Opening the menu does not cancel the current search.
- Selecting an action uses normal command dispatch and closes the menu.
- Reopening focuses the existing menu.
- Includes a 90-second timeout and Escape support.

## Verification and Packaging

Read package.json, README, DEVELOPMENT, and current test scripts before running checks.

Common commands:

    npm run check
    npm test
    CHROME_PATH=/usr/bin/chromium node tests/browser.mjs
    CHROME_PATH=/usr/bin/chromium PYTHON=python3 node tests/barcode-browser.mjs

The browser harness may otherwise default to a Windows browser path. Set CHROME_PATH for Linux.

Previously used dependencies:
- Playwright
- pdf-lib
- Python Pillow
- Python zxing-cpp

tests/runtime.mjs contains managed-runtime dependency fallback behavior.

Relevant harness options may include:
- BROWSER_TEST_FILTER
- --barcode-pdf
- --residence-pdf
- --customer-pdf

Use synthetic fixtures for committed tests.

Optional private-PDF checks must not log personal identifiers.

Ignored/generated locations include:
- tests/tmp/
- test-results/

tools/package.ps1 uses an explicit packaging allowlist. Keep uploaded files, test output, local context documents, and private data out of release archives.

Validate:
- Consistent release versions
- Minimum browser version
- Manifest syntax and command declarations
- Required packaged assets
- Relevant parsing and lifecycle tests

Run meaningful checks appropriate to the change. Do not claim a complete suite passed when only targeted checks ran.

## Cloud Skills and Environment

Relevant skills, when available:
- cloud-environment:cloud-environment-runtime
- cloud-environment:cloud-desktop
- cloud-environment-onboarding:setup

Read the current skill instructions through the tools available in the new chat. Package aliases and environment IDs may change between chats.

Use the runtime skill when beginning managed environment work.

Use the desktop skill for shared-browser inspection and screenshots.

Use onboarding setup for repository/environment setup and reusable configuration.

Distinguish:
- Local cloud execution
- The shared browser desktop
- GitHub access

An unavailable execution environment does not prove GitHub is down.

The previous chat's environment remained pending/offline. No usable reset tool was available. Do not repeat long waits after the user says stop.

Never expose platform credentials, proxy secrets, vault contents, or private report data while troubleshooting.

## Historical Next-Chat Checklist

1. Locate the checkout and read current repository instructions.
2. Inspect git status and remotes.
3. Fetch main and the relevant test refs explicitly.
4. Check whether the requested v1.8.15 merge has already happened.
5. Confirm v1.8.15 contains the browser-requirements fix.
6. Preserve any unrelated work.
7. Complete the requested merge and push if still pending.
8. Delete v1.8.15 and v1.8.14 test branches only after confirming main contains their changes and has been pushed.
9. Report the actual resulting version, main commit, and deleted branches.