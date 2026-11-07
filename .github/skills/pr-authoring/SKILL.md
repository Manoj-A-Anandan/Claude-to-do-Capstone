---
name: pr-authoring
description: Rules and checklist for writing the PR title, the five required PR sections (Summary, Changes Made, Test Evidence, Known Limitations, Reviewer Checklist) and the changelog entry. Use in the PR stage.
---

# PR authoring

## Title
Conventional Commit style, under 70 characters: `feat: sync docs from repository metadata`.

## Required sections (all five, in this order)
1. **Summary** — 2-3 sentences: what was built, why, link to the story.
2. **Changes Made** — bullets `path — added|modified — reason (T-xx, FR-x)`. Every file in `git diff --stat` appears.
3. **Test Evidence** — real command lines and output (pass/fail counts, coverage) from `docs/verification-report.md`, or a CI link. Never paraphrase failures away.
4. **Known Limitations** — `Not Found` items, out-of-scope, deferred findings (DR-/CR- ids), accepted risks, unverified areas.
5. **Reviewer Checklist** — tick-list the reviewer completes before approving (requirements met, architecture matches, no secrets, error handling, tests incl. edge cases, dependencies, docs in sync, limitations acceptable).

## Changelog entry
Keep a Changelog groups: Added, Changed, Fixed, Security. User-visible behaviour only, one line each, past tense not required but be consistent.

## Pre-publish gate
- Working tree contains only intended files; no secrets (`git diff` scan for token-like strings).
- Docs-sync `final-scope` reported in sync.
- Show the push and `gh pr create` commands to the human before executing. Never force-push or push to main/master.
