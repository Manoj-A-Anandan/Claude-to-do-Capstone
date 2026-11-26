# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- SDLC workflow: every stage now has a documented contract (W1-W18) and a retry loop of at most 2 attempts, with a retry ledger that records attempts, failure reasons and one-time side effects.
- SDLC workflow: engineering skills for requirements, architecture, JavaScript implementation, code review (15-point checklist), testing and verification.
- SDLC workflow: every pull request body carries an "AI-Assisted Pull Request" disclosure, validated before the PR is created.

### Changed
- Code review severities are now Blocker, Major, Minor and Suggestion; the reviewer reports findings and never edits code.
- Verification status can now be PASS, FAIL or BLOCKED.

## [0.1.0] - 2026-11-07

### Added
- Create a TODO task by entering a title and pressing **Add Task** or Enter; the task is listed at once as incomplete.
- Validation messages for empty, whitespace-only, invisible-character-only, and over-100-character titles.
- Tasks are saved in browser local storage and shown again after a refresh.
- Warnings when local storage is blocked, its data is unreadable, or a task cannot be saved; unreadable data is backed up before it is replaced.
- Several open tabs stay consistent: new tasks are merged into the saved list and other tabs update.
- Screen-reader announcements for validation errors and for each added task.
- Responsive layout for desktop and mobile widths.
- Automated tests (unit and jsdom page tests), a headless Edge/Chrome smoke script, and a manual browser checklist.

### Security
- Task titles are always inserted as plain text, so markup in a title is shown literally and never run.
- The page makes no network requests and has no runtime dependencies.
