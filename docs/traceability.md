# Traceability Matrix

Updated after stage: 4 (Implementation planning)

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
| FR-1 | index.html | T-06, T-10 | Not Found | Not Found | Planned |
| FR-2 | index.html | T-06, T-10 | Not Found | Not Found | Planned |
| FR-3 | App, TaskService, TaskValidator | T-05, T-08, T-10 | Not Found | Not Found | Planned |
| FR-4 | TaskValidator, TaskService, TaskView | T-03, T-05, T-07, T-10 | Not Found | Not Found | Planned |
| FR-5 | TaskView, App | T-07, T-08, T-10 | Not Found | Not Found | Planned |
| FR-6 | TaskService, TaskView | T-05, T-07, T-10 | Not Found | Not Found | Planned |
| FR-7 | TaskView, App | T-07, T-08, T-10 | Not Found | Not Found | Planned |
| FR-8 | TaskStore, TaskService | T-04, T-05 | Not Found | Not Found | Planned |
| FR-9 | TaskStore, TaskService, App | T-04, T-08, T-10 | Not Found | Not Found | Planned |
| FR-10 | index.html (form), App | T-06, T-08, T-10 | Not Found | Not Found | Planned |
| FR-11 | TaskValidator, TaskView | T-03, T-07, T-10 | Not Found | Not Found | Planned |
| FR-12 | App, TaskView | T-07, T-08, T-10 | Not Found | Not Found | Planned |
| FR-13 | TaskValidator, TaskService | T-03, T-05, T-10 | Not Found | Not Found | Planned |
| FR-14 | TaskService | T-05, T-10 | Not Found | Not Found | Planned |
| FR-15 | TaskStore (read, backup), TaskService (`pending`), TaskView (warnings) | T-04, T-05, T-07 | Not Found | Not Found | Planned |
| FR-16 | TaskService | T-05, T-10 | Not Found | Not Found | Planned |
| FR-17 | TaskService (read-modify-write, `pending`), App (`storage` listener) | T-05, T-08, T-13 | Not Found | Not Found | Planned |
| NFR-1 | index.html, styles.css | T-06 | Not Found | Not Found | Planned |
| NFR-2 | App, TaskView (synchronous full re-render in the submit handler; 500-task smoke test and manual timing) | T-07, T-12, T-15 | Not Found | Not Found | Planned |
| NFR-3 | styles.css | T-06, T-15 | Not Found | Not Found | Planned |
| NFR-4 | TaskStore (no network code anywhere; static grep test) | T-04, T-11 | Not Found | Not Found | Planned |
| NFR-5 | TaskStore, TaskService (read-modify-write, storage event refresh) | T-04, T-05, T-13 | Not Found | Not Found | Planned |
| NFR-6 | TaskView, TaskStore (validation on load) | T-04, T-07, T-10, T-11 | Not Found | Not Found | Planned |
| NFR-7 | index.html, TaskView, styles.css | T-06, T-07, T-14, T-15 | Not Found | Not Found | Planned |
| NFR-8 | TaskValidator, TaskStore, TaskService (DOM-free); test helpers | T-01, T-02, T-03, T-04, T-05, T-09, T-17 | Not Found | Not Found | Planned |
| NFR-9 | Plain ES2018 syntax (Unicode property escapes), no experimental APIs | T-15 | Not Found | Not Found | Planned |
| NFR-10 | File pattern, project structure, package.json | T-01, T-11, T-16, T-17 | Not Found | Not Found | Planned |
