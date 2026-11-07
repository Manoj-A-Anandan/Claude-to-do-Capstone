---
applyTo: "tests/**,**/*test*.*,**/*spec*.*"
---

# Testing instructions

- Every functional requirement has at least one test; name tests so the requirement is obvious (e.g. `test_fr3_missing_readme_renders_not_found`).
- Required cases for every component that reads external data: happy path, `Not Found`/missing field, empty input/repo, malformed input, external API failure/timeout, missing file.
- Include a secret-leak test: seed a fake token in the environment/fixtures and assert it never appears in output, logs, or generated documents.
- Unit tests are hermetic: no network, no real credentials, no dependence on wall-clock or machine paths. Fake external services at the boundary.
- Integration tests run the real pipeline end-to-end on fixtures under `tests/fixtures/` and assert on the generated output document (structure, required sections, `Not Found` rendering).
- Assertions must be specific; do not assert only "no exception".
- Tests are deterministic and independent; no ordering assumptions.
- Never delete or weaken a failing test to get green. Fix the code or report a defect.
- Use fake values only (`ghp_FAKE...`, `example.com`); never real data.
