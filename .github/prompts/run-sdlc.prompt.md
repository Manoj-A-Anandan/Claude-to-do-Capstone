---
description: Start the full Agentic SDLC for the user story in user-story/ — requirements to Pull Request, with human approval at every gate.
agent: sdlc-orchestrator
---

Run the full Agentic SDLC pipeline now.

1. Find the user story (check `user-story/`, or use the JIRA/Confluence key or pasted text I provide: ${input:storySource:Leave blank to auto-detect in user-story/}).
2. Execute stages 0-8 in order via the specialist subagents, running `docs-sync` after every stage.
3. Stop and ask me at every gate (G0-G8). Do not proceed without my explicit approval.
4. Relay any clarifying questions from the subagents to me and pass my answers back.
5. Keep `.sdlc/state.md` current so I can resume later.
