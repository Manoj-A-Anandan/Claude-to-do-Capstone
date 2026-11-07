# Repository-wide Copilot Instructions — Agentic SDLC Pipeline

This repository runs a **human-in-the-loop Agentic SDLC**: a user story goes in, a reviewed Pull Request comes out. Every phase is performed by a dedicated custom agent in `.github/agents/`, coordinated by `sdlc-orchestrator`.

## Pipeline at a glance

| # | Stage | Agent | Artifact |
|---|-------|-------|----------|
| 1 | Requirements | `requirements-analyst` | `docs/requirements.md` |
| 2 | Architecture | `architect` | `docs/architecture.md` |
| 3 | Design review | `design-reviewer` | `docs/design-review.md` (+ updates `architecture.md`) |
| 4 | Implementation planning | `implementation-planner` | `docs/impl-plan.md` |
| 5 | Implementation | `implementer` | code + tests under `src/`, `tests/` |
| 6 | Code review | `code-reviewer` | `docs/code-review.md` |
| 7 | Verify | `verifier` | `docs/verification-report.md` |
| 8 | Pull request | `pr-creator` | `docs/pr-description.md`, `CHANGELOG.md`, the PR |
| * | Docs sync (after every stage) | `docs-sync` | `docs/traceability.md`, README, CHANGELOG |

## Ground rules (apply to every agent)

1. **Human approval gates.** No stage's output is final until the human approves it in chat. Never skip a gate, never self-approve.
2. **Stay in your lane.** Each agent edits only the artifacts it owns (see table). Cross-artifact fixes go through `docs-sync` or back to the owning agent.
3. **Source of truth order:** user story → `requirements.md` → `architecture.md` → `impl-plan.md` → code. A downstream document must never contradict an upstream one; if it must, raise it as a finding.
4. **Traceability.** Every requirement has an ID (`FR-n`, `NFR-n`). Architecture components, plan tasks, tests, and PR checklist items reference those IDs.
5. **Never invent facts.** If information is missing from the user story or a source system, write `Not Found` (exactly that string) rather than guessing. Ask the human when the gap blocks progress.
6. **Secrets.** Never print, log, commit, or write tokens, passwords, keys, or connection strings. Use environment variables and `.env.example` placeholders only.
7. **Small, reversible steps.** Prefer minimal diffs. Never force-push, never push to `main`/`master`, never delete user files without confirmation.
8. **Pipeline state** lives in `.sdlc/state.md`. Only the orchestrator writes it.
9. **Subagents cannot talk to the human.** If you need an answer, return an `OPEN QUESTIONS` block to the orchestrator and stop; do not guess.

## Conventions

- Markdown artifacts live in `docs/`. User stories are dropped in `user-story/`.
- Commit messages: Conventional Commits (`docs:`, `feat:`, `test:`, `fix:`, `chore:`), one commit per approved stage.
- Work on branch `feature/<story-slug>`; the orchestrator creates it after the human approves.
- Detailed, file-scoped rules are in `.github/instructions/*.instructions.md`.
