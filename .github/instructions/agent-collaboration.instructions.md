---
applyTo: ".github/agents/**,.github/prompts/**,.sdlc/**"
---

# Agent collaboration protocol

- The orchestrator is the only agent that talks to the human and the only one that writes `.sdlc/state.md`.
- Subagents receive a self-contained brief and return a structured report: `files changed`, `summary`, `OPEN QUESTIONS` (if any), `risks`. They never assume prior conversation.
- `OPEN QUESTIONS` format: numbered, each with a suggested default. A subagent with blocking questions writes nothing and returns only the questions.
- Ownership: each artifact has exactly one owning agent (see `.github/copilot-instructions.md`). Others report problems; they do not edit it.
- Revision requests quote the finding ID or human instruction, and the owner records the change in its revision history.
- Loops are bounded (3 rounds for clarification and gate revisions, 2 for review/fix cycles). After the bound, escalate to the human.
- Gate format and approval semantics are defined in `sdlc-orchestrator.agent.md`. Silence is never approval.
- When editing an agent/prompt file, keep frontmatter valid (`name`, `description`, `tools`) and keep the agent's scope narrow.
