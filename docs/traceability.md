# Traceability Matrix

Updated after stage: 2 (Architecture)

## Story → Requirement

| Story item | Requirement |
|------------|-------------|
| Functional 1-9 | FR-1 to FR-9 (same order) |
| Scenario S1 | FR-3, FR-5, FR-6 |
| Scenario S2, S3 | FR-4, FR-16 |
| Scenario S4 | FR-7 |
| Scenario S5 | FR-8, FR-9 |
| Non-functional 1-5 | NFR-1, NFR-2, NFR-3, NFR-4, NFR-5 |
| Added from clarification | FR-10 to FR-15, NFR-6 to NFR-10 |

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
| FR-15 | TaskStore, TaskService, TaskView | Not Found | Not Found | Not Found | Designed |
| FR-16 | TaskService | Not Found | Not Found | Not Found | Designed |
| NFR-1 | index.html, styles.css | Not Found | Not Found | Not Found | Designed |
| NFR-2 | App, TaskView (synchronous render in the submit handler) | Not Found | Not Found | Not Found | Designed |
| NFR-3 | styles.css | Not Found | Not Found | Not Found | Designed |
| NFR-4 | TaskStore (no network code anywhere; CSP) | Not Found | Not Found | Not Found | Designed |
| NFR-5 | TaskStore, TaskService | Not Found | Not Found | Not Found | Designed |
| NFR-6 | TaskView, TaskStore (validation on load) | Not Found | Not Found | Not Found | Designed |
| NFR-7 | index.html, TaskView, styles.css | Not Found | Not Found | Not Found | Designed |
| NFR-8 | TaskValidator, TaskStore, TaskService (DOM-free); test setup | Not Found | Not Found | Not Found | Designed |
| NFR-9 | Plain ES2015+ syntax, no experimental APIs | Not Found | Not Found | Not Found | Designed |
| NFR-10 | Module pattern, project structure, package.json | Not Found | Not Found | Not Found | Designed |
