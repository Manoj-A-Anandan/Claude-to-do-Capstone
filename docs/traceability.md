# Traceability Matrix

Updated after stage: 3 (Design review)

## Story → Requirement

| Story item | Requirement |
|------------|-------------|
| Functional 1-9 | FR-1 to FR-9 (same order) |
| Scenario S1 | FR-3, FR-5, FR-6 |
| Scenario S2, S3 | FR-4, FR-16 |
| Scenario S4 | FR-7 |
| Scenario S5 | FR-8, FR-9 |
| Non-functional 1-5 | NFR-1, NFR-2, NFR-3, NFR-4, NFR-5 |
| Added from clarification | FR-10 to FR-15, NFR-6 to NFR-10; FR-17 from design review DD-1 |

## Requirement → Downstream

| Requirement | Component | Task | Code | Test | Status |
|-------------|-----------|------|------|------|--------|
| FR-1 | index.html | Not Found | Not Found | Not Found | Designed |
| FR-2 | index.html | Not Found | Not Found | Not Found | Designed |
| FR-3 | App, TaskService, TaskValidator | Not Found | Not Found | Not Found | Designed |
| FR-4 | TaskValidator, TaskService, TaskView | Not Found | Not Found | Not Found | Designed |
| FR-5 | TaskView, App | Not Found | Not Found | Not Found | Designed |
| FR-6 | TaskService, TaskView | Not Found | Not Found | Not Found | Designed |
| FR-7 | TaskView, App | Not Found | Not Found | Not Found | Designed |
| FR-8 | TaskStore, TaskService | Not Found | Not Found | Not Found | Designed |
| FR-9 | TaskStore, TaskService, App | Not Found | Not Found | Not Found | Designed |
| FR-10 | index.html (form), App | Not Found | Not Found | Not Found | Designed |
| FR-11 | TaskValidator, TaskView | Not Found | Not Found | Not Found | Designed |
| FR-12 | App, TaskView | Not Found | Not Found | Not Found | Designed |
| FR-13 | TaskValidator, TaskService | Not Found | Not Found | Not Found | Designed |
| FR-14 | TaskService | Not Found | Not Found | Not Found | Designed |
| FR-15 | TaskStore (read, backup), TaskService (`pending`), TaskView (warnings) | Not Found | Not Found | Not Found | Designed |
| FR-16 | TaskService | Not Found | Not Found | Not Found | Designed |
| FR-17 | TaskService (read-modify-write, `pending`), App (`storage` listener) | Not Found | Not Found | Not Found | Designed |
| NFR-1 | index.html, styles.css | Not Found | Not Found | Not Found | Designed |
| NFR-2 | App, TaskView (synchronous full re-render in the submit handler; 500-task smoke test and manual timing) | Not Found | Not Found | Not Found | Designed |
| NFR-3 | styles.css | Not Found | Not Found | Not Found | Designed |
| NFR-4 | TaskStore (no network code anywhere; static grep test) | Not Found | Not Found | Not Found | Designed |
| NFR-5 | TaskStore, TaskService (read-modify-write, storage event refresh) | Not Found | Not Found | Not Found | Designed |
| NFR-6 | TaskView, TaskStore (validation on load) | Not Found | Not Found | Not Found | Designed |
| NFR-7 | index.html, TaskView, styles.css | Not Found | Not Found | Not Found | Designed |
| NFR-8 | TaskValidator, TaskStore, TaskService (DOM-free); test helpers | Not Found | Not Found | Not Found | Designed |
| NFR-9 | Plain ES2018 syntax (Unicode property escapes), no experimental APIs | Not Found | Not Found | Not Found | Designed |
| NFR-10 | File pattern, project structure, package.json | Not Found | Not Found | Not Found | Designed |
