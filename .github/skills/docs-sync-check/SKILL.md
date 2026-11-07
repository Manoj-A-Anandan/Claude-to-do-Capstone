---
name: docs-sync-check
description: Checklist and procedure for verifying that README, CHANGELOG, docs/*.md, traceability, env vars and generated output documents are consistent with each other and with the code. Use during docs-sync and output-document verification.
---

# Docs sync check

## A. Cross-document consistency
- [ ] Every `FR-`/`NFR-` ID in requirements.md appears in architecture.md §12, impl-plan.md §7, and traceability.md.
- [ ] Every component in architecture.md §4 is named identically in impl-plan.md and in code (module/class names).
- [ ] Every task in impl-plan.md has a valid dependency ID and a status; `Done` tasks have code and tests.
- [ ] Every `DR-` finding marked Resolved has a matching change in architecture.md revision history.
- [ ] Every `CR-` finding Fixed is reflected in code/tests; Open ones appear in the PR "Known Limitations".
- [ ] File paths and relative links in all docs resolve (`ls`/`test -e` each path).

## B. Docs vs code
- [ ] README setup/usage commands exist (scripts, entry points, flags) and run as written.
- [ ] Env vars read in code == env vars in `.env.example` == env vars in README (names only).
- [ ] Project structure in README/architecture §10 matches the actual tree.
- [ ] CHANGELOG `[Unreleased]` covers each user-visible change since the last release.

## C. Generated output document
- [ ] All required sections/fields present, in the specified order.
- [ ] Absent data shows `Not Found`; no blank cells, `null`, `None`, `TBD`, `undefined`.
- [ ] No secrets, tokens, absolute local paths, stack traces.
- [ ] Markdown valid: balanced code fences, tables have matching column counts, links resolve.
- [ ] Spot-check 5 factual values against the source fixture.
- [ ] Re-running generation on unchanged input yields an identical document (idempotent), apart from declared timestamps.

## D. Reporting
Classify each failure as Mechanical (fix) or Semantic (report both quotes). Output in the DOCS-SYNC REPORT format defined in `docs-sync.agent.md`.

## Useful commands
- IDs used vs defined: grep `-oE '(FR|NFR)-[0-9]+'` across `docs/` and diff the sets.
- Broken links: extract `](path)` targets and test existence.
- Fence balance: count lines starting with three backticks; the number must be even.
