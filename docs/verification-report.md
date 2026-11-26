# Verification Report — Create a TODO Task

Date: 2026-11-07   Status: PASS (with one Medium defect, D-1, that breaks `npm test` in a CRLF checkout; see Defects Found)

Environment: Windows 11 Enterprise 10.0.26200, Git Bash, Node v24.22.0, jsdom 28.1.0, Microsoft Edge 156.0.4314.58, Google Chrome 156.0.8078.80. Branch `feature/create-todo-task`.

## Commands Run
| Command | Result | Duration |
|---------|--------|----------|
| `npm test` (start of session, before any change) | tests 174, pass 174, fail 0, skipped 0 | 1.78 s (node) / 2.9 s wall |
| `npm test` (end of session, with 11 added tests) | tests 185, pass 185, fail 0, skipped 0 | 1.75 s |
| `npm audit` | `found 0 vulnerabilities` | ~2 s |
| `npm ci --dry-run` | completes, "8 packages are looking for funding" (install resolves from lockfile) | ~2 s |
| `npm test -- --experimental-test-coverage` | all files 99.32 % line / 91.45 % branch / 90.57 % funcs (src files below) | 2 s |
| `node tests/browser/browser-smoke.js` (Edge 156, headless, file://) | 56 passed, 0 failed, 1 info; exit 0; run 3 times, same result | ~20 s |
| `BROWSER_PATH=<chrome.exe> node tests/browser/browser-smoke.js` (Chrome 156) | 56 passed, 0 failed, 1 info; exit 0 | ~20 s |
| Mutation spot-checks (15 temporary edits of `src/`, `npm test` after each, restored) | every mutation made at least 2 named tests fail; see below | ~2 s each |
| Doc check script (fences, relative links, requirement IDs, absolute paths, TBD) | see Output Document Quality Check | <1 s |

## Test Results
Unit + jsdom integration (`npm test`): 185 passed / 0 failed / 0 skipped (174 existing + 11 added by the verifier in `tests/integration/secret-leakage.test.js`). There is no separate integration command: the Node runner executes `tests/unit` and `tests/integration` together.
Real browser (`node tests/browser/browser-smoke.js`): 56 passed / 0 failed / 1 info, in Edge and in Chrome.
Coverage (Node built-in, `npm test -- --experimental-test-coverage`):

| File | Line % | Branch % | Funcs % |
|------|--------|----------|---------|
| src/task-service.js | 100.00 | 95.45 | 100.00 |
| src/task-store.js | 100.00 | 92.68 | 100.00 |
| src/task-validator.js | 100.00 | 92.31 | 100.00 |
| src/app.js | Not Found: not in the report | | |
| src/task-view.js | Not Found: not in the report | | |

`app.js` and `task-view.js` are executed by jsdom as page scripts, not loaded through `require`/`vm` in the test process, so the Node coverage tool cannot see them. They are exercised by about 90 page tests and by the real-browser run, but their line and branch percentages are Not Found. The "all files 99.32 %" figure includes test helpers and must not be read as app coverage.

## Acceptance Criteria Coverage
"Fails if broken" was checked by mutation (rows marked M) or by reading the assertion (rows marked R). Test names are from `tests/`.

| Requirement | Test(s) | Fails if broken? | Real browser (Edge/Chrome) | Result |
|-------------|---------|------------------|----------------------------|--------|
| S1 create task | app.test.js "S1 (FR-3, FR-5, FR-6)" | M (FR-6 completed=true mutant killed: S1, S5) | click adds task, status incomplete | PASS |
| S2 empty | app.test.js "S2 (FR-4)" | M (FR-16 mutant killed: S2, S3) | message shown, list unchanged | PASS |
| S3 whitespace | app.test.js "S3 (FR-4)", "S3 ... DD-6", task-validator.test.js | M (dropping `\p{Cf}` killed S3 and 1 more) | spaces/tabs and zero-width-space rejected | PASS |
| S4 clear input | app.test.js "S4 (FR-7)" | M (clearInput removed: S4, FR-10 killed) | input empty and focused | PASS |
| S5 persist | app.test.js "S5 (FR-8, FR-9)" | M (init ignoring storage: S5 killed) | survives real `Page.reload` | PASS |
| FR-1, FR-2 | app.test.js "FR-1, FR-2", accessibility-and-scale.test.js | R | input labelled, button "Add Task" | PASS |
| FR-3, FR-5, FR-6 | app.test.js S1, task-service.test.js | M | yes | PASS |
| FR-4 | task-validator.test.js (many invisible-character cases), app.test.js, fixtures | M | yes | PASS |
| FR-7 | app.test.js S4 | M | yes | PASS |
| FR-8 | task-service.test.js, task-store.test.js, app.test.js | M (storage key changed: 4 tests killed incl. S1) | stored value `[{"id":1,"title":"Complete Java revision","completed":false}]` | PASS |
| FR-9 | app.test.js S5, task-store.test.js | M | yes | PASS |
| FR-10 | app.test.js "FR-10" (form submit) | M (removing `preventDefault` killed tests) | real Enter key via `Input.dispatchKeyEvent` | PASS |
| FR-11 | task-validator.test.js (100/101, emoji), app.test.js "FR-11" | M (limit 101 killed 4 tests) | 101 rejected with message and text kept, 100 accepted | PASS |
| FR-12 | app.test.js "FR-12" x2 | M (input listener renamed: FR-12 test killed) | typing removes message and `aria-invalid` | PASS |
| FR-13 | app.test.js, task-service.test.js, task-validator.test.js | M (trim removed: FR-13 tests killed) | `  Buy milk  ` stored as `Buy milk` | PASS |
| FR-14 | app.test.js "FR-14", task-service.test.js | M (newest-first mutant killed 11 tests) | A, B, A order | PASS |
| FR-15 | app.test.js (unreadable, blocked, failed save, BACKUP_FAILED), task-service.test.js, task-store.test.js | M (backup skipped killed 4 tests) | garbage -> warning, backup key holds `garbage`; blocked and quota simulated | PASS |
| FR-16 | app.test.js "FR-16", task-service.test.js | M | storage string identical after 3 rejections | PASS |
| FR-17 | cross-tab.test.js (6 tests), task-service.test.js | M (storage events ignored killed 4 tests) | two tabs, real storage event fired (1 event) | PASS |
| NFR-1 | app.test.js "NFR-1" | R | one input, button, list | PASS |
| NFR-2 | accessibility-and-scale.test.js 500-task smoke (loose bound) | R (bound is loose by design) | add to 500 tasks took 10.3 ms in the handler | PASS (proxy) |
| NFR-3 | accessibility-and-scale.test.js (viewport meta, 44 px, wrapping) | R | 320 and 1920 px: no horizontal scroll, button 105.4x44.0, input 44.0 tall, long title wraps | PASS |
| NFR-4 | static-checks.test.js (no network API), secret-leakage.test.js (no fetch/XHR/WebSocket/beacon during a session) | R | 49 requests, 0 non-file | PASS |
| NFR-5 | cross-tab.test.js, app.test.js S5 | M | 8 tasks survive reload | PASS |
| NFR-6 | app.test.js x2, static-checks.test.js (no HTML sinks) | M (`innerHTML` mutant killed 3 tests) | `<img src=x onerror=alert(1)>` shown literally, 0 dialogs, 0 `img` elements | PASS |
| NFR-7 | accessibility-and-scale.test.js (7 tests), contrast.test.js | M (announce removed killed 2 tests) | Tab order input -> button, 3px focus outline, role=alert | PASS (automated parts); screen reader Not Found |
| NFR-8 | unit tests run without a browser; 16+ tests per scenario | R | n/a | PASS |
| NFR-9 | Not Found: only Edge 156 and Chrome 156 were run | n/a | Edge, Chrome | Partial |
| NFR-10 | static-checks.test.js (no runtime deps, classic scripts) | R | page runs from file:// | PASS |

## Edge-case Matrix
| Case | Test | Result |
|------|------|--------|
| Happy path | app.test.js S1, browser smoke | PASS |
| Not Found / missing key | task-store.test.js (`missing` status), app.test.js (fresh page, no warning) | PASS |
| Missing field (no title / no completed) | fixtures `missing-title.json`, `missing-completed.json` in task-store.test.js; browser: `[{"id":1,"completed":false}]` gives a warning and no blank row | PASS |
| Storage get fails | fake-storage `failures.get`, app.test.js "local storage blocked"; browser: throwing `localStorage` getter (simulated) | PASS |
| Storage set fails / quota | fake-storage `set`/`quota`, app.test.js "failed save"; browser: `Storage.prototype.setItem` throws QuotaExceededError (simulated), task stays listed after the 2 saved ones and storage still holds 2 | PASS |
| Browser-level "block site data" setting | Not Found: not simulated; only the in-page getter override was used | Not Verified |
| Empty input | S2, browser | PASS |
| Whitespace and invisible only | S3, 10+ validator cases, browser (tabs, zero-width space) | PASS |
| Malformed stored data | fixtures (invalid-json, not-an-array, record-is-null, record-is-array, duplicate-ids, float-id, negative-id, unsafe-id, zero-id, completed-is-string); browser: `garbage` | PASS |
| Markup / XSS title | app.test.js x2 (typed and stored), browser | PASS |
| 100 / 101 boundary | task-validator.test.js, app.test.js, browser | PASS |
| Huge input (no regex stack overflow) | task-validator.test.js CR-3 | PASS |
| Secret leakage in source | secret-leakage.test.js: no token-like strings, `process.env`, `.env`, URLs, absolute paths in 5 JS files, CSS, index.html, package.json | PASS (added) |
| Secret / stack leakage at runtime | secret-leakage.test.js: a storage Error carrying `SECRET-LEAK-MARKER-12345` never appears in page text; no `Error:`/stack text | PASS (added) |
| No network calls | static-checks.test.js, secret-leakage.test.js (stubs fetch, XHR, WebSocket, EventSource, sendBeacon), browser CDP Network log | PASS |
| Duplicate titles | app.test.js FR-14 | PASS |
| Two tabs | cross-tab.test.js (simulated events), browser (real storage event) | PASS |

## Output Document Quality Check
| Check | Result | Evidence |
|-------|--------|----------|
| Rendered DOM after a representative session has no `undefined`, `null`, `[object`, `NaN` | PASS | jsdom (`secret-leakage.test.js`) and Edge/Chrome `document.body.innerText` |
| No empty task titles; status shown as "incomplete" | PASS | both |
| Regions present: `main`, `h1`, `form`, one `role=alert`, two `role=status`, `ul#task-list` | PASS | both (8 `li` in the browser run) |
| No secrets or absolute local paths in rendered text/DOM | PASS | regex over body text: no `C:\`, `file:///`, token words |
| Absent data shown as "Not Found" rather than blank | Not applicable: the page shows an empty list (no placeholder) and a warning for unreadable data; no blank rows | PASS |
| Markdown fences balanced in README.md, CHANGELOG.md, docs/*.md, user-story/*.md | PASS | script: 11 files, all even fence counts (README has 2 blocks: the install block and the mermaid block) |
| Relative links resolve | PASS | README has 7 relative links, 0 broken; other files have none |
| Requirement IDs consistent | PASS | no unknown FR/NFR ids anywhere; architecture, impl-plan, traceability each reference all 17 FR + 10 NFR |
| No TBD / FIXME / absolute user paths in docs | PASS | script |
| README `npm install` / `npm test` work | PASS | `npm ci --dry-run` resolves; `npm test` run; `engines` matches README text |
| README project-structure tree matches real files | PARTIAL | Matches the 6 src files, `index.html`, `tests/` (helpers, unit, integration, fixtures), `docs/`. Not listed: `tests/browser/` (new), `package.json`, `CHANGELOG.md`, `user-story/`, `.github/` (the tree is a partial list). Low (D-2) |
| Factual spot-check 1: key `todo-app.tasks.v1` | PASS | `src/task-store.js` `KEY`; seen in the browser's localStorage |
| Spot-check 2: backup key `todo-app.tasks.v1.unreadable` | PASS | `BACKUP_KEY`; browser run read it back as `garbage` |
| Spot-check 3: 100 limit counted in code points | PASS | `Array.from(title).length > 100` |
| Spot-check 4: "error announced as an alert", "Task added: ..." announced | PASS | `role="alert"` in index.html; `announceAdded` text; confirmed in Edge DOM |
| Spot-check 5: "other tabs update" | PASS | Edge and Chrome: tab 1 received 1 real storage event and showed both tasks |
| Spot-check 6: "no runtime dependencies, no build step" | PASS | package.json has only `devDependencies`; page loads 5 classic scripts |
| Spot-check 7: message wording "Task title cannot be empty." / "Task title must be 100 characters or fewer." | PASS | `task-view.js` and browser |
| README claim "Chrome shares storage across local files; Firefox scopes it per file" (checklist row 19) | Not Found: not tested | |
| Version references | PARTIAL | `docs/impl-plan.md` and `docs/manual-test-checklist.md` say "architecture.md v3"; architecture.md is v4. `docs/traceability.md` says "Updated after stage: 6" and lists NFR-9 test as "Not Found" (accurate). Low (D-2) |

## Real-browser findings (the "Edge" column evidence)
Run with `node tests/browser/browser-smoke.js` (headless Edge 156.0.4314.58 on Windows 11 over CDP, Node built-ins only, page loaded as `file:///.../index.html`, throw-away profile deleted afterwards; no leftover `msedge.exe` using the temp profile). The same script passed 56/56 in Chrome 156.0.8078.80.

What ran in the real browser: page load from `file://` with zero console errors, log errors/warnings or exceptions; click via `Input.dispatchMouseEvent`; typing via `Input.insertText`; Enter via `Input.dispatchKeyEvent`; empty, whitespace and zero-width-only titles; 101- and 100-character titles; message removal on typing; trimming, duplicates and order; markup title (no dialog, no `img` element); real Tab order and focus outline; `Page.reload` persistence; stored JSON value; layout at 320 px and 1920 px (`Emulation.setDeviceMetricsOverride`); 500-task list; malformed and missing-field stored data with backup key; two tabs with the real `storage` event; blocked storage and quota failure (simulated inside the browser); network log (49 requests, all `file:`).

Two-tab behaviour actually observed: for `file://` pages Edge and Chrome both fire the `storage` event across tabs in the same profile. Tab 1 counted 1 event and updated to show both tasks without a reload.

Coverage of `docs/manual-test-checklist.md` rows by this script (the human still owns and has not filled in that file; the Edge column there is unchanged):

| Row | Covered by browser-smoke (Edge and Chrome, headless) |
|-----|------------------------------------------------------|
| 0 | Partly: browser version and OS are printed (Edg/156.0.4314.58, Chrome/156.0.8078.80, Windows 11) |
| 1 | Yes (no console errors, controls present) |
| 2 | Yes |
| 3 | Yes |
| 4 | Yes |
| 5 | Yes |
| 6 | Yes |
| 7 | Yes |
| 8 | Yes |
| 9 | Yes (real storage event) |
| 10 | Partly: storage key content read via script and zero non-file requests; the DevTools UI itself was not used |
| 11 | Yes (garbage -> warning, backup key `garbage`) |
| 12 | Partly: simulated with a throwing `localStorage` getter and a throwing `setItem`; a real private window with blocked storage was not run |
| 13 | Yes |
| 14 | Yes (320 and 1920; headless emulation, not device mode with touch) |
| 15 | Partly: Tab order, Enter and focus outline checked; a human keyboard-only session was not done |
| 16 | No (screen reader) |
| 17 | No (no visual check; the ratio test passed: lowest 6.39:1) |
| 18 | Partly: 500 tasks render and the add handler took 10.3 ms; "no visible delay" is a human judgement |
| 19 | No |

## Raw Test Output (trimmed)
```
$ npm test            (start of session)
ℹ tests 174
ℹ pass 174
ℹ fail 0
ℹ skipped 0

$ npm test            (end of session, after adding tests/integration/secret-leakage.test.js)
✔ secrets: app.js has no token-like strings, env access, or external URLs
✔ secrets: styles.css has no token-like strings, env access, or external URLs
✔ secrets: task-service.js ... / task-store.js ... / task-validator.js ... / task-view.js ...
✔ secrets: index.html has no token-like strings, external URLs, or absolute local paths
✔ secrets: the committed package.json holds no credentials or registry tokens
✔ secrets: a storage error message and stack never reach the rendered page
✔ output quality: a representative session renders no undefined/null/[object text and no empty titles
✔ secrets: the page makes no network requests while a session runs (NFR-4)
ℹ tests 185
ℹ suites 0
ℹ pass 185
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1752.1332

$ npm audit
found 0 vulnerabilities

$ npm test -- --experimental-test-coverage
ℹ  task-service.js     | 100.00 |   95.45 | 100.00
ℹ  task-store.js       | 100.00 |   92.68 | 100.00
ℹ  task-validator.js   | 100.00 |   92.31 | 100.00
ℹ all files            |  99.32 |   91.45 |  90.57

$ node tests/browser/browser-smoke.js
Browser: Edg/156.0.4314.58 (msedge.exe), win32 10.0.26200
Page: file:///C:/Users/ManojA/Desktop/Epam%20Learning%20tasks/Capstones/Claude/index.html
PASS page loads from file:// with controls visible
PASS S1/FR-3/FR-5/FR-6: click adds task with status incomplete
PASS FR-8: localStorage holds the task under todo-app.tasks.v1 - [{"id":1,"title":"Complete Java revision","completed":false}]
PASS FR-10: real Enter key in the input adds the task
PASS S2/FR-4: empty title shows "Task title cannot be empty." and adds nothing
PASS FR-11: 101 characters shows the 100-character message, adds nothing, keeps the text
PASS NFR-6: markup title is shown literally as text
PASS NFR-7: Tab reaches the input, then the button - title-input then BUTTON
PASS S5/FR-9/NFR-5: tasks persist after a real reload, in order, as incomplete
PASS NFR-3: 320px wide has no horizontal scroll - {"inner":320,"scroll":320,"bodyScroll":320}
PASS NFR-3: 320px Add Task button is at least 44x44 - 105.4x44.0
PASS NFR-3: 1920px wide has no horizontal scroll - {"inner":1920,"scroll":1920,"bodyScroll":1920}
PASS NFR-2: adding to a 500-task list takes under 100 ms in the handler - 10.3 ms
PASS FR-15: add replaces data, backup key holds the old data, warning cleared
PASS NFR-4: no network (non-file) requests were made - requests seen: 49, non-file: []
PASS no console errors, log errors/warnings or exceptions during the session - []
PASS FR-17: tab 1 updated without a reload via the real storage event - storage events seen by tab 1: 1
PASS FR-15: tasks stay in the list in memory when storage is blocked
PASS FR-15 (simulated: quota error on setItem): the unsaved task stays listed after the saved ones, with a warning
INFO browser-level "block all site data" setting - Not Found: not simulated; ...
Cleanup: browser stopped, temp profile deleted
Summary: 56 passed, 0 failed, 1 info        (exit 0; same in Chrome 156.0.8078.80)
```

Mutation spot-checks (temporary edit of `src/`, `npm test`, restored; counts are the real `ℹ pass / ℹ fail` lines):

| Requirement | Mutation | Result |
|-------------|----------|--------|
| NFR-6 | `title.textContent` -> `title.innerHTML` in task-view.js | pass 171 / fail 3 |
| FR-11 | `MAX_CODE_POINTS = 100` -> `101` | pass 170 / fail 4 |
| FR-17 | storage listener condition `event.key === store.key` -> `false` | pass 170 / fail 4 |
| FR-14 | `base.concat([task])` -> `[task].concat(base)` | pass 163 / fail 11 |
| FR-15 | `store.backup(current.raw)` -> `true` | pass 170 / fail 4 |
| NFR-7 | `view.announceAdded(...)` removed | pass 172 / fail 2 |
| FR-13, FR-4 (`\p{Cf}`), FR-7, FR-12, FR-8 (key renamed), FR-16, FR-6, FR-10, FR-9 | one edit each | each made named tests fail (counts not captured in the second batch: my count parser failed; the failing test names were printed) |
| New secret tests | token-like comment in task-store.js; `String(task.nothing)` in task-view.js | "secrets: task-store.js ..." and "output quality ..." failed (fail 7 in total) |

`git status` at the end shows only two new untracked paths under `tests/` (`tests/browser/`, `tests/integration/secret-leakage.test.js`); no tracked file differs from HEAD.

## Defects Found
| ID | Severity | Description | Repro | Suggested owner |
|----|----------|-------------|-------|-----------------|
| D-1 | Medium | `DR-23` in `tests/integration/static-checks.test.js` requires `\n` line endings (`source.startsWith("(function (global) {\n  'use strict';")`). On a Windows checkout with `core.autocrlf=true` (the Git for Windows default, and set on this machine) the source files are CRLF in the working tree and `npm test` fails 1 of 174. There is no `.gitattributes`. | `git checkout -- src/app.js src/task-service.js src/task-store.js src/task-validator.js src/task-view.js` on this machine, then `npm test`: pass 173 / fail 1 (`DR-23 ... same opening line`). Observed during this session; the working tree was converted back to LF afterwards. | implementer: add `.gitattributes` (`*.js text eol=lf`) or make the test tolerate `\r\n`; do not weaken the other checks |
| D-2 | Low | Stale documentation: `docs/impl-plan.md` and `docs/manual-test-checklist.md` say "architecture.md v3" (now v4); README tree omits `tests/browser/` and the new script; README "Develop and test" does not mention `node tests/browser/browser-smoke.js`; traceability "Automated proxy only" rows are now partly covered by the browser script. | read the files | docs-sync |
| D-3 | Low (information) | Coverage tool cannot instrument `src/app.js` and `src/task-view.js` (run inside jsdom), so branch coverage of the DOM layer is unmeasured. | `npm test -- --experimental-test-coverage` lists only 3 src files | implementer / team decision |

No product defect was found in the page itself: no failure in Edge or Chrome, no console error, no layout overflow, and the storage-event behaviour works for `file://`.

## Not Verified / Limitations
- Firefox and Safari were not run (NFR-9 asks for Chrome, Edge, Firefox, Safari, latest two versions). Only Edge 156 and Chrome 156 (one version each) were run, headless, on Windows 11.
- No mobile browser or real touch device. The 320 px check is a desktop headless viewport override (`mobile: false`), not device mode.
- Screen readers (NVDA, Narrator, VoiceOver) were not run. Announcements (`role=alert`, `role=status`, "Task added: ...") are checked only as markup/DOM; whether they are spoken is Not Found.
- `docs/manual-test-checklist.md` is unfilled (Status: Not run) and was not edited. The browser script covers most rows as listed above, but it is not a human sign-off.
- Blocked storage and a full quota were simulated inside the browser (throwing getter, throwing `setItem`); a real private window or the browser's "block site data" setting was not exercised.
- The `file://` behaviour when the folder is moved (checklist row 19) and Firefox's per-file scoping were not tested.
- Visual contrast, focus ring appearance and design quality were not judged by eye; only the computed ratio test (lowest 6.39:1) ran.
- Node 20.19 and Node 22.12 were not run; only Node 24.22.0.
- Timing (NFR-2) was measured only in-handler (10.3 ms for the click on a 500-task list in headless Edge); end-to-end perceived latency was not measured.
- Mutation testing was a hand-picked set of 15 edits, not a full mutation run; 6 of them have exact counts recorded above.
- `src/app.js` and `src/task-view.js` line/branch coverage: Not Found (see D-3).
- Housekeeping: during mutation testing one `git checkout -- <src file>` restore converted the working-tree line endings of the five `src/*.js` files to CRLF (autocrlf). They were converted back to LF and `git status` / `git diff` show no change to tracked files. `chrome.exe --version` was also run once to read the version and opened a window in an existing Chrome session.

## Fix Round 1 (orchestrator)

| Defect | Resolution | Evidence |
|--------|------------|----------|
| D-1 | Added `.gitattributes` (`* text=auto eol=lf`) so Windows checkouts keep LF; the DR-23 test now normalises `\r\n` before checking the file opening. | With all five `src/*.js` converted to CRLF, `npm test` gave 185 pass, 0 fail; files restored to LF afterwards (`git diff -- src` empty). |
| D-2 | README tree and test section, CHANGELOG, checklist intro, and "architecture v4" references updated; traceability now lists `tests/browser/browser-smoke.js` and marks requirements tested in a real browser. | `docs/traceability.md` rebuilt; id sets match across documents. |
| D-3 | Accepted. `app.js` and `task-view.js` run inside jsdom, which Node's coverage tool cannot see; they are exercised by 100+ page tests, 15 mutations and 56 real-browser checks. | No change. |

Status after fix round: **PASS** (185 unit and page tests, 56 of 56 real-browser checks, `npm audit` 0).
