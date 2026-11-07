---
description: Resume an interrupted Agentic SDLC run from .sdlc/state.md.
agent: sdlc-orchestrator
---

Read `.sdlc/state.md`, tell me which stage and gate we are at, what was last approved, and what is pending. Then continue from that stage using the normal gate protocol. If the state file is missing or inconsistent with the artifacts in `docs/`, say so and ask whether to restart.
