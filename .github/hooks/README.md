# Hooks

Configured in `sdlc-hooks.json` (Copilot hooks format, `version: 1`). Each hook has a PowerShell and a bash script under `scripts/`, so it runs on Windows and Linux/macOS.

| Event | Script | Purpose |
|-------|--------|---------|
| `sessionStart` | `session-start` | Creates `.sdlc/logs`, `docs/`, `user-story/`; reports whether a pipeline run can be resumed. |
| `preToolUse` | `pre-tool-guard` | **Denies** force-push, push to main/master, `git reset --hard`, `git clean -f`, broad recursive deletes, `gh pr merge`, writes to `.env` files, and edits containing real-looking secrets (GitHub/AWS/Slack tokens, private keys). Fake tokens containing `FAKE` are allowed for tests. |
| `postToolUse` | `post-tool-docsync` | When a file under `src/` or `scripts/` is edited, records it in `.sdlc/pending-doc-sync.txt` so docs can be synced. |
| `sessionEnd` | `session-end` | Warns if source changed since the last docs-sync. |

`docs-sync` clears `.sdlc/pending-doc-sync.txt` after a clean run.

Deny output format: `{"permissionDecision":"deny","permissionDecisionReason":"..."}`.

On Linux/macOS make the `.sh` files executable: `chmod +x .github/hooks/scripts/*.sh`.
