---
applyTo: "**"
---

# Security instructions (all files, all agents)

- Never write, print, log, or commit secrets: API tokens, passwords, private keys, connection strings, PATs. Read them from environment variables; document only the variable name.
- Provide `.env.example` with placeholders; keep `.env` and credentials files in `.gitignore`.
- Validate and normalise all external input (CLI args, file paths, API responses, user story text). Reject path traversal (`..`), restrict file operations to the workspace.
- Never build shell commands or queries by string-concatenating untrusted input; use parameterised APIs and argument arrays.
- Error messages and logs must not include secrets, full tokens, or stack traces in user-facing output.
- Output documents must be scrubbed: no tokens, credentials, or absolute local paths.
- Pin dependency versions; prefer the standard library; record every added dependency and its reason. Run the ecosystem's vulnerability audit during review and verification.
- Do not run destructive or irreversible commands (`rm -rf`, `git push --force`, `git reset --hard`, dropping data) without explicit human approval.
- Do not push to `main`/`master`; do not publish, merge, or deploy without a human gate.
- If you detect a secret in the workspace, stop, report the file and line (not the value), and ask the human to rotate it.
