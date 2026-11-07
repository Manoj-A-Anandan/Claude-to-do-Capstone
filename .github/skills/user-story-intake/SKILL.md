---
name: user-story-intake
description: Extract plain text from an uploaded user story (.md, .txt, .docx, .pdf) or fetch it from JIRA/Confluence, normalise it, and save it as user-story/_extracted.md for the requirements analyst. Use at pipeline start.
---

# User story intake

## Steps
1. List `user-story/`. Ignore `_extracted.md` and hidden files.
2. Extract by type:
   - `.md` / `.txt`: read directly.
   - `.docx`: try, in order, `pandoc "<file>" -t markdown`; else Python `python -c "import docx"` (python-docx) reading paragraphs and tables; else unzip and strip tags from `word/document.xml` (`unzip -p file.docx word/document.xml`). Tell the human which method was used.
   - `.pdf`: try `pdftotext -layout "<file>" -`; else Python `pypdf`. If none available, ask the human to paste the text.
   - JIRA / Confluence key or URL: use an available MCP tool (Atlassian). If none is configured, ask the human to paste the content. Never ask for or store credentials.
3. Normalise: keep title, description, acceptance criteria, comments that add constraints, linked-issue keys. Drop signatures and boilerplate.
4. Save to `user-story/_extracted.md` with a header:
   `Source: <file or key>   Extracted: <yyyy-mm-dd>   Method: <method>`
5. Report what was extracted and anything that looked lost (images, embedded tables). Mark lost content as `Not Found`.

## Rules
- Do not modify the original upload.
- Do not summarise or reinterpret; preserve wording. Interpretation is the requirements analyst's job.
- Strip any credentials or tokens that appear in the text and tell the human.
