# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Create a TODO task by entering a title and pressing **Add Task** or Enter; the task is listed at once as incomplete.
- Validation messages for empty, whitespace-only, invisible-character-only, and over-100-character titles.
- Tasks are saved in browser local storage and shown again after a refresh.
- Warnings when local storage is blocked, its data is unreadable, or a task cannot be saved; unreadable data is backed up before it is replaced.
- Several open tabs stay consistent: new tasks are merged into the saved list and other tabs update.
- Screen-reader announcements for validation errors and for each added task.
- Responsive layout for desktop and mobile widths.
- Automated tests (unit and jsdom page tests), a headless Edge/Chrome smoke script, and a manual browser checklist.
