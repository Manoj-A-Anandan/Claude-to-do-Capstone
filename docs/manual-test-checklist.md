# Manual Test Checklist — Create a TODO Task

Based on: architecture.md v4, impl-plan.md T-15   Status: Not run

Automated tests use jsdom, which is not a real browser. A headless-browser script (`node tests/browser/browser-smoke.js`) has already run many of these checks in Edge and Chrome; see the "Real-browser findings" section of docs/verification-report.md. It does not replace a human run. These checks cover what jsdom cannot: real layout, the real Enter key, `file://` storage behaviour, and screen readers. The human fills in this table. A cell left as `Not Found` was not run and is listed as a known limitation in the pull request.

## How to run

1. Open `index.html` from disk (double-click or drag it into the browser window) so the address starts with `file://`.
2. Use a fresh profile or clear site data for the page before starting.
3. Record the browser name and version in the header row. Write `Pass`, `Fail: <short note>`, or `N/A`.

## Checks

| # | Check | Requirements | Chrome | Edge | Firefox | Safari |
|---|-------|--------------|--------|------|---------|--------|
| 0 | Browser version and OS | NFR-9 | Not Found | Not Found | Not Found | Not Found |
| 1 | Page opens from `file://` with no console errors and the input, Add Task button, and empty list are visible | FR-1, FR-2, NFR-1, NFR-10 | Not Found | Not Found | Not Found | Not Found |
| 2 | Type "Complete Java revision", click Add Task: task appears at once with status "incomplete", input is empty and focused | FR-3, FR-5, FR-6, FR-7 | Not Found | Not Found | Not Found | Not Found |
| 3 | Type a title and press the Enter key (not the button): task is added the same way | FR-10 | Not Found | Not Found | Not Found | Not Found |
| 4 | Click Add Task with an empty input, then with only spaces: no task, message "Task title cannot be empty." appears, list unchanged | FR-4 | Not Found | Not Found | Not Found | Not Found |
| 5 | Type 101 characters: message about the 100-character limit; text stays in the box; 100 characters is accepted | FR-11 | Not Found | Not Found | Not Found | Not Found |
| 6 | Start typing after an error: message disappears | FR-12 | Not Found | Not Found | Not Found | Not Found |
| 7 | Add "A", "B", "A": three tasks in that order, newest last | FR-14 | Not Found | Not Found | Not Found | Not Found |
| 8 | Refresh the page (F5): all tasks are still listed in order | FR-9, NFR-5 | Not Found | Not Found | Not Found | Not Found |
| 9 | Open the page in two tabs. Add "from tab 1" in tab 1, then "from tab 2" in tab 2: tab 2 shows both; tab 1 updates to show both without a refresh; after refreshing either tab both remain | FR-17 | Not Found | Not Found | Not Found | Not Found |
| 10 | Developer tools: Application > Local Storage shows key `todo-app.tasks.v1` with the tasks; Network tab shows no requests when adding a task | FR-8, NFR-4 | Not Found | Not Found | Not Found | Not Found |
| 11 | In devtools set `todo-app.tasks.v1` to `garbage` and reload: a warning appears, the page works; add a task: warning goes away, `todo-app.tasks.v1.unreadable` holds `garbage` | FR-15 | Not Found | Not Found | Not Found | Not Found |
| 12 | Open in a private/incognito window with site storage blocked (if the browser allows): page works, warning about saving appears | FR-15 | Not Found | Not Found | Not Found | Not Found |
| 13 | Add the title `<img src=x onerror=alert(1)>`: it is shown as text, no alert box | NFR-6 | Not Found | Not Found | Not Found | Not Found |
| 14 | Resize to 320 px wide (devtools device mode) and 1920 px: no horizontal scrollbar; Add Task button is at least 44 x 44 px; a 100-character title without spaces wraps | NFR-3 | Not Found | Not Found | Not Found | Not Found |
| 15 | Keyboard only: Tab reaches the input then the button, a focus outline is visible, Enter in the input adds, no mouse needed | NFR-7 | Not Found | Not Found | Not Found | Not Found |
| 16 | Screen reader (NVDA or Narrator on Windows, VoiceOver on Mac): submitting an empty title announces the error; adding a task announces "Task added: <title>"; adding the same title twice announces it twice | NFR-7, DD-5 | Not Found | Not Found | Not Found | Not Found |
| 17 | Contrast: error, warning, button, and status text are readable (`tests/unit/contrast.test.js` checks the text colour pairs in the stylesheet are at least 4.5:1, lowest 6.39:1; confirm visually, including focus outlines and the error and warning boxes) | NFR-7 | Not Found | Not Found | Not Found | Not Found |
| 18 | Load 500 tasks (paste a 500-item JSON array into the storage key, reload), then add one: the new task appears with no visible delay | NFR-2 | Not Found | Not Found | Not Found | Not Found |
| 19 | Move the folder, open `index.html` from the new location: note whether saved tasks appear (Chrome shares storage across local files; Firefox scopes it per file) | FR-9 | Not Found | Not Found | Not Found | Not Found |

## Sign-off

Tester: Not Found   Date: Not Found   Overall result: Not Found
