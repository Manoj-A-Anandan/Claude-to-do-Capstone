# Requirements — Create a TODO Task

Source: user-story/user-story-create-todo-task.md   Version: 1   Status: Draft

## 1. User Story

As a TODO application user, I want to create a task by entering a task title, so that I can keep track of the activities I need to complete.

Acceptance scenarios from the source: (S1) successfully create a task, (S2) prevent empty task creation, (S3) prevent whitespace-only task creation, (S4) clear input after task creation, (S5) persist tasks after browser refresh. They are expanded in the acceptance criteria below.

## 2. Scope

In scope: a single-page, single-user TODO page where the user enters a title, adds a task, sees the task list, and has tasks persisted in browser local storage.

Out of scope (from the story): editing tasks, deleting tasks, marking tasks completed, due dates and reminders, user authentication, server-side database or any backend.

## 3. Functional Requirements

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-1 | The system shall provide an input field for entering a task title. | Must | Given the page is loaded, When I view it, Then a labelled text input is visible and focusable. |
| FR-2 | The system shall provide an **Add Task** button. | Must | Given the page is loaded, When I view it, Then a button labelled "Add Task" is visible. |
| FR-3 | The system shall create a task when the user enters a valid title and clicks **Add Task**. | Must | S1: Given I am on the page, When I enter "Complete Java revision" and click Add Task, Then the task "Complete Java revision" appears in the task list. |
| FR-4 | The system shall reject a title that is empty or contains only whitespace, shall not create a task, and shall display a validation message. | Must | S2/S3: Given the input is empty (or only spaces/tabs), When I click Add Task, Then no task is created, the list is unchanged, and a validation message is displayed. |
| FR-5 | The system shall display a newly created task in the task list immediately, without a page reload. | Must | Given a valid title, When the task is created, Then it is visible in the list in the same user action. |
| FR-6 | The system shall give each newly created task an incomplete status by default. | Must | S1: Given a task was just created, Then it is shown with an incomplete status. |
| FR-7 | The system shall clear the input field after a task is created successfully. | Must | S4: Given a valid title, When the task is added, Then the input field is empty. |
| FR-8 | The system shall persist tasks in the browser's local storage whenever a task is created. | Must | Given a task was created, When local storage is inspected, Then it contains that task. |
| FR-9 | The system shall load previously saved tasks from local storage on page load and display them. | Must | S5: Given I created a task, When I refresh the browser, Then the task still appears in the list with its status. |
| FR-10 | The system shall also create the task when the user presses Enter in the input field, with the same validation and behaviour as clicking **Add Task**. | Should | Given a valid title in the input, When I press Enter, Then the task is created exactly as in FR-3. |
| FR-11 | The system shall reject a title longer than 100 characters (after trimming), shall not create a task, and shall display a validation message stating the limit. | Should | Given a 101-character title, When I click Add Task, Then no task is created and a message mentions the 100-character limit. A 100-character title is accepted. |
| FR-12 | The system shall remove the validation message once the user edits the input or creates a task successfully. | Should | Given a validation message is visible, When I type in the input, Then the message is no longer shown. |
| FR-13 | The system shall store and display the task title with leading and trailing whitespace removed. | Must | Given the input "  Buy milk  ", When I add it, Then the task title is "Buy milk". |
| FR-14 | The system shall allow tasks with identical titles and shall display tasks in creation order, the newest at the bottom of the list. | Must | Given I add "A" then "B" then "A", Then three tasks are shown in the order A, B, A. |
| FR-15 | If local storage is unavailable or the saved data cannot be read as a valid task list, the system shall show a non-blocking warning message, continue to work with tasks held in memory for the session, and shall not overwrite the unreadable stored data until a task is successfully created. | Should | Given saved data is not valid, When the page loads, Then a warning is shown, the page is usable, and adding a task works in memory. |
| FR-16 | When a task creation is rejected (FR-4, FR-11), the system shall leave the persisted tasks and the displayed list unchanged. | Must | Given an invalid title, When I click Add Task, Then local storage and the list are identical to before. |

## 4. Non-Functional Requirements

| ID | Category | Requirement | Measurable target |
|----|----------|-------------|-------------------|
| NFR-1 | Usability | The interface shall be simple and user-friendly: one input, one button, one list, one message area. | No more than 4 primary visible elements; creating a task takes one entry and one click. |
| NFR-2 | Performance | Task creation shall give immediate feedback. | The new task is rendered in the same event handler, and perceived delay is under 100 ms for lists up to 500 tasks. |
| NFR-3 | Usability / responsive | The page shall work on desktop and mobile layouts. | Usable with no horizontal scrolling from 320 px to 1920 px viewport width; Add Task button tap target at least 44x44 px. |
| NFR-4 | Reliability / data | Task data shall be stored only in the browser's local storage; no network requests for task data. | 0 network requests for task data (verified in browser devtools or test). |
| NFR-5 | Reliability / durability | Task data shall not be lost during normal browser refreshes. | 100% of tasks created before a refresh are present after it. |
| NFR-6 | Security | Task titles shall be displayed as plain text and never interpreted as markup or script. | A title such as `<img src=x onerror=alert(1)>` is shown literally and executes nothing; verified by test. |
| NFR-7 | Accessibility | The page shall be operable by keyboard and compatible with screen readers. | Input has an associated label; validation messages are announced (live region); all controls reachable by Tab; colour contrast at least 4.5:1. |
| NFR-8 | Maintainability / testability | Task logic (validation, creation, persistence) shall be separable from the DOM so it can be tested automatically. | Unit tests cover every FR and run without a browser; at least one automated test per acceptance scenario S1-S5. |
| NFR-9 | Portability | The application shall run in current desktop and mobile browsers that support JavaScript and local storage. | Latest two stable versions of Chrome, Edge, Firefox, and Safari. |
| NFR-10 | Maintainability | The application shall have no runtime dependencies and no build step. | Runs by opening `index.html`; `package.json` lists no runtime `dependencies`. |

## 5. Data & Interfaces

- Input: one text string (task title) from a form field.
- Task record: title (string), status (incomplete), unique identity, creation order. Exact field names and storage key are an architecture decision.
- Output: the rendered task list and a message area for validation or storage warnings.
- External systems: none. Browser local storage is the only persistence.
- Missing data rule: if a stored task record lacks a title, it is treated as unreadable data under FR-15 rather than shown blank.

## 6. Assumptions

1. Technology is vanilla HTML, CSS, and JavaScript (human decision, 2026-11-07).
2. The application is a local, single-user app; no backend (from the story).
3. The browser supports JavaScript and local storage (from the story).
4. Status display shows "incomplete" only, because completing tasks is out of scope; the status is stored so a later story can use it.
5. The page title or header text is not specified; the text "TODO" is used.
6. Validation message wording is not specified; the exact text is chosen during implementation: "Task title cannot be empty." and "Task title must be 100 characters or fewer."
7. No limit is imposed on the number of tasks; NFR-2 is verified up to 500.

## 7. Constraints

- No server-side component, authentication, or external database.
- Persistence limited to local storage capacity (typically about 5 MB).
- Private browsing modes may disable or clear local storage; FR-15 covers the unavailable case.

## 8. Open Items

None blocking.

## 9. Clarification Log

| # | Question | Answer | Answered by | Date |
|---|----------|--------|-------------|------|
| 1 | Technology stack | Vanilla HTML/CSS/JS | Human | 2026-11-07 |
| 2 | Should Enter submit? Maximum title length? | Enter submits; maximum 100 characters | Human | 2026-11-07 |
| 3 | Duplicates and list order | Duplicates allowed; newest at the bottom; titles trimmed | Human | 2026-11-07 |
| 4 | Local storage unavailable or corrupt | Show a non-blocking warning and continue in memory | Human | 2026-11-07 |
