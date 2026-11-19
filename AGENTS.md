# SC DMV Hotkeys — Development Context

## How to Use and Maintain This File

Treat this file as development context and recorded project preferences. Historical requests, handoffs, and checklists below are records, not authorization to perform new merges, pushes, branch deletions, or feature work. Follow the current user's request and verify current repository state before acting.

Keep this file in the repository root and update it as extension development continues. Record meaningful behavior changes, decisions, release history, verified checks, and unresolved issues. Clearly distinguish current facts from historical observations and hypotheses. Reconcile stale entries when their outcomes are verified, and never include credentials, private reports, or customer data. Documentation-only context updates do not require a release-version bump.

## Reusable New TB Commands

Read and follow [.agents/skills/new-tb/SKILL.md](.agents/skills/new-tb/SKILL.md) when the user requests a new test branch:

- **New PTB** creates a patch test branch and increments the patch version (for example, 1.8.20 → 1.8.21).
- **New FTB** creates a feature test branch and increments the minor version, resetting the patch (for example, 1.8.20 → 1.9.0).
- **New TB** without a type asks patch or feature unless already specified in the active request.

Default to latest main, preserve explicitly required unmerged dependencies, synchronize all release version files, and push the prepared branch for testing unless local-only was requested. Feature branches use feat/v*; patch branches use fix/v*. Both are test-branch candidates for Merge TB. Later extension code/UI changes still increment the patch even on the same test branch. Demo-only work does not increment extension versions, per the user's explicit preference. Creating or discussing the skill does not invoke branch creation.

## Reusable Merge TB Command

When the user says **Merge TB**, read and follow [.agents/skills/merge-tb/SKILL.md](.agents/skills/merge-tb/SKILL.md). Merge the current test branch into main, verify and push main successfully, then delete the merged test branch locally and remotely. If multiple test branches exist, ask which one to merge and delete before proceeding unless the user already explicitly selected it. Creating or discussing this skill does not invoke a merge.

## v1.8.45 Keybinds / About Navigation and Initial EULA Acceptance — 2026-11-19

- Continued feat/v1.8.41-demo-portal from 72613d8 at the user's request to rename the former About tab to Keybinds, move shortcut setup from Settings into it, move Practice environment to the bottom of Settings, and add a new About tab with pending privacy/EULA public links. About also has Open EULA / Review acceptance, available before agreement, so closing/declining the initial review is recoverable. Placeholder links are visibly pending and do not navigate until real public GitHub URLs are supplied.
- The user explicitly authorized using the current EULA draft for first-install acceptance. Bundled contract sections/metadata retain the unresolved owner/legal placeholders; a visible beta-draft notice explains this. tools/build-eula.mjs generates safe text and a SHA-256 digest from reviewer/EULA-DRAFT.md, excluding the publisher checklist/drafting introduction. check and the runtime packager reject stale generated agreement content. This implementation supersedes the historical no-runtime-integration statements in the drafting notes below; it does not claim final legal approval or authorize public publication.
- Added a dedicated agreement tab with the complete text, an initially unchecked checkbox, explicit acceptance and Decline. Installation opens it instead of automatically opening shortcut setup. Worker command dispatch and privileged feature messages require a valid local acceptance receipt before searches, report extraction, settings or audio work; legal review/state and emergency Stop remain available. The popup keeps feature panels inert until the worker confirms agreement and exposes a review notice/button. Direct/forged acceptance outside the exact top-level EULA document or without agreement/current bundled digest is rejected.
- Unaccepted startup removes the owned PDF redirect and disables DMV theme registration; the content-script theme handshake returns disabled. No credentials/history/private state are returned by the locked state response. About reopens/reuses the agreement tab and can restore/focus its window. Closing or declining stores no acceptance and runs no query. Agreement enables ordinary routing/theming and workflows without replaying a previously blocked command.
- Acceptance stores accepted/time/document digest in trusted local storage and survives browser/worker/document restarts and private vault/session clearing. Existing profiles without a receipt must agree before next feature use. Future EULA updates/reacceptance policy is explicitly deferred: no version/hash comparison invalidates an existing receipt. No extra permission, entitlement server or payment mechanism is added. Privacy/reviewer/native instructions describe the local receipt and new onboarding.
- Synchronized manifest/package/lockfile/root entry/README to 1.8.45, added the five reviewed runtime assets to the 328-file allowlist, and regenerated the runtime ZIP and synthetic walkthrough. Preserved the prior draft/privacy/listing edits as part of this authorized integration. Main remains unchanged; no merge, store submission or environment publication is included.
- Verification: npm run check, generated-EULA/demo verification, permission audit, git diff --check and all 341 unit tests passed. All 91 general browser checks, 15 actual-worker/packaged-demo checks and 10 DMV-theme browser checks passed. Fresh extracted runtime ZIP with empty fixture storage verifies cold install, unchecked/closed/declined agreement, About recovery, direct/hotkey/reader/settings blocking, no pre-accept routing/theme, forged acceptance refusal, affirmative agreement, reload/startup persistence, Keybinds placement, last-in-Settings demo section and inactive legal placeholders. It then completes normal driver/photo/suspension, owner, SCUTTIES, barcode and light/dark viewer flows. The 66-second walkthrough and screenshots use synthetic data and explicit Chrome API substitutes; visually inspected agreement, Keybinds and About. Native installed-extension and Windows focus/global-key validation remain blocked by managed policy and require user testing. Standalone demo/PDF-layout and independent barcode-decoder suites were not rerun for this revision. No live DMV transaction was submitted.

## EULA Draft and Publisher Demo Verification — 2026-11-18

- The user reports that Demo Mode passed every check in the packaged reviewer guide. Record this as publisher-reported validation, distinct from the cloud API-substitute suites. Browser/OS, extension ID and the separate native-validation checklist results were not supplied; do not infer that every native/platform check or live-service check passed.
- At the user's request, created reviewer/EULA-DRAFT.md as a working document. It is not adopted, effective, added to the extension UI or presented for acceptance. The user confirmed: leave the legal owner/licensor as a placeholder; public support/legal contact flyinsquiddev@gmail.com; existing beta copies remain free after testing and the public release/future updates may require payment at the owner’s discretion; permit internal agency sharing of unmodified copies with authorized recipients; prohibit modification, repackaging, resale and sharing the installation link with unauthorized persons; South Carolina law and Pickens County venue. Added these choices to the draft and reconciled the owner/contact/distribution statements in the privacy/listing/reviewer drafts. Preserve applicable third-party and platform license rights.
- The user resolved the beta/eligibility follow-ups: existing beta copies retain a continuing free-use grant; future releases/updates may be paid at the owner's discretion. Under a future SCDMV statewide software distribution license, all active, certified South Carolina law enforcement officers and civilian law enforcement agency employees who are authorized SCDMV Portal users are entitled to receive it. Under an individual agency license, its designated administrator may authorize eligible active/certified officers and authorized-portal civilian staff. These are conditional distribution terms, not a claim that SCDMV has licensed/endorsed the extension or that recipients automatically gain portal access. Existing approved beta participation remains recognized.
- Reconciled beta grant, updates, termination and distribution clauses to preserve free use of existing beta copies, while leaving future paid pricing/duration/deployment terms undecided. Legal owner, liability cap, effective date and public privacy URL remain placeholders. The unlisted listing's contractual sharing restrictions do not implement installation approval or payment enforcement. Beta/public-release update channels, archiving and entitlement mechanisms are not implemented by this documentation work.
- Continued EULA drafting with a proposed Section 10 liability exclusion tied to harm caused by unauthorized/unlawful use, failure to perform Section 5 verification, and user-introduced data/barcode errors. Preserve the causal limitation, mandatory-law carveout and nonparty rights; this is not blanket immunity or a guarantee of enforceability. The user corrected the target section to 10; no new termination rule or indemnity obligation is added. Liability cap remains undecided and South Carolina legal review is still required before adoption.
- The draft addresses actual user-invoked record/search/barcode/photo workflows, authorized access, independent source-record verification, data handling, support/updates, warranties/liability, termination and third-party components. It does not grant ownership of user records, invent a public support address or claim existing users have accepted new terms. No runtime code, permissions, release version or EULA acceptance flow changes are included. Version remains 1.8.44; main is unchanged. Drafting does not authorize store submission, publication or a merge.

## v1.8.44 Demo Login Repair, Record Formatting and Licensing Removal — 2026-11-18

- Continued feat/v1.8.41-demo-portal from 464f61e to fix the user's packaged-demo login stall, remove the extension licensing section pending a future EULA, and format synthetic reports more like the supplied examples. Synchronized manifest/package/lockfile/root entry/README to 1.8.44 for the extension changes. Main remains unchanged; no merge, environment publication or Web Store submission is included.
- Reproduced Checking DMV login with no DOM operations by making the browser harness return null for own-extension webNavigation.getFrame and omit own-extension navigation events. Chromium normally excludes chrome-extension URLs from this API; the earlier harness incorrectly supplied metadata for them and hid the bridge readiness bug. Reviewed the upstream Chromium FrameNavigationState / WebNavigationGetFrame implementation to confirm the restriction. Actual installed-extension testing remains blocked by managed policy; it was not bypassed.
- Replaced the demo frame lookup with runtime.getContexts, matching the current tab, top-level frame, exact URL and browser-issued document ID to the trusted port sender. No new permission is needed. If an idle/restarted worker has lost its port map, it requests a reconnect from the owned current tab on demand; the bridge verifies the extension sender and its own tab before reconnecting. It does not keep an idle worker alive. Preserve foreign-frame/sender and same-URL replacement rejection.
- Removed the first-party License & ownership footer and unused styling from About, and removed the perpetual-license grant from README. No placeholder EULA or additional confirmation flow was added. Bundled PDF.js, barcode and other vendor license/attribution files remain intact.
- Reworked the dependency-free synthetic PDF writer with centered titles/photos, monospaced aligned field columns, bold labels, ruled sections, a Current credential table and shaded offense headings. Whole suspension/revocation/violation groups stay with their dates across genuine pages. Every page keeps its synthetic/non-government labels and page number. Only invented values and procedural images are used; no private data, official seal/signature or uploaded photograph is copied. Explicit WinAnsi font encoding preserves the ASCII height apostrophe and exact barcode payload. Preserve header field order and Current / (ACN / DDN) / credential extraction order when adjusting layout.
- Regenerated all 19 fictional PDFs and their byte/hash inventory. Added a real PDF.js 19-case layout check for glyph bounds, aligned columns, complete offense groups and exact status/barcode/customer parsing against the fictional source. The updated extension harness models Chrome's own-page API restriction and tests on-demand port recovery. The reviewer walkthrough uses the current archive version in its filename. Updated development/demo/reviewer guidance and rebuilt the runtime ZIP/media.
- Verification: npm run check, npm run audit:permissions, generated-demo verification, git diff --check and all 337 unit tests passed. All 91 general browser checks, 46 standalone demo checks, 19 formatted-PDF layout/parser checks, and 15 packaged-demo/actual-worker checks passed. Fresh ZIP extraction with empty fixture storage passed guide/defaults, login, driver/photo, suspension details, vehicle/owner follow-ups, SCUTTIES, barcode and light/dark viewer flows using explicit Chrome API substitutes. Rebuilt the 60-second synthetic UI walkthrough and independently checked ZIP CRCs/file hashes. Visually inspected synthetic vehicle, portrait-driver and multi-page suspension layouts. Native Chrome installation remains blocked by managed policy; Windows focus/minimize/global keys and installed operation require user validation. Full independent barcode-decoder and DMV-theme suites were not rerun for this revision. No live transactions or private report outputs were submitted or committed.

## v1.8.43 Packaged Reviewer Demo and Light PDF Viewer — 2026-11-18

- Continued feat/v1.8.41-demo-portal from 3210e98 at the user's request to prepare the agreed reviewer materials and audit current permissions before packaging. Added the user's concurrent request that light-mode PDF results keep the custom viewer. Synchronized manifest/package/lockfile/root entry/README to 1.8.43. Branch name and main remain unchanged; no merge, environment publication or Web Store submission is included.
- Replaced extension Demo Mode's localhost dependency with generated own-extension pages, catalogs, procedural images and 19 fictional report PDFs, plus one deliberately incomplete unavailable-report fixture. Settings opens the packaged practice portal and new reviewer guide without Node/server/host prompts. The independent Node HTTP preview remains available for manual development. tools/build-demo.mjs reproduces/verifies generated bytes and hashes; only extension/demo/reports/*.pdf is exempted from the private-PDF ignore rule.
- Packaged page automation uses a bounded worker-owned port and the shared self-contained page adapter, with sender/frame/tab/document checks and exact own-extension root verification. Protocol plus host comparisons distinguish extension IDs despite URL.origin=null. Only generated report IDs are accepted. Demo login remains demo/demo and existing cancellation, queue/history/report ownership, live-vault exclusion and demo: state isolation remain in force. The packaged Download action opens the custom viewer explicitly. Removed localhost optional-host/resource access and retired its dynamically registered demo hook on upgrade.
- Reviewed current code and intended workflows before archive creation. Retained seven active API permissions and the exact SCDMV HTTPS host: storage, tts, offscreen, scripting, tabs, declarativeNetRequestWithHostAccess and webNavigation. Offscreen remains necessary for packaged AUDIO_PLAYBACK; abandoned query methods do not justify access. Documented sensitive tab-URL/pending-URL and committed-document-ID needs rather than treating every tabs API call as permission evidence. tools/audit-permissions.mjs gates packaging against this reviewed set; reviewer/PERMISSIONS.md records evidence and removed/absent permissions.
- Live main-frame attachment routing now always opens the bundled viewer, selecting dark=0/1 from the existing PDF preference. Light mode renders original PDF colors with light viewer surroundings and retains selection, continuous scrolling, color switching and Print. Reader display/print initialization includes pdf=1 even when dark=0. Explicit native printing retains the original immutable Blob. Corrected environment comparison for demo printing to compare immutable environment identity/root, not freshly constructed object references.
- Added packaged reviewer-guide.html, access/reviewer notes, unlisted listing draft, accurate privacy-policy draft and a pending native clean-profile checklist. The privacy draft still needs publisher-controlled support contact and public hosting before submission. No real records, private DOM captures, uploaded portraits, signing key or developer credentials enter the runtime.
- tools/build-webstore.mjs audits permissions and generated assets, then enforces a reviewed 323-file runtime allowlist, rejects symlinks/unexpected private or build files, and produces a deterministic root-manifest ZIP plus SHA-256 and per-file inventory. Reviewer attachments stay outside the runtime ZIP. The fresh-extracted-package harness uses empty fixture storage and actual browser pages/worker/PDF.js with explicit Chrome API substitutes; its 60-second captioned walkthrough is labeled as synthetic automated UI coverage, not native installation evidence.
- Verification: npm run check, npm run audit:permissions, git diff --check and all 337 unit tests passed. All 91 general Chromium checks, 46 standalone demo checks, 14 packaged-demo/real-worker checks, 42 exact PDF417 decode cases plus barcode UI checks, and 10 DMV-theme checks passed. Packaging tests independently verify ZIP CRCs/root manifest/inventory and deterministic bytes and reject unreviewed files, symlinks and excess permissions; bridge tests reject foreign frames/senders and replaced same-URL documents. Fresh ZIP extraction with empty fixture storage passed guide/defaults, driver/photo, active/pending details, vehicle-owner follow-ups, SCUTTIES, barcode and light/dark viewer workflows with local-only requests. Visually inspected the light-viewer walkthrough frame. Native installation remains blocked by managed policy; no policy bypass occurred. Native DNR, permission disclosure, Windows focus/minimize/global keys and installed-extension behavior remain pending publisher testing. No live transactions were submitted.

## v1.8.42 Extension Demo Mode and SCUTTIES Selector Fix — 2026-11-18

- Continued feat/v1.8.41-demo-portal from 6d9360a at the user's request to integrate Demo Mode and correct the SCUTTIES selector. Synchronized extension/manifest.json, package.json, both lockfile version entries and README to 1.8.42 because this changes extension functionality. The branch name remains unchanged; main is not merged or modified. No environment/Web Store publication is included.
- Added Settings → Practice environment → Demo Mode, off by default, plus Open practice portal and visible demo labels on worker-owned input/status/barcode/menu/viewer surfaces. Enabling requests only optional http://127.0.0.1/* host access in the Settings gesture; automation and the serialized page adapter independently require http://127.0.0.1:4173 exactly. Live host permissions remain unchanged. Other ports/localhost remain manual-site options, not extension destinations. Demo login is always demo/demo; it never asks to unlock or reads the live vault during a demo search.
- Added fixed environment descriptors and per-run/per-reader environment ownership. Existing live workflow storage keys remain intact; demo history, queue, portal/login hints, report caches/tracking, status and session-only blacklist use demo: keys. Demo blacklist edits are separately serialized and cannot modify the live vault. Alert/appearance/shortcut preferences stay shared. Wrong-environment focused reports/prints, history IDs, panels and late reader replies are rejected. Switching environments cancels active work, captures, panels and audio before changing routing, without replaying a query. Late physical snapshot writes remain serialized in their original namespace. Permission revocation disables Demo Mode; worker startup restores it only if its permission remains granted.
- Reused normal command dispatch, blacklist gates, shared navigation, PDF.js extraction, owner follow-ups, residence queue, barcode/status controllers, hidden-window transport and owned result-tab reuse. Registered the bundled expiring background-report postback hook for the demo host only while enabled; the self-contained page operation and generated wrapper retain exact-origin guards. DNR routing selects the active environment's exact main-frame attachment endpoint. No remotely served script becomes extension code. SCUTTIES remains in the foreground and now selects button[ng-click="searchCitation()"] with model-specific surname/DOB inputs rather than positional children. The demo retains Search first / Show SAVED Citations second.
- Integration exposed startup/navigation races: demo record forms now keep inputs/Next disabled until catalog loading installs local submit handlers; automation waits for visible, enabled controls. Read-only unloaded-document checks are polled again without repeating clicks or transactions. Login waits for an in-flight manual/automatic redirect during its autofill delay before deciding whether to submit. A synthetic timeout is classified as technical, preserving the extension queue/history. Settings storage events invalidate outstanding state responses so stale snapshots cannot undo newer toggle changes. Updated user/development/DOM instructions, including replacing/reloading extension/ as well as demo/ for this revision. Per-tab fault selections do not transfer to a new hidden query window; use foreground mode for controlled fault testing.
- Verification: npm run check, git diff --check, new-module syntax checks and all 333 unit tests passed. The full 91-check general Chromium suite, all 46 standalone demo checks (12 vehicle, 15 driver/customer/residence, eight SCUTTIES, 11 photo/recovery), 14 real-worker/demo integration checks, all 42 exact PDF417 decode checks plus barcode UI checks, and all 10 DMV-theme browser checks passed. The integration harness uses actual worker/automation/controllers and browser PDF.js against loopback with explicit Chrome API substitutes; it verifies local-only HTTP requests, fixed credentials/no live-vault reads, normal follow-ups/queue/SCUTTIES, concurrent demo blacklist edits, timeout recovery, background capture/reuse, stale settings rejection, cancellation/cross-mode isolation, late-reader refusal and permission revocation. Its native foreground-PDF path and simulated background-viewer path do not establish native DNR, permission dialogs, Windows hotkey/focus/minimize behavior or installed-extension operation. Managed installation policy is not bypassed; user testing is required for those native behaviors. Visually inspected demo settings and automatic photo-status screenshots; generated artifacts remain ignored. No live DMV transactions were submitted.

## Demo Driver Images and Recovery Scenarios — 2026-11-18

- Continued feat/v1.8.41-demo-portal from 6c55a65 at the user's request to add synthetic portrait/no-photo and session/search-failure coverage. This is demo-only work: extension/, manifest/release versions and lockfile remain unchanged at 1.8.41. No main merge, environment publication or store submission is included.
- The dependency-free PDF writer embeds compressed RGB image XObjects in a separate first-page header area. Avery/DRIVER001 has a procedurally drawn fictional portrait; Drew/DRIVER009 and Remy/DRIVER010 have procedural no-photo fixtures. No uploaded image, real portrait or private record value is used. The placeholder recreates the existing detector's non-personal text-mask signature: this is positive coverage of that signature and the actual pipeline, not independent accuracy evidence for other graphics.
- Added a default-off Show driver photo and name in status preview checkbox on driver/customer results, stored only in scdmv-demo-show-identity. The HTTP adapter now optionally calls production extractDriverIdentity on the first PDF page; real PDF.js rendering and isNoPhotoPlaceholder determine its payload. Known placeholders retain names/No photo available with no image, absent images retain names/Photo unavailable, and opting out omits the identity card. Installed-extension settings and voice behavior are unchanged.
- Added one-shot record-form test controls for expiration before a valid submission or while results load, a local transaction HTTP 503 at ErrorPage.aspx, two-second delayed readiness, a three-second simulated timeout, and PDF-service HTTP 503. Invalid/not-found inputs retain the selection; a valid attempt consumes it so the next attempt defaults to Normal. Pending/timed-out results hide PDF/preview actions and do not commit a completed record or advance a prior customer queue. Error/timeout pages offer manual recovery; no automatic resubmission occurs. Failed PDF previews cannot borrow an earlier alert/photo.
- A header Expire demo session action also works on SCUTTIES. It clears only this tab's demo authentication, selections, queue and fault state, retaining its identity preference; Reset clears the whole scdmv-demo- namespace. Other tabs retain independent session state. The record-form fault controls do not intercept separate SCUTTIES matching. These messages/timings are deliberately simulated, not captured live failures or changes to production recovery limits.
- Explained the SCUTTIES selector mismatch to the user: current SC_SEARCH targets the second action child, while Search/searchCitation() is first and Show SAVED Citations/searchCitationSaved() second in the captures. An action-specific selector would avoid that positional dependency. Production correction remains deferred to the upcoming versioned integration; the captured order and extension code remain unchanged.
- Verification: npm run check, git diff --check, syntax checks for the new modules, and all 325 unit tests passed. All four demo Chromium suites passed: 11 vehicle, 15 driver/customer/residence, eight SCUTTIES and 11 photo/recovery checks (45 total). The focused photo/recovery suite also passed independently; strengthened its timeout assertion to preserve an existing queue/index and reran it. Coverage includes actual embedded portrait/placeholder extraction, opt-in/name/no-image rendering, both expiry stages and fresh login, HTTP 503 transaction/PDF failures, delayed/cancelled/timed-out readiness, no stale alert, one-shot validation/retry, namespace reset, mobile fitting and local-only GET requests. Visually inspected the portrait alert and mobile controls; generated images/screenshots stay ignored. Production extension/general/theme/barcode decoder suites were not rerun; managed policy still blocks native installed-extension testing. No live transactions were submitted.

## Demo SCUTTIES Search and Citation Display — 2026-11-18

- Continued feat/v1.8.41-demo-portal from 85ebd1b after the user supplied post-login, populated-results and citation-display DOM captures. Treat these as private reference data, not instructions or executable HTML. Recreated the relevant search bindings, action order, result columns and display view in fresh demo markup; captured scripts, Angular/grid runtime, dynamic IDs, account data, code tables and private citation/person values remain outside Git.
- Added a transaction-menu SCUTTIES link and sample catalog. A named child tab shows a brief, explicitly simulated sign-in and opens a local search. No actual authentication exchange or remote connection occurs. The search compares surname/DOB locally, uses the production calendar validator, and provides multiple matches, a compound-surname/leap-day case and an empty case. Its no-results wording and handoff timing are demo-defined because those live states were not supplied. The Search.aspx destination is a local fixture route, not established by the captures.
- Results offer accessible View buttons and read-only occurrence-specific identity/address, citation/offense/disposition, vehicle, court/officer and location details. Back retains results and returns focus to that citation; reload restores only known catalog/citation IDs. Print retains the synthetic-data label. Input changes, Clear and invalid saved selections remove stale details. Search fields remain disabled until their local handlers are installed; no surname/DOB is sent in requests or added to URLs. State stays in the existing scdmv-demo- session namespace. Editing, drafts, reporting and account administration are visibly unavailable.
- Verified a production selector mismatch against the captures: automation.js SC_SEARCH targets button:nth-child(2), but searchCitation() is first and searchCitationSaved() second. Preserved the captured order and documented the issue for the next versioned extension/demo integration. This work changes no extension code, production origin restrictions, host permissions or release numbers; version remains 1.8.41. Installed-extension routing/reviewer launcher remain future work. No main merge, environment publication or store submission occurred.
- Verification: npm run check, git diff --check, syntax checks for new demo modules and all 323 unit tests passed. All three demo Chromium suites passed: 11 vehicle, 15 driver/customer/residence and eight SCUTTIES checks (34 total). The focused SCUTTIES suite also passed independently. Coverage includes protected/JavaScript-disabled access, child-tab handoff, captured input/button contract, date validation, all result/detail selections, reload/back/printing controls, empty/mismatched searches, tampered saved IDs, Clear/Reset, mobile overflow and local-only GET requests. Visually inspected desktop results and mobile detail screenshots; artifacts stay ignored. Nine distinct private captured grid values absent from pre-change source were confirmed absent from all changed/new files. Production extension and lockfile are unchanged; general extension/theme/barcode decoder suites were not rerun. No live transactions were submitted; managed policy still blocks native installed-extension testing here.

## Demo Driver/Customer/Residence Expansion — 2026-11-18

- The user confirmed the initial local demo works on Windows and requested further development. Continued feat/v1.8.41-demo-portal from f878da3. Four additional private DOM captures identify shared driver/customer Page 1, shared Page 2, residence Page 1 and residence Page 2. The user explicitly confirmed DL/customer searches use different inputs on the same pages. Fresh markup retains those interfaces; captures remain private reference data outside Git and are never executed or served.
- The user explicitly clarified that demo-site-only work must not increment extension release versions. This revision retains 1.8.41, with no extension runtime/manifest or lockfile changes. Updated Working Preferences and New TB/Merge TB skill guidance to preserve that exception in future work. The package.json change only extends test:demo to run both dedicated suites. Initial prototype versioning below records the earlier workflow and does not authorize further demo-only increments.
- Added a shared DL/customer form with both captured input IDs, one shared result page, production numeric/C0 normalization, ambiguity/not-found validation and an expanded catalog. Eleven fictional driver profiles cover valid, expired, mixed active/pending suspensions, pending-only, revocation, TAL, special privilege, valid-with-IID, ID-only, unlicensed and unavailable status. Saved vehicle-owner numbers resolve Avery/Morgan customer profiles; the unmapped business lessee explicitly reports that no fictional driver profile is defined rather than borrowing another record.
- Residence scenarios list the searched person first. Extract actual synthetic PDF text using bundled PDF.js and collect numbers through production ownerNumbers, preserving residence classification ahead of repeated driver headings. Local collection retains all three customers and starts with the second; bounded Previous/Next and Clear queue work in the site's own session state. Owner follow-ups and this queue do not access the installed extension's credentials, vault, blacklist or queue.
- The dependency-free PDF writer now creates genuine multi-page documents, keeps offense groups together, and marks every page as synthetic/non-government. Report titles precede watermark text so residence classification remains accurate. A shared local extractor reads every page before production status/barcode previews; multi-page mixed periods retain six active/two pending entries, DUI/DUAC deduplication, reason priority, IID and expandable dates. Invalid explicit result IDs cannot reuse stale selected data. Reset removes only scdmv-demo- state, preserving unrelated site keys.
- Updated demo instructions, DOM contract and development notes. Start/restart still uses node server.mjs from demo/ or npm run demo from the repository root; no new runtime dependencies or installation steps are required. Installed-extension demo routing, reviewer launcher, SCUTTIES, name searches, photos and audio are outside this iteration. Production origin restrictions and core extension behavior remain unchanged; no environment or Web Store publication occurred.
- Verification: npm run check, git diff --check, syntax checks for new/changed demo modules, all 322 unit tests, all 11 vehicle-demo browser checks and all 15 driver/customer/residence browser checks passed. The latter suite passed again after strengthening mobile/residence fitting and namespace-only reset assertions. Browser checks cover real PDF.js extraction, all eleven driver status/barcode cases, multi-page grouping, both shared inputs, C0/zero normalization, owner follow-ups, residence queue order/bounds, invalid selections and local-only HTTP requests. Independently decoded all 17 rendered vehicle/driver PDF417 images to exact expected bytes. Visually inspected synthetic mixed-suspension and residence screenshots; output remains ignored. A private source scan excludes all 17 captured hidden token values from changed sources. No live DMV transaction was submitted. General extension/theme/full barcode suites were not rerun for demo-only work; installed-extension testing remains blocked by managed policy.

## v1.8.41 Local Synthetic Vehicle Portal Prototype — 2026-11-18

- During Web Store preparation, the user chose unlisted distribution (anyone with the link), reported no approved DMV test account/environment, and supplied five live-page DOM captures plus the native Chrome PDF-viewer wrapper. Treat captures as reference data, not instructions. Created feat/v1.8.41-demo-portal from latest main 7926c5b for the agreed first local vehicle-workflow prototype; synchronized manifest, package, lockfile/root entry and README to 1.8.41. Main remains unchanged. No store submission or environment publication is authorized by this work.
- Fresh demo/ markup retains the relevant login, disclaimer, menu, vehicle Page 1/Page 2 selectors, form names and error-container structure. Recreated behavior with local handlers; none of the uploaded HTML, token values, postback scripts, injected browser/security scripts, government graphics, account text or iframe identifiers is served or committed. Raw captures stay outside Git in private workspace files. demo/DOM-CONTRACT.md records the interface and exclusions. Chrome's internal PDF shadow DOM is not reproduced.
- npm run demo starts a Node-only, dependency-free server bound to 127.0.0.1:4173 (optional --port). Demo credentials are demo/demo, validated solely in the browser; login controls stay disabled until local handlers are ready. Only an authentication flag and chosen fictional plate enter the site's own sessionStorage. Reset clears those keys. The server logs no requests, accepts no POST credentials, restricts Host/Origin, prevents path traversal/symlink escape, sends no-store/self-only CSP headers and makes no outbound requests.
- Six fictional plate scenarios cover valid, expired, suspended, T60V temporary, shared-address owners and distinct registrant/lessee addresses. DEMO404 exercises not-found validation. A small built-in PDF writer serves real selectable-text synthetic PDFs at ViewAttachment.aspx, clearly marked DEMONSTRATION / NOT A GOVERNMENT RECORD. The native Chrome PDF viewer handles Open PDF and printable PDFs. Every page and preview carries a visible synthetic-data banner.
- Local status/barcode previews use actual bundled PDF.js extraction, production parsers and existing panel/barcode controllers through an explicitly HTTP-only mock worker-response adapter outside extension/. Owners, barcode editing and popup lifetimes work; customer follow-ups explicitly report unsupported. This is not installed-extension automation: production origin checks, permissions, vault and background-window workflow are unchanged. Connecting the shared workflow to a separate, visible demo environment with isolated state is a later step. Driver/customer/residence/SCUTTIES flows are outside this first prototype; a reviewer launcher without local-server setup is still future work.
- Source packaging includes demo/ so the prototype accompanies source releases. A Web Store runtime ZIP should contain extension/ contents only. The PowerShell packaging script's folder allowlist was updated, but that platform-specific script was not executed on Linux.
- Verification: npm run check, git diff --check, syntax checks for all new demo JS/modules, all 318 unit tests (including six new HTTP/scenario/boundary tests), and all 11 dedicated Chromium demo checks passed. The focused six-test suite passed again after login fail-closed changes. Browser coverage includes the five-page flow, disabled JavaScript, wrong credentials, unknown plate, native PDF handoff, all six real PDF.js/status/barcode paths, barcode editing, shared/lessee rendering, local-only HTTP requests, no credential transmission, reset and mobile fitting. Independently decoded all six rendered PDF417 images to exact expected payload bytes. Visually inspected synthetic landing/status screenshots; artifacts remain ignored. A private source scan confirms nine captured hidden token values are absent from new prototype source. No live DMV request was submitted. General 91-check extension/theme/full barcode suites were not rerun; installed-extension testing remains blocked by managed policy.

## v1.8.40 Merge — 2026-11-18

- The user invoked Merge TB. The sole test branch, fix/v1.8.40-background-navigation (27a5f019e43dc93810af4344947e9cc24f5bad28), merged into main without conflicts in merge commit 8a03316. Local/remote test tips matched and main was current with origin/main. Release files remain synchronized at 1.8.40; this documentation-only merge record requires no patch bump.
- Includes serialized blank/login startup, pending-login recognition, one bounded initial-login recovery before submission, cancellation/manual-control safeguards and contextual navigation rejection messages. Application and test files match the tested branch tip exactly.
- Verified on merged main: npm run check, git diff --check, all 312 unit tests and the complete 91-check general Chromium/fixture suite passed. No live DMV transactions were submitted. Barcode decoder, theme and private-PDF checks were not rerun. Managed policy still prevents installed-extension/native Windows verification; the specific native cause of the reported rejection remains unconfirmed here, as recorded in the revision entry below.
- Merge TB authorizes pushing main and deleting only this merged test branch locally/remotely after successful push and confirmation of its unchanged remote tip, using an explicit expected-tip lease. Preserve the unrelated local work branch and verify live refs before future branch work.

## v1.8.40 Background Startup Navigation Rejection — 2026-11-18

- The user invoked New PTB after reporting an almost-immediate Navigation rejected error after submitting a background search; they confirmed foreground searches still work. Created fix/v1.8.40-background-navigation from latest main 4b0ea68 and synchronized manifest, package, lockfile/root entry and README to 1.8.40. Main remains unchanged.
- Chromium's tabs.update implementation emits the generic Navigation rejected message when its content-layer navigation handle is unavailable; it does not identify a specific DMV response or underlying native cause (reference: https://github.com/chromium/chromium/blob/main/chrome/browser/extensions/api/tabs/tabs_api.cc). Found two startup races: navigating a newly created blank tab before it is ready, and re-requesting LOGIN from shared login while the helper's first navigation still has an old committed URL. Three initial regressions reproduced rejection/failure before the fix. These are verified code/fixture failure modes, not confirmation of the user's exact Windows trigger.
- After the existing minimized-state verification, wait for the owned blank tab to finish with no pending navigation (10-second bound). Start LOGIN once and wait for completed commitment before shared automation (60-second bound). Shared login also recognizes an already-pending LOGIN and waits rather than accepting the previous completed page or requesting login twice. Both waits remain cancellation-guarded. Manual restoration is respected; no extra minimization or browser/tab focus is introduced.
- A native rejection at the initial LOGIN GET permits one delayed retry only after confirming the same owned helper remains blank. If LOGIN is already pending/committed, await it without retry. A moved or manually navigated tab stops startup and is retained. No credentials/search number have been submitted at this recovery point; query-form navigation, result publication and submitted transactions are not automatically retried. Persistent startup rejection names the hidden login step, states no search was submitted and suggests using foreground searches.
- Added a non-retrying navigateTab adapter to label generic native rejections at login, DMV search-form and captured-PDF viewer navigation. Errors include fixed stage text rather than identifiers or mutable report URLs. Existing cleanup still preserves a reused viewer after failed navigation and removes only owned helper/new-result allocations.
- Verification: npm run check, git diff --check, all 312 unit tests and the complete 91-check general Chromium/fixture suite passed. New coverage exercises blank initialization, delayed login commitment, a pending login with stale completed URL, one-time initial recovery, persistent rejection, accepted-pending navigation, Stop during blank loading, manual navigation preservation and contextual search-form errors without retry/submission. Worker coverage verifies contextual PDF-viewer rejection while retaining the reused report. Existing minimized/manual-control, blacklist, cancellation, inactive result/status popup, same-address completion, SCUTTIES, PDF extraction/printing and parser checks pass. No live DMV transactions were submitted; barcode decoder/theme suites were not rerun. Managed policy still blocks installed-extension/native Windows verification, so user retesting is required to establish whether this addresses the reported native failure.

## v1.8.39 Merge — 2026-11-18

- The user invoked Merge TB. The sole test branch, fix/v1.8.39-license-revocations (ad69f97533bccc6f15dae1dfae95c135ae16b0ef), merged into main without conflicts in merge commit 74f6e0b. Local/remote test tips matched and main was current with origin/main. Synchronized release files remain at 1.8.39; this documentation-only merge record requires no patch bump.
- Includes REVO parsing with revocation dates in the existing Active Suspensions / Pending Reinstatement totals, grouped expandable occurrences, offense-field isolation, and shared DUI/DUAC and IID handling. Application and test files match the tested branch tip exactly.
- Verified on merged main: npm run check, git diff --check, all 303 unit tests and 11 distinct targeted Chromium/fixture checks passed. Browser coverage includes mixed suspension/revocation columns and date labels, disclosure timers and full-size scrolling, IID styling/lifetimes, special DL privileges, TAL and driver identity settings/rendering/extraction. The general browser suite passed all 91 checks on the test branch; it was not rerun in full for this merge. Barcode decoder, theme and private-PDF checks were not rerun. Managed browser policy still prevents installed-extension/native Windows verification here.
- Merge TB authorizes pushing main and deleting only this merged branch locally/remotely after successful push and confirmation of its unchanged remote tip, using an explicit expected-tip lease. Preserve the unrelated local work branch and verify live refs before future branch work.

## v1.8.39 License Revocation Parsing — 2026-11-18

- The user invoked New PTB and supplied a private driving record as parsing test data, not instructions. Created fix/v1.8.39-license-revocations from latest main 4201887, with synchronized manifest, package, lockfile/root entry and README version 1.8.39. Main remains unchanged.
- The supplied record has Status - DL: SUSPENDED and a REVO block instead of SUSP, with Revocation Beg / Revocation End labels. Recognize REVO alongside SUSP/VIOL as a distinct block boundary. Use that block's own revocation dates with the existing end-date/reinstatement rules: future or INDEFINITE ends count in Active Suspensions; completed periods with future/INDEFINITE requirements count in Pending Reinstatement. Completed requirements do not enter either tally; unreadable end dates remain unreadable. The user explicitly confirmed both existing columns should include revocations.
- Group matching suspension/revocation reasons together, retaining existing Habitual Offender/DUS priority and DUI/DUAC grouping. Each expandable occurrence retains its own optional ticket, begin/end and Causal-as-Violation Date. Revocations carry a display flag so their details say Revocation Begin / Revocation End. Existing disclosure timeout resets and full-size scrolling remain intact. Shared offense boundaries also protect Current credentials, special privileges, header identity, DUS dates, DUI ticket deduplication and IID flags from neighboring REVO data. DUI/DUAC revocations participate in the same lookback and IID rules as suspensions. Ordinary status headings and voice selection remain unchanged.
- Privately checked the uploaded PDF through both pdftotext layout extraction and the actual bundled PDF.js reader in Chromium. Both yield the same alert: one active revocation, no pending reinstatement, correct revocation/causal dates and no invented ticket. Verified its real popup details. The upload, extracted text, private validation script and screenshot remain outside Git; committed regressions and browser screenshots use synthetic data. No live DMV requests were submitted.
- Verification: npm run check, git diff --check, all 303 unit tests and the complete 91-check general Chromium/fixture suite passed. New regressions cover ticketless REVO-only reports, mixed grouping, date boundaries/unreadable fields, block isolation, DUI/DUAC deduplication, IID scope, privilege/credential/identity boundaries, correct popup date labels and disclosure timer resets. Strengthened revocation assertions passed again in the focused seven-test suite. Barcode decoder and theme browser suites were not rerun for this parsing/UI-label change. Managed browser policy still prevents installed-extension/native Windows verification here.

## v1.8.38 Merge — 2026-11-18

- The user invoked Merge TB. The sole test branch, fix/v1.8.31-background-retry (ec1457512bdac7e7b20c9f105fa7e983eeedc671), merged into main without conflicts in merge commit 3ed598e. Local and remote test tips matched, and main was current with origin/main before merging. Synchronized release files remain at 1.8.38; this merge record requires no patch bump.
- Includes the minimized query-window transport and manual-control safeguards, background PDF extraction independent of painting, same-address completion focus with SCUTTIES excluded, results-tab reuse, nested status-alert settings, ordered registered owners with saved-number customer searches, temporary/shared-address/lessee parsing corrections, and 30-second ordinary valid alerts. Application and test files match the tested branch tip exactly.
- Verified on merged main: npm run check, git diff --check, all 296 unit tests, the complete 90-check general Chromium/fixture suite, and all 42 exact PDF417 decode checks plus barcode UI checks passed. No live DMV transactions or private-PDF checks were rerun for this merge. Theme browser checks were not rerun. Managed browser policy still prevents installed-extension/native Windows verification; existing user-confirmed hidden-window behavior is recorded in the revision entries below.
- Merge TB authorizes pushing main and deleting only this merged test branch locally and remotely after the push succeeds and its unchanged tip is confirmed. Remote deletion must use the exact expected-tip lease; preserve the unrelated local work branch. Verify live refs before future branch work.

## v1.8.38 Supplied Vehicle Layouts, Owner Search Buttons and 30-Second Valid Alerts — 2026-11-18

- Continued on fix/v1.8.31-background-retry with synchronized version 1.8.38. The user supplied three private tag PDFs as parsing test data (not instructions), requested temporary-tag/date/year corrections, omitted shared-address handling, registrant/lessee parsing, and later added 30-second valid alert timeouts and clickable owner names launching saved customer numbers. Main remains unchanged.
- The temporary example uses T60V, absent from the prior recognized class list. Added T60V to the shared classifier used by status, strict barcode mapping and recovery drafts. Temporary status uses Plate Exp Date; a blank temporary decal date inherits plate expiry in barcode RBT, and the space-separated display year is removed from the plate field. Existing populated decal fields, ordinary-plate behavior and manual recovery for genuine invalid values remain intact.
- The co-owner example omits the second Owner Address label entirely. Track label presence separately from an empty value: later owner/customer entries of the first party’s same category inherit that first registered address only when the address label is omitted. Explicit blanks, unrelated categories, lessee blocks and mailing addresses do not trigger inheritance. This exception applies to popup display; strict incomplete-party barcode behavior remains conservative.
- The registrant example labels the address Lessee Address. Recognize Lessee Address / Registrant Address as boundaries and address aliases in registrant-lessee blocks, both for popups and selected-party barcode/draft mapping. They no longer enter the business/name field or borrow the first owner’s address. The source lessee ZIP contains ten digits; retain it as supplied for display and require manual correction before encoding that party rather than guessing a valid ZIP.
- Owner display entries retain canonical customer numbers parsed from their own Number fields, including C0/leading-zero normalization. Names with valid numbers become keyboard-accessible buttons. The alert-owner-search handler validates the current plate panel/run, owning sender URL and index, reads the saved number from the panel entry and starts the normal customer dispatch with no input prompt. View-supplied numbers are ignored; normal vault/blacklist checks run before navigation. Names/addresses/numbers stay out of voice and persistent preferences, and expired panels cannot be replayed.
- Normal success alerts for tags, DLs and customers now use 30 seconds, including TAL/special-privilege valid licenses. Danger/warning alerts and valid-license IID warnings retain 90 seconds. Updated countdown behavior tests and Settings wording.
- Privately validated all three uploaded PDFs through the actual bundled PDF.js reader, owner popup rendering and default registration barcode generation. Checked temporary plate/date fields, shared co-owner addresses, clean lessee name/address separation, valid owner search buttons and independently decoded all three generated PDF417 images to exact payload equality. Private PDFs/extracts/barcode artifacts and validation scripts remain outside Git. No live DMV searches were submitted during these checks; committed regressions use synthetic layouts.
- Verification: npm run check, git diff --check, all 296 unit tests, the full 90-check general Chromium/fixture suite and 42 exact PDF417 decode checks passed. New synthetic decoder cases cover T60V and short lessee-address labels. Focused tests cover saved-ID normalization, co-owner omission versus explicit blanks, lessee independence, mouse/keyboard activation, stale/foreign panels, ignored view-supplied numbers, normal blacklist blocking and 30-second valid deadlines; existing 90-second IID/danger behavior passes. The three private PDFs also passed actual PDF.js extraction, popup/default-barcode generation and independent exact PDF417 decoding outside Git. Secondary-lessee strict barcode mapping correctly refuses the source’s ten-digit ZIP; no digit was guessed or removed. Theme browser checks were not rerun. Managed policy still prevents installed-extension/native Windows verification here.

## v1.8.37 Nested Photo Setting and Registered Owners on Tag Alerts — 2026-11-18

- Continued on fix/v1.8.31-background-retry with synchronized version 1.8.37. The user requested the DL photo setting as a sub-toggle under status alerts and registered owner names/addresses beneath vehicle information on tag popups, preserving report order. Main remains unchanged.
- Grouped the existing combined Show driver photo and name toggle with background search inside statusAlertSettings, beneath the status-alert master. The master controls visibility/aria-expanded; collapsing it preserves both choices and existing preference keys. Voice settings stay independent. No new photo/name split or owner-display setting was requested or introduced.
- Plate parsing now attaches ordered owners from numbered Owner/Customer/Registrant-Lessee registration blocks within the vehicle body. Bound fields by recognized labels and block/category, including Relationship/Mailing Address boundaries and enforcement/footer limits. Preserve literal Unicode/business/person names and raw complete addresses; missing fields never borrow a later identity or mailing address. Each reported entry retains its order.
- Render the registered-owner ordered list beneath the vehicle grid on valid/expired/suspended/unavailable tag popups when data is present. Missing names/addresses display Unavailable labels. Use textContent and white supporting text with the existing window height/font fitting; status headings retain their size. Owner details are independent of the optional driver photo/name control, omitted from voice announcements and persistent preferences, and retained only in the existing trusted-session report/alert lifecycle. Barcode mapping is unchanged.
- Added parser regressions for multiple party labels/order, whitespace/Unicode, missing fields, all status paths, voice exclusion and body boundaries. Worker coverage checks owner payloads while driver identity is off and no owner data enters local preferences. Browser checks cover nested setting visibility/retained choices, owner order/placement across statuses, literal-text rendering and missing fields, and multi-owner window fitting. Synthetic screenshots remain in ignored test-results; no private records or identifiers are committed.
- Verification: npm run check, git diff --check, all 287 unit tests and the full 89-check general Chromium/fixture suite passed. The focused 15-check owner/worker run and nested-settings browser check also passed. After screenshot review, strengthened and reran the six-owner fitting check to require the Close button visible at initial scroll position; the viewport capture shows all six owners and the unchanged 36px status heading. Full-page screenshot capture itself could trigger resize/refitting, so that artifact now uses the viewport. Product fitting code was not changed. Theme and barcode decoder browser suites were not rerun. Tests use synthetic fixtures; no private vehicle PDF or live DMV response was inspected for this revision. Managed policy prevents installed-extension/native Windows verification here.

## v1.8.36 Reuse Hidden-Query Results Tabs — 2026-11-18

- Continued on fix/v1.8.31-background-retry with synchronized version 1.8.36. The user reported that each query creates another DMV PDF results tab and requested reuse of the previous tab. Main remains unchanged.
- Hidden report publication now reuses the newest tracked query viewer in the destination normal browser window. Selection validates this extension's reader URL, pdf/query flags, job ID, recognized source matching session pdfSources and timestamp; a fresh tab read protects a user who closed/moved/navigated the candidate while it was selected. Old-version query viewers can be adopted. If none remains eligible, create one inactive results tab. Existing duplicates, user pages and native print views are not closed or repurposed.
- Reuse changes only the report URL and preserves tab selection/window focus. Same-address results still intentionally focus after capture/history; plate/DL/customer status-popup flows remain passive and SCUTTIES remains foreground. Helper startup/minimization/manual-control behavior is unchanged.
- Every report receives fresh immutable bytes and a new reader job, expected URL and document binding. Cancel old capture work and serialize its session snapshot writes with reuse invalidation, clearing prior text/photo data before publication. Handshakes from old URLs and results from stale documents/jobs or before first handshake are rejected. Failed navigation never closes a reused report tab; only a newly allocated blank result may be cleaned up on failure.
- Added selection and real-worker-model regressions for previous-version/newest eligible viewers, excluded/moved/pending/native/untracked targets, same-ID tab reuse with fresh bytes/identity/cache/document, manual navigation during selection, closed targets, failed navigation and a deliberately delayed old snapshot write. Existing worker tests now model fresh document IDs when the same tab navigates and wait for new job URLs instead of assuming new tab IDs.
- Verification: npm run check, git diff --check, all 281 unit tests and the complete 86-check general Chromium/fixture suite passed. Eleven focused selection/worker tests passed, including successive same-tab reports, fresh job/document/byte identity, stale-message rejection, closed/navigated targets, failed navigation and a delayed old snapshot write. Existing hidden startup/manual-control, same-address completion, SCUTTIES foreground, paused-frame extraction, photo/placeholder, cancellation, PDF display and immutable printing checks pass. Theme and barcode decoder browser suites were not rerun. Live installed-extension/Windows validation remains for user testing; managed policy prevents extension installation here.

## v1.8.35 Same-Address Queries Hidden, Results Focused — 2026-11-18

- The user confirmed v1.8.34 fixed hidden-window startup, then requested hidden navigation for all queries and focused results for queries without a status popup. They explicitly excluded SCUTTIES in a follow-up. Continued on fix/v1.8.31-background-retry with synchronized version 1.8.35; main remains unchanged.
- Added same-address/address searches to the existing hidden transport, including Recent-history replays. Plate/DL/customer queries and customer collection/queue/history paths retain their existing hidden navigation and inactive results/status-popup behavior. SCUTTIES retains its existing foreground workflow. Local PDF/barcode tools are not DMV navigation queries.
- Same-address reports have no status popup, so explicitly select their completed result tab and restore/focus its normal browser window after immutable PDF capture, helper cleanup, publication and the normal resultReady/history commit. Ordinary focusTab is called without queryTask for that completion step only. All navigation still uses the verified initially minimized helper, and manual restoration remains respected. Guarded focus suppresses stale results after cancellation/replacement. Same-address history, blacklist-as-license checks and session report snapshots retain the shared workflow.
- Updated Settings wording and active documentation to describe same-address completion focus and the SCUTTIES exception. New transport/worker checks exercise hidden address navigation, its form field, one submission, immutable capture/history-before-focus ordering, main-window restoration, absence of a status popup and cancellation before result focus. Existing status-backed result checks still reject browser activation.
- Verification: npm run check, git diff --check, all 274 unit tests and the full 86-check general Chromium/fixture suite passed. The four worker integration checks passed again after strengthening the history-commit assertion. Coverage includes the new same-address routing/completion/cancellation policy, existing foreground same-address and SCUTTIES DOM workflows, background settings wording, inactive alert-backed results, paused-frame parsing/photo extraction and immutable printing. Theme and barcode decoder browser suites were not rerun. Native Windows behavior for the extended same-address completion flow remains for user testing; managed policy still prevents installed-extension testing here.

## v1.8.34 Verify Helper Minimized Before DMV Navigation — 2026-11-17

- Continued on fix/v1.8.31-background-retry with synchronized version 1.8.34. The user confirmed the status-popup issue is fixed but reported that the query window still appears over other apps immediately at search start. This narrows the current issue to initial window creation; navigation-time restoration was not reported. Main remains unchanged.
- Replaced direct DMV-in-popup creation with an unfocused, initially minimized **regular** window containing only about:blank. Verify Chrome's actual window state before any DMV URL loads. If Chrome ignores the requested state, issue one minimize update on this newly owned blank helper and verify again. If still not minimized, stop before navigating/submitting and close the owned blank tab. The result destination is still resolved before helper creation.
- No ongoing state/focus enforcement was added. After initialization, manually restored helpers remain restored, existing browser windows/tabs are not minimized or reselected, and moved tabs/unrelated pages are retained. Cancellation during initial creation/minimization cannot open a DMV page afterward. The working text-before-paint/photo-extraction fix from 1.8.33 is retained.
- Added backend regressions for ignored creation state, correction-before-navigation ordering, failed minimization stopping without submission, cancellation during minimization, and manual restoration without a second minimize call. These use browser API models; native Windows behavior is still pending user validation. The managed browser blocks installed-extension testing here. An attempted official Chromium-source lookup was rate-limited (HTTP 429); no new native/API root cause is claimed from that lookup.
- Verification: npm run check, git diff --check, all 271 unit tests, and five targeted Chromium/fixture browser checks passed. All 13 focused backend/worker checks passed, including startup ordering/failure/cancellation/manual-restoration cases. Targeted browser checks cover the background preference, PDF handoff, immutable printing, and parsing/photo extraction with paused display frames. The full general/theme/barcode browser suites were not rerun for this backend startup revision; the full 86-check general suite passed at 1.8.33. Native Windows behavior remains pending user testing.

## v1.8.33 Background Alert Parsing and Minimized Query Window — 2026-11-17

- Continued on fix/v1.8.31-background-retry and synchronized release files to 1.8.33. The user reported that the offscreen method failed, the unfocused method successfully queried but required selecting the results tab before its status popup appeared, and its helper remained visible over other applications. Main remains unchanged; no merge or environment publication is requested.
- Removed the offscreen query method, selector, iframe host/frame bridge, query-specific audio lease and tests for that removed transport. Preference migration drops the retired method while retaining the background toggle and other saved choices. Offscreen support remains for existing voice audio. Retained the generated MAIN postback handoff as background-report.js, generated by tools/build-background-report.mjs and checked by npm run check; it applies only to top-level DMV pages with the expiring owned-query marker.
- Identified the Reading PDF/status delay: reader.js awaited openDarkViewer before reporting extracted text, and PDF.js display rendering uses requestAnimationFrame, which can pause in inactive/minimized tabs. The reader now sends parsed text and optional identity before starting independent display rendering. Optional photo crops use PDF.js print intent to render without animation frames; this does not invoke browser printing. PDF view state is tracked separately as loading/ready/error. Rendering failures after parsing are local and never submit a second result using the consumed job ID. The original loaded document remains available for immutable printing without waiting for paint or the worker ACK.
- Create the owned query popup with focused:false and state:minimized, without width/height (Chrome disallows those dimensions together with minimized creation). This requested initial state was intended to keep query navigation hidden; subsequent v1.8.34 user feedback confirmed it did not reliably take effect at creation. There is no ongoing minimization/focus/tab-restoration guard: a manually restored helper remains restored during navigation, and existing browser windows/tabs are never suppressed. Cleanup still preserves moved tabs and unrelated user pages. Native Windows behavior needs user validation.
- Added a browser regression that pauses display animation frames and confirms parsing/status data and optional photo extraction finish without selecting the PDF tab. It checks original/dark colors and identity on/off, then resumes frames and verifies normal rendering with exactly one reader result. Worker coverage confirms parsed text triggers status while the report stays inactive and the browser remains modeled as minimized. UI/migration tests verify selector removal and preserved opt-in.
- Verification: npm run check, git diff --check, all 267 unit tests, and the full 86-check general Chromium/fixture suite passed. The new paused-display test covers four color/identity combinations; existing real PDF rendering, identity/no-photo, cancellation, continuous text selection, native immutable printing and status-popup checks pass. Theme and barcode decoder browser suites were not rerun. Installed-extension/Windows focus and initial minimized-query-window behavior remain for user testing; the managed browser policy still prevents extension installation here.

## v1.8.32 Two Background Search Prototypes — 2026-11-17

- Continued on fix/v1.8.31-background-retry. The user explicitly requested both an offscreen iframe and a separate unfocused query window, with a Settings selector to compare them. Synchronized release files to 1.8.32 under the standing preference to bump each implementation revision. Main remains unchanged; no merge or environment publication is part of this work.
- Added a default-off background toggle immediately below status popups, revealed only while popups are enabled. Its saved method selector offers Separate unfocused query window (default) and Offscreen iframe. Plate/license/customer searches, including customer queue/history flows, use the selected transport. Address and SCUTTIES retain foreground behavior. Disabling popups preserves the preference but disables background routing for new searches.
- The window prototype creates a normal-sized unfocused popup with an active query tab. It never restores/minimizes existing windows, reselects a previous tab, or runs a focus-enforcement observer. Cleanup targets only its own portal tab still in the helper window; moved tabs and unrelated pages are retained. There is no supported Chrome invisible-window primitive, so the helper may remain visible behind other applications.
- The offscreen prototype uses bundled offscreen-query.html with a sandboxed DMV iframe, not a DMV URL passed to createDocument. A serialized lease shares Chrome's single offscreen document with existing audio; stop/audio work cannot close a running iframe query prematurely. Origin/source/navigation-token checks restrict the frame bridge. The MAIN adapter is generated from pageOperation; npm run check enforces regeneration after changes. No site framing/CSP/cookie restrictions or managed installation policy are bypassed.
- Both transports preserve normal blacklist checks and pre-submission session recovery. They intercept the owned Download handoff, including blank window handles, attachment links, and postback handoffs via an expiring tab-local marker. Unsupported report flows stop without automatic alternate-method submission. Immutable bytes are captured in the query context before helper cleanup, then delivered to a job/tab/document-bound reader in an inactive normal-window tab. Original/dark colors, native immutable printing, session snapshots, identity opt-in and status/audio analysis use the existing pipeline. Reader reloads do not refetch an old mutable attachment URL.
- Research used official Chrome documentation source: an offscreen document requires bundled HTML, can embed cross-origin iframes with content scripts, exposes runtime extension APIs only, and is limited to one per profile. Live DMV/login and documentation-site HTTP requests were denied by the environment proxy; DMV frame headers, authentication cookies, and native installed-extension/Windows focus behavior remain unverified and require user testing. The managed browser blocks extension installation here. README contains the method comparison and test procedure.
- Found a pre-existing general-browser assertion failure on unchanged main 19c7cdb: after the combined tally change, the suspension-detail fixture fits at 760px without shrinking, while its test still expected compression. Reduced only that test's simulated work area to 600px; the targeted compression/restore check passes. Product popup layout code is unchanged.
- Verification: npm run check, git diff --check, all 272 unit tests, and the full 85-check general Chromium/fixture suite passed. All 15 focused transport/worker/trust-boundary checks were rerun after the final publication-lifecycle adjustment. New checks cover both methods, opt-in gating, pre-submit protection callbacks, one submission/no fallback, inactive byte-bound report delivery, status timing, stale/cross-document rejection, cancellation and late helper creation, shared offscreen ownership, bridge origin/token checks, persistent postback handoff, settings persistence, original-color viewing and immutable printing. Theme and barcode decoder browser suites were not rerun. Live DMV/installed-extension/Windows focus validation remains pending as described above.

## v1.8.31 Restart After Discarded Background Experiments — 2026-11-17

- The user rejected both background-search implementations on fix/v1.8.31-patch-test (final tip 29fa449, version 1.8.33), explicitly requested deletion of that unmerged branch, and requested a new test branch under version 1.8.31.
- Created fix/v1.8.31-background-retry directly from main 19c7cdb (version 1.8.30). Only synchronized release version files and this context entry differ from main; the abandoned background-search setting, focus policies, state-enforcement guard, and experimental tests are not included. Main remains unchanged.
- The forced minimization/tab-restoration guard fought manual browser control, while the later passive approach still failed native user testing. Treat both as discarded approaches, not verified fixes. The subsequent v1.8.32 request specifies separate query transports; neither abandoned implementation is restored.
- Reset release files to 1.8.31 at the user's explicit request. This supersedes the usual increment for this restart. Future changes should follow the current versioning preference unless the user directs otherwise.
- Verified npm run check, git diff --check, and equality of application/test/tool sources with main. Application tests were not rerun for this version-only fresh branch preparation.

## v1.8.30 Merge — 2026-11-17

- The user invoked Merge TB. The sole current test branch, fix/v1.8.28-patch-test (1c99b0d), merged into main without conflicts in merge commit 079868d. Synchronized release files declare version 1.8.30.
- This merge includes the optional driver photo/name preference, job-bound session-only photo extraction, standard no-photo placeholder suppression, and the combined active/pending suspension tally line. Application and test files match the tested branch tip.
- Verified on merged main: npm run check, all 257 unit tests, and ten distinct targeted browser checks covering identity preferences/rendering/extraction/placeholder guards, the combined suspension tally, and five initial window-fitting/alignment cases. The full general browser suite passed on the earlier v1.8.29 branch revision; it was not rerun for this merge. Theme/barcode suites were not rerun; installed-extension validation remains blocked by managed policy.
- Merge TB authorizes deleting only this merged test branch locally and remotely after main is successfully pushed and its unchanged test tip is confirmed. Verify actual remote state before future branch work.

## v1.8.30 Combined Suspension Tally Line — 2026-11-17

- Continued on fix/v1.8.28-patch-test with synchronized release version 1.8.30. Main remains unchanged.
- The pending reinstatement tally now follows the active suspension total in the same status line, separated by a middle dot (for example, 7 active suspensions · 4 pending reinstatement). Zero-pending results retain the active tally alone. Reason columns, expandable occurrence details, parsing, and voice behavior are unchanged.
- Verified npm run check, git diff --check, all 48 focused status/suspension/report-layout unit tests, and six targeted browser checks including single-line tally rendering and initial window fitting/alignment. Full unit/general browser/theme/barcode suites were not rerun for this display-only revision.

## v1.8.29 Optional Driver Photo and Name — 2026-11-17

- Continued on fix/v1.8.28-patch-test; synchronized release files declare 1.8.29. Main remains unchanged.
- Added Settings → Show driver photo and name, default off, persisted via validated alert preferences with a session mirror. The option applies to newly captured reports. License/customer status alerts show the driver's header name and available photo beneath the main status; plate and blacklist alerts do not receive identity cards. Names and images never enter voice announcements.
- An opted-in, job-bound PDF.js reader extracts only an unambiguous portrait-sized image in the first-page header, using the PDF's graphics transforms and original loaded document. Unknown/ambiguous layouts retain name-only display rather than guessing another image. Images use bounded inline PNG data, validated at worker receipt and display. Identity is stored only in the existing session report snapshot/popup payload; only the boolean preference persists locally. No old mutable report URL is refetched to obtain a photo.
- The user supplied a second no-photo example. Both supplied placeholder records match the known standard No Photo Available graphic, while the real-photo record does not. Detection uses a central text-only perceptual signature excluding identifying border text, with white/ink limits and bounded resampling tolerance. Matches suppress the PNG and show only the name plus No photo available text. Other unsupported artwork is not guessed to be a placeholder.
- Verified all three private PDFs through the actual bundled PDF.js reader and popup: the real portrait displayed, both placeholders were hidden, and each name matched its report header. Six additional rescale/JPEG/replaced-edge-identifier checks passed. Only non-identifying placeholder glyph geometry is encoded in the matcher; uploaded documents, portraits, names, identifiers, and extracted text remain outside Git. Committed regression data is synthetic.
- Verification: npm run check, all 257 unit tests, and the complete 82-check general browser/fixture suite passed. Coverage includes preference persistence/defaults, worker gating/session-only identity, requested-reader ownership, opt-out extraction, header image selection and ambiguity, no-photo false-positive guards, display escaping, and existing PDF rendering/printing/cancellation. Theme and barcode decoder suites were not rerun; installed-extension validation remains blocked by managed browser policy.

## v1.8.28 Patch Test Branch Preparation — 2026-11-17

- The user invoked New PTB. Created fix/v1.8.28-patch-test from latest main a3af3e5. Synchronized manifest, package, lockfile (including its root entry), and README release version from 1.8.27 to 1.8.28.
- Version-only preparation; no implementation work was requested or added. Main remains unchanged. Further code/UI revisions on this branch require another patch increment.
- Validation: npm run check and git diff --check passed. Application tests were not rerun for this version-only preparation.

## v1.8.27 Merge — 2026-11-17

- The user invoked Merge TB. The sole current test branch, fix/v1.8.25-patch-test (58f80d5), merged into main without conflicts in merge commit 00da64a. Synchronized release files declare version 1.8.27.
- This merge includes expandable suspension occurrences, individual reason mini headers, optional ticket numbers and dates, timeout resets on disclosure toggles, and full-size scrollable text after the first toggle. Application and test files match the tested branch tip.
- Verified on merged main: npm run check, all 254 unit tests, and ten distinct targeted browser checks covering occurrence details, pointer/keyboard toggles and timeout resets, full-size scrolling, five initial window fitting/alignment cases, suspension columns, and suspended-popup rendering. Full general browser/theme/barcode suites were not rerun for this merge; installed-extension validation remains blocked by managed policy.
- Merge TB authorizes deletion of only this merged branch locally and remotely after main is successfully pushed and the unchanged test tip is verified. Confirm actual remote state before future branch work.

## v1.8.27 Readable Suspension Detail Scrolling — 2026-11-17

- Continued on fix/v1.8.25-patch-test with synchronized release version 1.8.27. Main is unchanged.
- Initial popup height/font fitting remains in effect. Once a user expands or collapses any suspension group, restore the original text sizes and allow scrolling for the rest of that popup. Stop automatic refitting on subsequent window-bound/resize events so detail text is not reduced again. The main status heading retains its existing size, and opening/closing groups still refreshes the normal alert deadline.
- A scrolling-mode guard prevents pending asynchronous fitting from shrinking text or resetting the user's scroll position after details are used. Existing native window placement remains where initial fitting positioned it.
- Verified npm run check, git diff --check, and eight targeted browser checks covering restoration after initial compression, persistent scrolling after collapse/resize, missing-ticket and literal-text details, timeout resets, and the five initial window-fitting/alignment cases. Unit/full browser/theme/barcode suites were not rerun for this UI-only change; installed-extension validation remains blocked by managed browser policy.

## v1.8.26 Expandable Suspension Details — 2026-11-17

- Continued on fix/v1.8.25-patch-test; synchronized release files declare 1.8.26. Main is unchanged.
- Each grouped Active Suspensions or Pending Reinstatement reason is a keyboard-accessible details/summary disclosure. Expanding shows one occurrence row per contributing SUSP block, with an individual reason mini header (DUI/DUAC members retain distinct DUI or DUAC headers), optional ticket number, Suspension Begin, Suspension End, and Causal date labeled Violation Date. Missing dates display Unavailable; missing tickets are omitted. Text is rendered with textContent and never interpreted as HTML.
- Occurrences retain their original ticket spelling/leading zeroes and stay bound to their own suspension block. The existing group count, reason priority, active/pending classification, offense deduplication, and audio headings remain unchanged.
- Expanding or collapsing resets the alert's normal timeout and refits its window. The layout controller now returns a reusable fitting callback and includes hidden detail text in its original font measurements, preserving top-left anchoring, readable supporting text, and fixed main status size.
- Verified npm run check, all 254 unit tests, nine distinct targeted browser checks (disclosure rows/headers, pointer and keyboard toggles, timer resets, pending details and literal text, suspension summaries, and five native-window sizing/alignment cases). Both supplied private PDFs were extracted through PDF.js and pdftotext with matching data; every rendered disclosure row was checked against parsed occurrences. One missing Causal date is displayed as Unavailable rather than inferred. Private PDFs, identifiers, ticket values, and extracted text remain outside Git; committed regressions are synthetic.
- Full general browser/theme/barcode suites were not rerun for this focused change. Installed-extension validation remains blocked by managed browser policy.

## v1.8.25 Patch Test Branch Preparation — 2026-11-17

- The user invoked New PTB. Created fix/v1.8.25-patch-test from latest main b7e900f. Synchronized manifest, package, lockfile (including its root entry), and README release version from 1.8.24 to 1.8.25.
- Version-only preparation; no implementation work was requested or added. Main remains unchanged. Further code/UI revisions on this branch require another patch increment.
- Validation: npm run check and git diff --check passed. Application tests were not rerun for this version-only preparation.

## v1.8.24 Merge — 2026-11-17

- The user invoked Merge TB. The sole current test branch, fix/v1.8.21-patch-test (ecdc331), merged into main without conflicts in merge commit 17379b2. Synchronized release files declare version 1.8.24.
- This merge includes the suspension/reinstatement split, DUI/DUAC counting, IID warnings, popup height/text fitting, active-reason priority order, and top-left status-window alignment developed on the test branch. Application and test files match its tested tip.
- Verified on merged main: npm run check, all 252 unit tests, and 11 distinct targeted browser checks covering window positioning/fitting, suspension columns, IID warnings/lifetime, suspended and normal green alerts, special DL privileges, and TAL alerts. Full general browser/theme/barcode suites were not rerun for this merge; installed-extension validation remains blocked by managed policy.
- The command authorizes deleting only this merged test branch locally and remotely after successful main push and confirmation that its tip remains unchanged. Confirm actual remote state before future branch work.

## v1.8.24 Status Alert Top-Left Alignment — 2026-11-17

- Continued on fix/v1.8.21-patch-test with synchronized release version 1.8.24. All record-alert windows, including license, plate, and blacklist alerts, align to screen.availLeft / screen.availTop on their current monitor. This includes short alerts that require no height increase and monitors with negative desktop coordinates or reserved top/left work-area space.
- Existing work-area height limits, supporting-text fitting, unchanged status-heading size, and initial top scroll position remain in effect. No extra display permission is requested.
- Verified npm run check, git diff --check, and all five targeted alert-window browser checks, including short-alert alignment, negative coordinates, height fitting, IID details, and denied-window-update fallback. Browser checks use native-window mocks with real Chromium viewports. Unit/full browser/theme/barcode suites were not rerun for this window-positioning-only revision; installed-extension testing remains blocked by managed policy.

## v1.8.23 Alert Window Fitting and Reason Order — 2026-11-17

- Continued on fix/v1.8.21-patch-test with synchronized release version 1.8.23. The environment publication retained these uncommitted changes after the earlier disconnect; they were inspected rather than reapplied. Main remains unchanged.
- Status alerts measure their rendered content and grow vertically within the current monitor work area, accounting for browser window decoration and taskbar space. Growth adjusts the top coordinate when needed, including monitors with negative coordinates. If available height is insufficient, supporting text shrinks to fit with a 12px floor (originally smaller text stays at its original size). Main status headings never shrink. Extremely short screens retain scrolling rather than clipping content or making supporting text unreadable.
- Close receives focus with preventScroll, and initial layout resets scroll to the top so the license status remains visible. Resizing refits the alert, restores full supporting text when space permits, and falls back to a readable, dismissible alert if native resizing fails. No extra display permission is requested.
- Active reason groups prioritize Habitual Offender, then Driving Under Suspension, followed by the existing descending-count/name order. Pending Reinstatement ordering is unchanged.
- Verified npm run check, all 252 unit tests, and six distinct targeted browser checks: four window-fitting cases plus suspension columns and IID warning styling/lifetime. Browser checks use native-window API mocks with real Chromium viewports; installed-extension validation remains blocked by managed policy. Full browser/theme/barcode suites were not rerun for this focused revision.

## v1.8.22 Suspension and DUI/DUAC Parsing — 2026-11-17

- Work continues on fix/v1.8.21-patch-test; synchronized release files now declare 1.8.22. Main is unchanged.
- Suspension End is the classification rule: future date/INDEFINITE counts as active. A completed period with future/INDEFINITE Reinstatement Requirements Met counts separately as Pending Reinstatement. An end date equal to today is completed; a reinstatement date equal to today is satisfied. Invalid/missing end dates remain unreadable, not guessed. The previous begin-date guard and classification of indefinite reinstatement as active were superseded by the user's end-based rules.
- Suspended popups retain Suspension Reasons: and show grouped Active Suspensions on the left, with Pending Reinstatement on the right only when needed; narrow displays stack the columns. The pending tally appears beneath the active tally. DUI and DUAC share the DUI/DUAC reason group independently in each bucket.
- Added the combined ten-calendar-year inclusive DUI/DUAC count beneath the existing five-year DUS line. Match offense blocks by ticket number, preserving leading zeroes and normalizing case. Prefer a matching VIOL Violation date; otherwise use SUSP Causal dates. Future/invalid dates do not count; missing tickets are not guessed to be the same offense.
- Any DUI/DUAC suspension block with IID Required: Y adds the centered heading-sized red IGNITION INTERLOCK DEVICE REQUIRED warning, independent of offense age and main license status. It changes a valid popup timeout to 90 seconds while leaving the normal license status, status color, and voice announcement unchanged. Other valid alerts remain at 10 seconds.
- Verified both privately supplied PDFs through pdftotext and the actual bundled PDF.js reader in Chromium; both paths returned identical parsed results. Uploaded records/extracted text remain outside Git; new regression fixtures are synthetic. No private identifiers or uploaded PDF bytes were added to source.
- Verification: npm run check, all 251 unit tests, and four distinct targeted browser checks (suspension columns, IID styles/lifetime, suspended popup, ordinary green popup) passed. Full general browser/theme/barcode suites were not rerun for this focused change. Installed-extension testing remains blocked by managed browser policy.

## v1.8.21 Patch Test Branch Preparation — 2026-11-17

- The user invoked New PTB. Created fix/v1.8.21-patch-test from latest main 969e072, incrementing release versions from 1.8.20 to 1.8.21 in manifest, package, lockfile (including the root entry), and README.
- This is version-only preparation; no implementation work was requested or added. Main remains unchanged. Further code/UI revisions on this branch require another patch increment.
- Validation: npm run check and git diff --check passed. Application tests were not rerun for this version-only preparation.

## v1.8.20 Merge — 2026-11-17

- The user invoked Merge TB. The sole current test branch, fix/v1.8.20-special-dl-privileges (5e00ecc), merged into main without conflicts in merge commit 9f5f709. Release version is 1.8.20. The reusable Merge TB skill is now included in main.
- Verified on merged main: npm run check, all 244 unit tests, the special-DL-privilege browser check covering valid/expired/suspended styling, and the TAL popup browser check passed. Application and test files match the tested branch. Full browser, theme, and barcode suites were not rerun for this merge.
- The command authorizes deleting only this merged branch locally and remotely after successful main push and verification of the unchanged test tip. Confirm actual remote state before future branch work.

## v1.8.20 Special DL Privileges Patch — 2026-11-17

- Created fix/v1.8.20-special-dl-privileges from main at the user's request; synchronized release files declare 1.8.20. This patch is not merged to main.
- Normal license evaluation runs first. A populated report-level Special DL Privilege: line is displayed beneath VALID LICENSE, LICENSE EXPIRED, or LICENSE SUSPENDED with the same heading color, size, weight, and centered alignment. It does not grant validity or change expiration, suspension summaries, timeout, or audio selection.
- Display text is inserted with textContent. Neighboring known fields delimit flattened text; line breaks delimit ordinary extraction. Repeated values are deduplicated; blank, NONE, N/A, and NOT APPLICABLE values are omitted. Suspension-entry Special Driving Privilege: fields are separate and are not displayed by this rule. The existing TEMPORARY ALCOHOL LICENSE label is not duplicated for the matching privilege value.
- Verified npm run check, all 244 unit tests, the synthetic browser check covering valid/expired/suspended privilege styling and literal text, and the existing TAL popup browser check. The previously supplied TAL text still produces the same single qualifier. No real example of a different special privilege was supplied; those layouts remain validated with synthetic fixtures only. Full browser, theme, and barcode suites were not rerun. Managed policy still blocks installed-extension testing.

## v1.8.19 Merge — 2026-11-17

- The user confirmed the TAL popup works and authorized merging and deleting the test branch. Merged fix/v1.8.19-temporary-alcohol-license (f792333) into main without conflicts in merge commit cfe2c75. Release version remains 1.8.19.
- Verified on merged main: npm run check, all 240 unit tests, and the targeted TAL popup browser check passed. Application and test files match the user-tested branch. General browser, theme, and barcode suites were not rerun for this merge.
- The user clarified that future code/UI changes must bump the patch version even on the same test branch; synchronized release version files remain required. Documentation-only updates do not require a bump.
- Delete the test branch only after main is successfully pushed; confirm remote state before future branch work.

## v1.8.19 Temporary Alcohol License Patch — 2026-11-17

- Created fix/v1.8.19-temporary-alcohol-license from merged main at the user's request. Release files declare patch version 1.8.19; this patch is not merged to main.
- License alerts recognize Status - DL: TEMPORARY ALCOHOL (and TEMPORARY ALCOHOL LICENSE). A current, unexpired credential produces VALID LICENSE with TEMPORARY ALCOHOL LICENSE beneath it. Current expiration, ID-only, missing-number, and suspension handling retain their existing checks; a separate CDL status does not replace the DL status.
- The qualifier is a centered display line styled with the same green color, 36px size, and weight as VALID LICENSE, not an audio heading. Recorded voices and local TTS use only the ordinary valid-license announcement. The standard 10-second success timeout applies.
- Verified npm run check, all 240 unit tests, and the new targeted browser popup check. Extracted text from the privately supplied PDF produces the expected success alert. Only synthetic fixtures were added; no private record or identifiers are committed. Full general browser, theme, and barcode suites were not rerun for this focused alert patch. Installed-extension testing remains blocked by managed browser policy.

## v1.8.18 Merge — 2026-11-17

- At the user's request, merged the retained fix/v1.8.17-multiracial-barcode branch (0306787) into main without conflicts in merge commit bf40f97. Release files declare version 1.8.18.
- Verified on merged main: npm run check, all 237 unit tests, and all 7 targeted shortcut-menu browser/fixture checks passed. Application and test files match the tested branch. General browser, theme, and barcode suites were not rerun for this merge; main v1.8.17 passed those during environment onboarding.
- The user authorized deletion of the test branch after main is successfully pushed. Confirm remote state before any future branch work. Managed browser policy still blocks installed-extension testing.

## v1.8.18 Pinned Menu Persistence Patch — 2026-11-12

- Work continues on the retained fix/v1.8.17-multiracial-barcode test branch, advanced to merged main before editing. Release files now declare patch version 1.8.18; these changes are not merged to main.
- A shortcut menu already kept on top through Document PiP survives a new search hotkey such as Alt+P. It also stays open after selecting its own actions, with buttons available for subsequent commands. Ordinary menus, including no-timeout menus not actually pinned, retain their previous close-on-new-action behavior.
- The owning menu reports actual PiP entry/exit to the worker using its validated menu ID and document URL. Search dispatch preserves only panel entries with an actual pin flag. Stop, Close, Escape, and clearing private state still dismiss pinned menus; closing the menu does not cancel an active search prompt.
- Disabling pinning restores normal menu cancellation. Capture/source selection remains unchanged: report actions use the source captured when the menu opened.
- Verified repository checks, all 237 unit tests, and 7 targeted shortcut-menu browser/fixture checks, including real PiP repeat actions, closure, unpinning, and fallback. Worker integration checks cover external hotkeys, cancellation of the previous prompt, repeated actions, authenticated pin state, Stop, and private-state reset. General browser, theme, and barcode suites were not rerun for this patch. Managed policy still prevents installed-extension validation here.

## v1.8.17 Multiracial Barcode Merge — 2026-11-12

- At the user's request, merged fix/v1.8.17-multiracial-barcode (8dcde5f) into main without conflicts. Release files declare patch version 1.8.17. Application and test files match the previously tested branch exactly; repository checks passed after merging. The merge request did not include branch deletion, so the test branch is retained.
- The report race label MLT RA was unrecognized and DCL was omitted. It now maps to MR, along with MR, MULTIRACIAL, MULTI RACIAL, and normalized case/spacing/hyphen variants.
- MR is the Coplogic import code specified by the user. Encode it in DCL as `MR ` (one trailing space). Retain the existing driver/ID v09 framing and legacy mappings for other races; do not describe MR as a verified member of the legacy DDVRAC code list.
- The editor shows Multiracial, accepts manual corrections using the same aliases, and preserves unedited bytes. Unknown labels remain unrecognized rather than being guessed.
- Verified: repository checks; all 234 unit tests; 42 exact PDF417 decodes across 14 synthetic fixtures and 3 sizes, including parsed and edited multiracial fields; barcode UI checks. The uploaded report also parsed through both PDF.js in Chromium and pdftotext with DCL MR and the readable editor label.
- Only synthetic fixtures are committed. No private PDF, personal identifiers, or private barcode payload is included. Actual import into Coplogic remains for user testing; decoder checks establish barcode bytes, not application acceptance.

## v1.8.16 Merge — 2026-11-12

- The user confirmed the menu works and authorized merging the patch branch fix/v1.8.16-shortcut-menu-settings (1544fd0) into main and deleting the branch after a successful push. The merge was conflict-free; main now declares version 1.8.16. Application and test files match the tested branch exactly.
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
- Bump the patch version for changes to the extension's functionality, even when continuing on the same test branch. Keep extension/manifest.json, package.json, package-lock.json (including its root package entry), and README release references synchronized. Demo-site-only development does not increment these versions; the user explicitly clarified this during the demo expansion. Retain the current release number for demo-only revisions.
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

## Resolved: Keyboard Bindings Reset During Updates

Closed at the user's request on 2026-11-12. No root cause or extension code fix was established; this status records closure of the investigation rather than proof of a technical fix. The observations below are historical. Do not resume this investigation unless requested.

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

Current Demo Mode loads this extension’s own packaged demo/ pages and allowlisted fictional reports without localhost access. Own-extension document ownership uses runtime.getContexts, because webNavigation frame metadata excludes these pages. The optional localhost host/resource declarations from v1.8.42 are removed, and its legacy dynamic demo script is unregistered on upgrade. Demo state remains separate from live credentials, blacklist, history, queue and reports. Switching off returns to live routing; do not restore arbitrary HTTP/HTTPS host access. Keep offscreen for the active AUDIO_PLAYBACK workflow, not the retired query experiment. See reviewer/PERMISSIONS.md and tools/audit-permissions.mjs for the seven current API declarations and single live host.

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

All new top-level DMV attachment results use the bundled viewer, whether PDF dark colors are enabled or not. Dark mode controls colors; light mode retains original PDF colors with a light surrounding interface. Temporary extraction-only tabs remain internal. Explicit Print still opens the immutable original in Chrome’s native viewer.

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
- Recognized temporary classes include T45V, T60V, E45V, and E60V.
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
- Selecting an action uses normal command dispatch. It closes an ordinary menu; a pinned PiP menu remains open across actions and external hotkey searches (v1.8.18).
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
