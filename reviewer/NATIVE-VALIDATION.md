# Clean-profile native validation

Status: the publisher reports that Demo Mode passed every check in the packaged reviewer guide (2026-11-18). This is user-reported validation; browser/OS and extension ID were not recorded here. Results for all items in this separate native checklist remain unrecorded. Managed cloud policy prevents installation, so the automated package checks do not mark these native steps as passed.

Use a fresh Chrome 140+ profile with no saved extension credentials or preferences. Extract the runtime ZIP into a new directory and Load unpacked that directory. Do not load the repository root. Confirm the displayed version is 1.8.45 and that Demo Mode starts off. Review the actual permission disclosure.

1. Confirm installation opens the EULA with an unchecked agreement box. Before accepting, test hotkeys and popup actions: they must not run queries, audio, PDF parsing/routing or DMV theming. Close and decline the review; About must reopen it. Explicitly accept, restart Chrome, and confirm no repeat prompt. Confirm Keybinds owns setup, About owns legal placeholders/review and Practice environment is last in Settings. Then open the packaged reviewer guide and enable Demo Mode. There must be no localhost permission prompt and no server/terminal requirement.
2. Leave a practice page idle long enough for the worker to stop, then run a new search and confirm the page reconnects. Enable status alerts/photo display and run the guide's valid, suspended, revocation, TAL and no-photo examples through the extension's normal quick actions.
3. Confirm light and dark PDF results both use the custom viewer in the same tab. Select/copy text, scroll, change colors and print the immutable original PDF. The explicit Print action may use the native viewer.
4. Exercise saved-owner customer follow-ups, residence Collect/Next/Previous, SCUTTIES Search/View and barcode editing. Scan only synthetic barcodes into an approved test destination.
5. Test background searches with Chrome behind another application and minimized. Confirm status appears without clicking the report, the main browser is not forcibly restored/minimized, restored/moved query tabs are respected, completed same-address results focus, SCUTTIES stays foreground and background result tabs are reused.
6. Assign Alt+H and optionally individual global hotkeys, then test while another application is focused. Test the optional Picture-in-Picture launcher separately if supported.
7. Trigger each controlled fault in foreground mode. Test Stop and mode switching during navigation and PDF extraction. Confirm no late demo alert or history entry appears in Live Mode and no wrong-environment PDF supplies a follow-up.
8. Add/remove concurrent demo blacklist entries, test blocking before navigation, reload the extension/browser and confirm expected persistence of preferences versus session-only data. A live encrypted vault must remain untouched by demo work.
9. Verify bundled recording/local voice behavior, repeat and Stop. Confirm no names, addresses or special-license qualifiers were added to voice content.
10. Switch Demo Mode off. Live login should be offered only when intentionally starting live work; no live transaction is needed to complete this checklist. Any actual live verification requires an authorized account and permitted records.

Record browser/OS version, extension ID, pass/fail and observed limitations before sharing the package for formal review. Do not include real records, signing keys, account credentials or cookies in review attachments.
