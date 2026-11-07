---
applyTo: "docs/**/*.md,README.md,CHANGELOG.md"
---

# Documentation standards

- Every pipeline artifact starts with `# Title`, then a metadata line (`Based on`, `Version`, `Status`).
- Requirement IDs: `FR-n`, `NFR-n`. Review findings: `DR-n` (design), `CR-n` (code). Tasks: `T-nn`. Never renumber; withdrawn items are struck through.
- Reference other artifacts by relative path (`docs/architecture.md`) and section number. Links must resolve.
- Diagrams use Mermaid fenced blocks. Tables for anything with more than two attributes per item.
- Missing information is written as `Not Found`. Never leave blanks, `TBD`, `N/A` without reason, or invented values.
- Status values: `Draft`, `In review`, `Approved`. Only the orchestrator flips a doc to `Approved` after the human gate.
- Write plainly: short sentences, active voice, no marketing language. One idea per bullet.
- No secrets, tokens, internal hostnames, or personal data in any document. Env vars are shown as names with placeholder values.
- README must be accurate to the code that exists: setup, config (env var names), usage, tests, structure.
- CHANGELOG follows Keep a Changelog (`Added`, `Changed`, `Fixed`, `Security`) under `[Unreleased]` or a versioned heading.
- When code changes behaviour, the docs describing it are updated in the same stage; `docs-sync` verifies.
