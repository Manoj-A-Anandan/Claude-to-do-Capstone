# feat: create a TODO task with local storage persistence

## Summary

Adds the "Create a TODO Task" story (`user-story/user-story-create-todo-task.md`): a single-page TODO app where a user types a task title, presses **Add Task** or Enter, sees the task listed as incomplete, and finds it again after a refresh because it is saved in browser local storage. It is plain HTML, CSS and JavaScript with no build step and no runtime dependencies, so it opens straight from `index.html`. The work was produced stage by stage (requirements, architecture, design review, plan, implementation, code review, verification), each approved by a human; the documents are in `docs/`.

## Changes Made

Application
- `index.html` — added — page markup: labelled input, **Add Task** button, error / warning / confirmation regions, task list, script loading (FR-1, FR-2, FR-10, NFR-1, NFR-7; T-06).
- `src/styles.css` — added — responsive layout, 44 px targets, contrast, visually hidden helper (NFR-3, NFR-7; T-06).
- `src/task-validator.js` — added — trims titles; rejects blank, invisible-only and over-100-code-point titles (FR-4, FR-11, FR-13; T-03).
- `src/task-store.js` — added — local storage read / write / backup, with unavailable, unreadable and missing cases handled (FR-8, FR-9, FR-15; T-04).
- `src/task-service.js` — added — task list, ids, read-modify-write across tabs, unsaved-task tracking, warnings (FR-3, FR-6, FR-14, FR-15, FR-16, FR-17; T-05).
- `src/task-view.js` — added — renders the list and messages with `textContent` only (FR-5, FR-7, FR-12, NFR-6, NFR-7; T-07).
- `src/app.js` — added — wires events: submit, typing, cross-tab `storage` (FR-10, FR-12, FR-17; T-08).

Project files
- `package.json`, `package-lock.json` — added — `npm test`, Node engines, jsdom 28.1.0 as the only (dev) dependency (NFR-10; T-01).
- `.gitattributes` — added — keeps LF line endings on Windows checkouts (verification defect D-1).
- `.gitignore` — modified — ignores local `.claude/` settings.
- `README.md` — modified — app usage, tests, structure; the existing pipeline description is kept below it (T-16).
- `CHANGELOG.md` — added — 0.1.0 entry.

Tests (185, plus a browser script)
- `tests/unit/task-validator.test.js`, `task-store.test.js`, `task-service.test.js` — added — rules, storage failure modes, ids, recovery flows (T-03 to T-05).
- `tests/unit/contrast.test.js`, `helpers.test.js` — added — contrast of every text colour pair from the stylesheet; helper self-tests.
- `tests/integration/app.test.js` — added — acceptance scenarios S1 to S5 on the real page in jsdom (T-10).
- `tests/integration/cross-tab.test.js`, `accessibility-and-scale.test.js`, `static-checks.test.js`, `secret-leakage.test.js` — added — two tabs, ARIA, 500 tasks, no HTML sinks or network calls, no secrets (T-11 to T-14).
- `tests/browser/browser-smoke.js` — added — dependency-free script that drives headless Edge or Chrome against `file://`; not part of `npm test`.
- `tests/helpers/*.js` (5 files) — added — fake storage, module loader, jsdom page, page harness, CSS rule reader.
- `tests/fixtures/*` (14 files) — added — saved-data samples: valid, corrupt, bad ids, blank titles, 5,000-character title.

Documents (`docs/`)
- `requirements.md`, `architecture.md`, `design-review.md`, `impl-plan.md`, `code-review.md`, `verification-report.md`, `traceability.md`, `manual-test-checklist.md` — added — one per pipeline stage plus requirement-to-test traceability and the human browser checklist.
- `.sdlc/state.md` — added — pipeline resume state.

## Test Evidence

Run on Windows 11, Node v24.22.0, 2026-11-07 (from `docs/verification-report.md` and a fresh run during PR drafting):

```
$ npm test
ℹ tests 185
ℹ suites 0
ℹ pass 185
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ npm audit
found 0 vulnerabilities

$ node tests/browser/browser-smoke.js
Browser: Edg/156.0.4314.58 (msedge.exe), win32 10.0.26200
Summary: 56 passed, 0 failed, 1 info
Cleanup: browser stopped, temp profile deleted
```

- Coverage (Node test runner): `task-validator.js` 100% lines / 92.31% branches, `task-store.js` 100% / 92.68%, `task-service.js` 100% / 95.45%. `app.js` and `task-view.js` run inside jsdom and cannot be measured: `Not Found`.
- The script also passed in Chrome 156 during verification.
- The verifier changed the source 15 ways by hand and the tests failed each time.
- Text colour contrast: lowest pair 6.39:1 (limit 4.5:1).
- No CI is configured for this repository, so there is no CI link.

## Known Limitations

- **Manual checklist not run.** `docs/manual-test-checklist.md` is entirely `Not Found`; nobody has signed it off. Firefox, Safari, real mobile devices and screen readers (NVDA, Narrator, VoiceOver) were not tested. Edge 156 and Chrome 156 were run headless on Windows only. Whether announcements are actually spoken is `Not Found`.
- Blocked storage and a full quota were simulated inside a real browser (a throwing getter and `setItem`); a real private window and the browser's "block site data" setting were not tried. Moving the folder and Firefox's per-file storage scoping were not tested.
- Only Node 24.22 was used; the lower supported versions (20.19, 22.12) were not run.
- Coverage of `app.js` and `task-view.js` cannot be measured (jsdom); they are covered by page tests, hand mutations and the browser script.
- Out of scope by the story: editing, deleting, completing tasks, due dates, reminders, authentication, any server.
- Design limits accepted in review: the invisible-character list is not exhaustive (for example U+FFA0 is accepted as a title); a family emoji counts as several code points toward the 100 limit; one bad saved record makes the whole saved list unreadable (it is backed up under `todo-app.tasks.v1.unreadable` before being replaced); two tabs adding at the same instant could still race, bounded by the browser's cross-tab delay; ids of unsaved tasks are provisional.
- Tasks belong to the browser and the file's location; moving the folder or changing browser shows a different list.
- Architecture v3 was not given a third independent design review (two-round limit); the code review's 14 findings were fixed and checked by tests and mutations, without a second independent review round.

## Reviewer Checklist

- [ ] Requirements in `docs/requirements.md` are met; check the FR / NFR rows in `docs/traceability.md`
- [ ] Architecture matches `docs/architecture.md` (v4); the jsdom `requestInterceptor` and Node engine range deviations are documented
- [ ] No secrets, tokens or personal data in code, config, fixtures, logs or output (the page reads no environment variables and makes no network calls)
- [ ] Input validation and error handling reviewed: empty, whitespace, invisible-only and over-long titles; blocked, full or corrupt local storage
- [ ] Tests cover the happy path and the missing-data / failure cases, and all pass (`npm install`, `npm test`)
- [ ] Dependencies reviewed: jsdom 28.1.0 is the only dependency and is dev-only; `npm audit` is clean
- [ ] Docs are in sync: README, CHANGELOG, `docs/traceability.md`; there is no `.env.example` because the app has no configuration
- [ ] Known limitations are acceptable, or the manual checklist (`docs/manual-test-checklist.md`) has been run before merge
- [ ] Open `index.html` from disk in a browser you care about and add, refresh and add in two tabs
