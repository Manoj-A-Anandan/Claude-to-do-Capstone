# SDLC Workflow Documentation

Based on: `.claude/agents/sdlc-orchestrator.agent.md`   Version: 1   Status: Draft

| Document | Purpose |
|----------|---------|
| [orchestrator.md](orchestrator.md) | The 18 workflow stages (W1-W18): agent, inputs, outputs, preconditions, validation, next stage, failure handling, human approvals; the retry protocol; the revision-cycle rules; limitations |
| [implementation-report.md](implementation-report.md) | What changed in response to the review feedback, with validation evidence and a screenshot checklist |

## How the pieces fit

- **Orchestrator** (`.claude/agents/sdlc-orchestrator.agent.md`) controls sequence, delegation, validation, retries and human gates.
- **Agents** (`.claude/agents/*.agent.md`): `requirements-analyst`, `architect`, `design-reviewer`, `implementation-planner`, `implementer`, `code-reviewer`, `verifier`, `docs-sync`, `pr-creator`. Each runs one responsibility.
- **Skills and instructions** supply engineering knowledge: `requirements-engineering`, `architecture-design`, `js-implementation`, `code-review-checklist`, `testing-practices`, `verification-practices`, `pr-authoring`, `docs-sync-check`, `user-story-intake`, plus the `security`, `code`, `testing`, `documentation` and `agent-collaboration` instructions.
- **Tooling** (`scripts/sdlc/`): `retry-ledger.js` (attempt counter, failure reasons, one-time side effects, gate state), `check-pr-body.js` (AI disclosure and PR structure), and three check files run by `npm run test:sdlc`.

## Key rules in one place

1. Each agent-executed stage has at most 2 attempts; the retry receives the failure reason; a second failure is `BLOCKED` and nothing downstream runs.
2. Human **Request changes** is a revision cycle, not a failure; the same gate is shown again; it is never bypassed.
3. Commits, push, PR creation and PR comments run once (ledger key plus a check of the real remote state).
4. Every PR body carries the "AI-Assisted Pull Request" disclosure; the workflow never merges.
5. The code reviewer reports findings (Blocker, Major, Minor, Suggestion, each with `path:line`); only the implementer changes code.

## Runtime files

| File | Written by | Content |
|------|-----------|---------|
| `.sdlc/state.md` | orchestrator | Stage status, decisions, docs-sync log, retry summary |
| `.sdlc/retry-ledger.json` | `scripts/sdlc/retry-ledger.js` | Attempts, revisions, history per stage, side-effect keys |
| `.sdlc/retry-log.md` | `scripts/sdlc/retry-ledger.js` | Readable table rendered from the ledger |
