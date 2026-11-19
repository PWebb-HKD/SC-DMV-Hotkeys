# Current permission audit — 1.8.45

Audit scope: current first-party code and intended live/demo workflows, including retired features. This is a code/workflow review, not a Web Store approval or a claim that future redesigns could never reduce access further. `tools/audit-permissions.mjs` is a packaging gate and writes the machine-readable rationale before creating a ZIP.

| Declaration | Current need and evidence |
| --- | --- |
| storage | Preferences, local EULA acceptance receipt, optional encrypted login/blacklist and session-scoped history, queue, report and demo state. vault.js, alert-settings.js, background.js. |
| tts | User-enabled local voice announcements and fallback when a bundled recording is unavailable. audio-alerts.js selects voices Chrome reports as local. |
| offscreen | Packaged voice recordings and the optional suspended clip need AUDIO_PLAYBACK from a service worker. audio-alerts.js creates audio-player.html. The retired offscreen query experiment does not justify this permission; the active audio path does. |
| scripting | Live DMV form actions, original-report byte capture and user-selected website styling. automation.js, page.js and dmv-theme-settings.js. Packaged demo pages use owned document ports rather than injection. |
| tabs | Sensitive URL/pending-URL metadata supports owned about:blank startup verification, report/blob/native-view identification and preserving user-navigated/moved tabs. Most tab create/update/query calls themselves do not require this permission; the current ownership/source checks do. background-search.js, background.js, results.js. |
| declarativeNetRequestWithHostAccess | Main-frame-only live DMV attachment routing to the bundled PDF viewer before Chrome's native viewer appears. This remains active with dark mode off: the route selects light colors. pdf-routing.js. Explicit native printing uses the immutable original Blob and is separate. |
| webNavigation | Top-level committed document IDs and getFrame protect snapshots against replaced documents and delayed same-URL loading events. tabs.onUpdated does not provide that identity. background.js. |
| https://www.scdmvonline.com/* | Live authorized form navigation, scripting, same-session report fetching and appearance. One exact HTTPS hostname; no wildcard subdomains or arbitrary website host access. |

## Removed or absent

- Removed the 1.8.42 optional `http://127.0.0.1/*` host grant and localhost reader resource match. No server is needed by the packaged demo.
- Retired the dynamic localhost demo hook; the upgrade path unregisters the old script ID. Packaged pages own a bounded message bridge.
- No nativeMessaging, downloads, history, activeTab, clipboardRead/Write, debugger, system.display, broad HTTP/HTTPS host access or all_urls permission is declared.
- The abandoned offscreen query transport and tiny-window experiments have no retained query-specific permission. The supported minimized owned-window transport remains active.
- Normal tab/window/commands APIs and optional Picture-in-Picture do not justify extra declarations beyond those listed. The manual Node development server, source/test tools and reviewer media do not ship in the runtime ZIP.

The builder rejects changes to the reviewed permission set, unexpected runtime files, symlinks, private-key formats and stale generated demo assets before writing the archive. Vendor notices and bundled licenses are retained.
