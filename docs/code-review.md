# Code Review — Create a TODO Task

Scope: `git diff 53f6243...HEAD -- index.html src tests package.json` (branch `feature/create-todo-task`, HEAD `c9cf9cf`); also README.md, CHANGELOG.md, docs/ for doc-vs-code checks.   Reviewer: code-reviewer   Version: 1   Status: In review

Specs read: docs/requirements.md v2, docs/architecture.md v3, docs/impl-plan.md, docs/design-review.md (DD-1..DD-7).

Checks run (read-only): `npm test` gives 144 pass, 0 fail (Node 24.22.0). `npm audit` reports 0 vulnerabilities. Ad-hoc `node` probes against `src/` through `tests/helpers/load-modules.js` (validator character classes, regex performance, service state transitions, store edge cases, contrast ratios). No file under `src/` or `tests/` was changed.

Not verified: no real browser was run (file:// loading, layout, real Enter key, screen readers; all are on the manual checklist, which is unfilled). Node 20.19 and 22.12 were not available, so `npm test` on the lower engine bounds is unverified.

## Checklist Result

| Area | Result | Notes |
|------|--------|-------|
| Correctness | Pass with notes | Every FR maps to code and a test. The validator character class matches the architecture exactly (probed, see below). One real state bug in `TaskService` when the store goes from unreadable/unavailable back to ok with unsaved tasks (CR-1). Smaller issues: CR-3, CR-4, CR-6, CR-7. |
| Security | Pass | No `innerHTML` or other HTML sink; all text via `textContent`; no inline handlers or styles; no network API; stored records are validated and re-copied field by field (extra properties dropped); no secrets. Only note: very large invisible-only input can throw in the validator (CR-3, Low). |
| Error handling | Pass with notes | All storage access is inside try/catch in `TaskStore`; unknown view codes fall back to a generic message. Gaps: CR-1 (duplicate after recovery), CR-3 (uncaught RangeError on a multi-megabyte paste), CR-5 (blank stored titles accepted), CR-7 (warnings not refreshed on a storage event). |
| Test coverage | Pass with notes | 144 tests, hermetic, no network, deterministic. Two FR and several NFR assertions are weak (CR-2, CR-11), and the failing flow in CR-1 has no test. |
| Code clarity | Pass with notes | Small functions, factory pattern is consistent. `tasks` vs `pending` naming and the untested `complete` branch are confusing (CR-13). |
| DRY | Pass with notes | Source is clean. Test boilerplate is copied three times; the "store is usable" check appears three times in the service (CR-12). |
| Dependency safety | Pass | One dev dependency (jsdom 28.1.0, exact pin, lockfile present, 0 audit findings); no runtime dependencies; `engines` matches jsdom's own engines. |

## Findings

| ID | Severity | Area | File:line | Finding | Recommendation | Status |
|----|----------|------|-----------|---------|----------------|--------|
| CR-1 | Medium | Correctness / Error handling | src/task-service.js:58-59, 72 | When the read status is `unreadable` or `unavailable` and the write also fails, `pending = next.slice()` puts the whole in-memory list into `pending`, including tasks that were already saved earlier. When the store later reads `ok`, `storedPlusPending` appends them again, so saved tasks are shown twice and the duplicates are then written to storage. Probe: save `a` (ok); make get and set fail; add `b` (list `a,b`, warning `UNAVAILABLE`); restore storage; add `c`. Result and stored value: ids 1..4, titles `a,a,b,c`. Trigger is rare (a read failure followed by recovery, or a corrupt value plus a full quota), but the outcome is silent duplicate data that is persisted, and the architecture (section 5) promises that `pending` holds only unsaved tasks. | In the non-usable branch keep `pending` as "tasks added since the last successful write": `pending = pending.concat([task])` instead of `next.slice()` (the displayed `tasks` already holds the saved ones). Add a unit test for the ok to unavailable to ok flip, and for unreadable plus failed write then a repaired store. | Fixed |
| CR-2 | Medium | Test coverage | tests/integration/accessibility-and-scale.test.js:106-108; src/styles.css:42,59 | The NFR-3 "44 px tap target" test is `assert.match(css, /min-height:\s*2\.75rem/)` on the whole stylesheet. The rule appears on both `input[type="text"]` (line 42) and `button` (line 59), so deleting the button rule leaves the test green. `overflow-wrap:\s*anywhere` is likewise matched anywhere in the file. These tests would pass with the behaviour broken. | Parse the rule for the `button` selector (and `.task-title`) and assert inside that block, or at least match `button\s*\{[^}]*min-height:\s*2\.75rem`. The manual checklist row 14 remains the real check. | Fixed |
| CR-3 | Low | Error handling / Security (DoS by own paste) | src/task-validator.js:5,10; src/app.js:22 | `INVISIBLE_ONLY = /^[...]*$/u` throws `RangeError: Maximum call stack size exceeded` for roughly 10 million or more code units of invisible characters (probe: `'\u200B'.repeat(1e7)+'a'` throws; 8e6 blank characters is fine and takes 170 ms). The exception is raised inside the submit handler after `preventDefault()`, so there is no navigation but also no message and no feedback. Reaching it needs a multi-megabyte paste; normal inputs (100 000 code units: 7 ms) are fine. | Test for any visible character with a negated class instead: `!/[^\p{White_Space}\p{Z}\p{Cc}\p{Cf}\u115F\u1160\u2800\u3164]/u.test(title)`. Probe: 3e7 invisible characters returned in 543 ms with no throw. Same results for all accept and reject cases in the unit tests. | Fixed |
| CR-4 | Low | Correctness | src/task-store.js:12-13; src/task-service.js:62 | A stored id of `Number.MAX_SAFE_INTEGER` is valid, so the next id is `2^53` (not a safe integer). It is written, and on the next load `Number.isSafeInteger` fails, so the whole list becomes `unreadable` and the user's tasks are only recoverable from the backup key. Probe confirmed: second load returns `UNREADABLE`. Needs tampered storage, so not reachable in normal use. | Make the store reject `id >= Number.MAX_SAFE_INTEGER` (so max + 1 is always safe), or have `addTask` treat it as unreadable. Add the id to the fixtures. | Fixed |
| CR-5 | Low | Error handling | src/task-store.js:14-15, 50-51 | Stored-data validation is weaker than add-time validation. A record with title `"   "` or `"\u200B"` is accepted and rendered as an empty-looking row; a 5000-character title is accepted (probe: lengths 3, 1, 5000 all returned with no warning). The requirements "missing data rule" (section 5) treats a missing title as unreadable; a blank title is the same symptom. Also, `getItem` returning a non-string, non-null value (a Storage shim returning `undefined` for a missing key) is classed `unreadable` and `String(raw)` (`"undefined"`) would be backed up. Real `localStorage` returns `null`, so the second point is theoretical. | Apply the validator rule to stored titles (inject `validateTitle` into the read path, or check `title.trim()` against the same class) and decide whether over-100 titles from storage are accepted; document the choice. Treat `undefined` like `null` for `missing`. | Fixed |
| CR-6 | Low | Correctness | src/task-service.js:24-32, 82 | Pending tasks get new ids every time `storedPlusPending` runs. A displayed task's id (and the `data-id` attribute at src/task-view.js:41) changes between renders. Probe: unsaved task shown with id 1; after a `refresh()` with two tasks saved by another tab it has id 3. Nothing in this story uses the id, so there is no bug now, but a later complete/delete story keyed on `id` will act on the wrong task. The behaviour is by design (architecture section 4), but the consequence is not recorded. | Add a note to architecture section 6 that ids of unsaved tasks are provisional, or keep a stable client key for pending tasks. | Fixed |
| CR-7 | Low | Error handling | src/app.js:44-48; src/task-service.js:79-85 | The `storage` handler re-renders only the list. `refresh()` returns no warning and the app does not update the message block. Case 1: tab A shows `UNREADABLE`; tab B replaces the data; A's list updates but the stale "Adding a task replaces them" warning stays. Case 2: another tab corrupts the data; A keeps showing its list with no warning and the next add silently takes the backup path. | Return the current warning from `refresh()` (null for ok/missing once the data is repaired) and apply it as `addTask` does. Add a cross-tab test for case 1. | Fixed |
| CR-8 | Low | Accessibility | src/task-view.js:25-30,69-71; src/app.js:33-37 | `showWarning` rebuilds the paragraph in a `role="status"` region on every successful add while the warning code is unchanged (`UNAVAILABLE`, `SAVE_FAILED`). Screen readers will read the full warning after every "Task added: ..." announcement. This is the same mechanism that makes errors repeat deliberately; for warnings it is noise. | In `App`, call `showWarning` only when the code differs from the one on screen (track the last code in the view), or leave the existing node in place when the text is equal. | Fixed |
| CR-9 | Low | Accessibility | index.html:27; src/styles.css:113-117 | `list-style: none` on the `<ul>` removes list semantics in Safari/VoiceOver, so the `aria-label="Tasks"` and item counts are lost there. Safari is in the NFR-9 browser list. | Add `role="list"` to the `<ul>`. | Fixed |
| CR-10 | Low | Test coverage | tests/integration/app.test.js:97; tests/unit/task-service.test.js:110 | The "invisible characters" inputs are literal U+200B characters inside the test source (probe: code points `200b 200b`). They are invisible to a reviewer and can be removed by an editor or formatter, which would turn the test into an empty-string test that still passes. The project already enforces ASCII-only for `src/` for this reason (static-checks.test.js:40). | Write them as `'\u200B\u200B'`. | Fixed |
| CR-11 | Low | Test coverage | tests/ (various) | Missing or weak tests against the acceptance criteria: (a) no test for the read-failure recovery flows (CR-1); (b) `BACKUP_FAILED` and the generic fallback message are never rendered in a page test; (c) FR-1 says "visible and focusable" but app.test.js:59-66 only checks label, type and button text; (d) NFR-1 (at most 4 primary elements) has no test; (e) NFR-2 asserts `addMs < 1000` (accessibility-and-scale.test.js:128) against a 100 ms target; this is acknowledged as a proxy in docs/traceability.md, but a 1000 ms bound cannot fail for any realistic regression; (f) NFR-4 is only a source grep, no run-time check that no request is made; (g) FR-10 is verified with `requestSubmit` only (known jsdom limit, manual row 3). | Add tests for (a)-(d); for (e) either tighten to 100 ms with a generous retry-free margin or rename the test to say it is a smoke test only; list (f) and (g) as manual-only in the traceability matrix. | Fixed |
| CR-12 | Low | DRY | tests/integration/app.test.js:12-28; cross-tab.test.js:12-28; accessibility-and-scale.test.js:14-30, 32-35; src/task-service.js:38,52,81 | The `page()` helper, the `open` list, the `afterEach` close-and-assert block and `add()` are copied into three test files. In the service the condition `status === 'ok' \|\| status === 'missing'` is written three times (also `storedIsUsable` at line 52). An `assert` failure inside the shared `afterEach` loop also stops closing the remaining pages. | Move the page registry and `afterEach` into `tests/helpers/make-page.js` (for example `withPages()`), and add a small `isUsable(status)` in the service. | Fixed |
| CR-13 | Low | Code clarity | src/task-service.js:21-22,66; src/task-view.js:49; src/*.js | `tasks` is the displayed list (stored plus pending) while `pending` is a subset of it with different ids; the name `tasks` hides that. `task-view.js:49` renders `'complete'` for `completed: true`, a branch with no requirement (assumption 4: only "incomplete" is shown) and no test. `code.instructions.md` asks for a one-line doc comment on public functions; none of the factories (`createTaskStore`, `createTaskService`, ...) has one. | Rename `tasks` to `displayed` (or add a one-line comment), drop or test the `complete` branch, add one-line comments to the five public factories. | Fixed |
| CR-14 | Low | Docs vs code | docs/architecture.md:156; docs/impl-plan.md:16 (T-01), :3; docs/manual-test-checklist.md:34 | (a) Architecture section 10 and impl-plan T-01 say `"engines": { "node": ">=20" }`; package.json:7-9 (and architecture section 2, README) say `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`. (b) Manual checklist row 17 says "automated check measured at least 5.58:1"; no such check exists in the repo. My calculation of the actual pairs gives a lowest text contrast of 6.39:1 (white on `#0b57d0`), so the figure cannot be reproduced. (c) impl-plan.md still says `Status: Draft` with every task `Done`. (d) docs/traceability.md lists NFR-1 and NFR-9 test as `Not Found`, which is accurate, but README says the page is "keyboard and screen-reader friendly" while the manual checklist is entirely `Not Found`. | Fix (a) in architecture section 10 and impl-plan via the owning agents/`docs-sync`; remove or source the 5.58 figure; update the plan status; qualify the README claim until the checklist is run. | Fixed |

Counts: Blocker 0, High 0, Medium 2, Low 12. Total 14.

### Probes behind the correctness claims

- Validator class (node probe, one code point per title): rejected (`EMPTY`) are U+0020, 0009, 000A, 0085, 00A0, 1680, 2000-200A, 2028, 2029, 202F, 205F, 3000, FEFF, 200B, 200C, 200D, 2060-2064, 00AD, 061C, 180E, 115F, 1160, 2800, 3164, E0001, E0020, 007F, 0000, 009F. Accepted: U+034F, FE0F, 17B4, 17B5, 180B, 1D159 (known, architecture risk 5), FFFC, FFFD, E000, 0378, lone surrogates, and U+FFA0 (halfwidth Hangul filler, not listed in the architecture or FR-4; it renders as a blank row, same family as U+3164; consider adding it to the list). The regex therefore contains exactly `\p{White_Space}`, `\p{Z}`, `\p{Cc}`, `\p{Cf}`, U+115F, U+1160, U+2800, U+3164.
- Accepted as required: Persian ZWNJ word, Devanagari ZWJ conjunct, ZWJ family emoji, subdivision flag, a lone emoji, ZWSP plus a letter. `'\u200Bhi\u200B'` is accepted and stored with the ZWSPs (only `trim()` whitespace is removed; matches FR-13 as written).
- Length: `a` x 100 followed by U+200B counts 101 code points and returns `TOO_LONG`; invisible characters count toward the limit, consistent with FR-11 (code points, after trim).
- Regex performance: 1 000 000 blank code units in 48 ms; 5 000 000 plus a letter in 338 ms; 10 000 000 plus a letter throws (CR-3).
- Service transitions: unreadable at load, failed add, repaired store by another tab, `refresh()` then add: ids 1, 2, 3 with no duplicates and `warning` null. Unavailable at load then store becomes readable with one saved task: saved task is kept, memory task follows, ids unique. The only duplication path found is CR-1.

## Requirement → Code → Test Trace

| Requirement | Code | Test | Verdict |
|-------------|------|------|---------|
| FR-1 labelled input | index.html:14,16 | app.test.js:59 (label, type) | Partly weak: "focusable" not asserted (CR-11c) |
| FR-2 Add Task button | index.html:17 | app.test.js:59-66 | Covered |
| FR-3 create on click | app.js:20-38; task-service.js:47-77 | app.test.js:68; task-service.test.js:67 | Covered |
| FR-4 reject blank (incl. invisible) | task-validator.js:5,10; app.js:23-27; task-view.js:57-61 | task-validator.test.js:26-49; app.test.js:76,86,95; task-service.test.js:106 | Covered; U+FFA0 gap noted |
| FR-5 immediate display | app.js:28 | app.test.js:68 (synchronous assertion after click) | Covered |
| FR-6 incomplete default | task-service.js:62; task-view.js:49 | task-service.test.js:67; app.test.js:68 | Covered |
| FR-7 clear input | app.js:29; task-view.js:81 | app.test.js:102 | Covered |
| FR-8 persist on create | task-store.js:55-62; task-service.js:64 | task-store.test.js:95; task-service.test.js:67; app.test.js:68 | Covered |
| FR-9 load on page load | task-service.js:34-45; task-store.js:41-53 | task-store.test.js:30; app.test.js:109 | Covered |
| FR-10 Enter submits | index.html:13-17 (form + submit button); app.js:20 | app.test.js:118 (`requestSubmit`) | Covered except real Enter (manual row 3, unfilled) |
| FR-11 100 code points | task-validator.js:13; task-view.js:6 | task-validator.test.js:65-83; app.test.js:142 | Covered |
| FR-12 clear message on edit/success | app.js:30,40-42; task-view.js:63-67 | app.test.js:161,171 | Covered |
| FR-13 trim | task-validator.js:9 | task-validator.test.js:21; app.test.js:126 | Covered |
| FR-14 duplicates, order | task-service.js:62-63 | task-service.test.js:85; app.test.js:134 | Covered |
| FR-15 storage failure handling | task-store.js:41-71; task-service.js:34-45,47-77; task-view.js:4-11 | task-store.test.js:50-130; task-service.test.js:55-61,152-261; app.test.js:211-244 | Covered, except the recovery flow in CR-1 and `BACKUP_FAILED` text (CR-11b) |
| FR-16 reject changes nothing | task-service.js:49 | task-service.test.js:106,117; app.test.js:180 | Covered |
| FR-17 two tabs | task-service.js:51-62,79-85; app.js:44-48 | task-service.test.js:137,217; cross-tab.test.js:43-111 | Covered; warning refresh gap (CR-7) |
| NFR-1 simple UI | index.html | none (`Not Found`) | Not tested (CR-11d) |
| NFR-2 immediate feedback | app.js:28 | accessibility-and-scale.test.js:111 (<1000 ms in jsdom) | Weak proxy (CR-11e); manual row 18 unfilled |
| NFR-3 responsive, 44 px | styles.css:33-68 | accessibility-and-scale.test.js:101 | Weak assertion (CR-2); manual row 14 unfilled |
| NFR-4 no network | no network API in `src/` | static-checks.test.js:32; task-store.test.js:132 | Covered by grep only (CR-11f) |
| NFR-5 durability | task-service.js:51-66 | app.test.js:109; cross-tab.test.js:75 | Covered |
| NFR-6 no markup injection | task-view.js (`textContent` only); task-store.js:35 | app.test.js:190,201; accessibility-and-scale.test.js:73; static-checks.test.js:28 | Covered |
| NFR-7 accessibility | index.html:22-25; task-view.js:57-79; styles.css:143-154 | accessibility-and-scale.test.js:37-99; app.test.js:76 | Roles, ids, repeat announcements covered; real screen reader and contrast are manual only (unfilled) |
| NFR-8 logic separable | task-validator/store/service.js | task-service.test.js:263 and all unit tests run without a browser | Covered |
| NFR-9 browsers | classic scripts, ES2018 regex | none (`Not Found`) | Not tested; manual row 0-1 unfilled |
| NFR-10 no runtime deps / build | package.json:13-15; index.html:30-35 | static-checks.test.js:36,45,51 | Covered |

## Dependency Audit

| Package | Version | Issue | Action |
|---------|---------|-------|--------|
| jsdom (devDependency, direct) | 28.1.0 (exact pin) | `npm audit`: 0 vulnerabilities. Its `engines` is `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`, identical to package.json. `npm outdated` shows 31.0.0 is latest; the choice to stay on 28.1.0 is documented in architecture section 2 (Node 20 support). | None. Re-check when the minimum Node version is raised. |
| 45 transitive packages (all `dev`) | per package-lock.json (lockfileVersion 3) | 0 audit findings; all `resolved` URLs are registry.npmjs.org. | None. |
| Runtime dependencies | none | `package.json` has no `dependencies`; verified by static-checks.test.js:45. | None. |

## Verdict: Approve with notes

No Blocker or High findings. The implementation matches the approved requirements and architecture, the 144 tests pass, `npm audit` is clean, and no XSS or network sink exists. Before the verification stage, the implementer should fix CR-1 (duplicate tasks after a read failure recovers) and CR-2 (a test that passes without the 44 px rule), and add the missing tests listed in CR-11a. CR-3 to CR-14 are Low and may be fixed in the same pass or recorded as accepted. The manual checklist is entirely unfilled, so layout, the real Enter key, `file://` behaviour and screen-reader behaviour are unverified.


## Fix Round 1

All 14 findings were routed to the implementer. None was a Blocker or High, so no second independent review round was run; the fixes were checked by tests and mutation checks instead (see below). The human can ask for a second review at gate G6.

| Finding | What was done |
|---------|---------------|
| CR-1 | `TaskService` keeps `pending` as "added since the last successful write" in the read-outage branch (`pending.concat([task])`); three unit tests cover outage and recovery flows. |
| CR-2 | NFR-3 test now reads the `button`, input, `.task-title` and `.message` rules through `tests/helpers/css-rule.js`. |
| CR-3 | Validator uses a negated character class; tests with 5 million invisible characters pass without a stack overflow. |
| CR-4 | `TaskStore` rejects ids at or above `Number.MAX_SAFE_INTEGER`; fixture and test added. |
| CR-5 | `TaskStore` takes the validator and treats a saved blank title as unreadable; saved titles over 100 code points are kept (decision: do not lose user data). An absent key (`undefined`) reads as missing. |
| CR-6 | Documented in architecture section 6: ids of unsaved tasks are provisional. |
| CR-7 | `refresh()` returns the warning that applies now; `App` applies it. Two cross-tab tests. |
| CR-8 | `TaskView.showWarning` ignores the code already on screen. Page test checks the node is unchanged. |
| CR-9 | `role="list"` on the task list; test added. |
| CR-10 | All non-ASCII characters in test files are `\u` escapes. |
| CR-11 | (a) recovery-flow tests, (b) `BACKUP_FAILED` and fallback message page tests, (c) FR-1 focus test, (d) NFR-1 element count test, (e) the 500-task test is renamed a smoke test, (f) NFR-4 and (g) FR-10 are marked "automated proxy only" in the traceability matrix. |
| CR-12 | `tests/helpers/page-harness.js` replaces three copies of the page setup; `isUsable(status)` replaces three copies of the status check; the shared `afterEach` now closes every page before asserting. |
| CR-13 | `tasks` renamed `displayed` with comments; the `complete` branch has a test; the five public factories have a one-line comment. |
| CR-14 | Engines text, plan status, checklist contrast claim (now backed by `contrast.test.js`) and the README accessibility claim corrected. |

Not changed: U+FFA0 (halfwidth Hangul filler) is still accepted as a title. The invisible-character list is documented as not exhaustive (architecture risk 5).

Verification after the fixes: `npm test` 174 pass, 0 fail (30 new tests); `npm audit` 0 vulnerabilities; 8 further mutations of the new code were each caught by a test.

## Verdict (after fixes): Approve
