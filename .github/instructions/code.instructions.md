---
applyTo: "src/**,scripts/**"
---

# Code instructions

- Implement exactly what `docs/architecture.md` and the current task in `docs/impl-plan.md` specify. Component names in code match component names in the architecture.
- Small functions, one responsibility, self-explanatory names. Prefer clear code over comments; comment only the non-obvious *why*.
- No duplicated logic: if the same behaviour appears twice, extract a shared function.
- Missing or absent data is returned/rendered as the literal `Not Found`. Never raise on absent fields, never emit `None`/`null`/empty string into output documents.
- Handle explicitly: API errors/timeouts/rate limits (bounded retries with backoff), missing files, empty repositories/inputs, malformed data. Fail with a clear, secret-free message and a non-zero exit code for fatal errors.
- Configuration comes from environment variables or CLI args; no hard-coded paths, URLs with credentials, or tokens.
- Public functions have type hints/annotations (where the language supports them) and a one-line docstring.
- Log through a single logger; never log secrets or full request headers.
- Prefer the standard library; any new dependency must be pinned and justified.
- Keep each commit's worth of change tied to one task ID.
