'use strict';
// Validates the PR-body checker and the AI disclosure. Run: npm run test:sdlc
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkPrBody, AI_DISCLOSURE_PARAGRAPHS } = require('./check-pr-body.js');

const root = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const squash = (t) => t.replace(/\*\*/g, '').replace(/\s+/g, ' ');

const DISCLOSURE = [
  '## 🤖 AI-Assisted Pull Request', '',
  'This pull request was created with the assistance of an AI-driven SDLC workflow.', '',
  'AI assistance was used for requirements analysis, planning, design, implementation and supporting documentation, as applicable to this PR.', '',
  '**Human Review Required:**',
  'All generated changes and supporting evidence must be reviewed and validated by a human before approval and merging.', '',
].join('\n');
const SECTIONS = '## Summary\nx\n\n## Changes Made\nx\n\n## Test Evidence\nx\n\n## Known Limitations\nx\n\n## Reviewer Checklist\n- [ ] item\n';
const valid = '# feat: demo\n\n' + DISCLOSURE + '\n' + SECTIONS;

test('valid body with disclosure and five sections passes', () => {
  assert.deepEqual(checkPrBody(valid), { ok: true, errors: [] });
});

test('body without the disclosure fails', () => {
  const r = checkPrBody('# feat: demo\n\n' + SECTIONS);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /missing heading/);
});

test('altered disclosure wording fails', () => {
  const r = checkPrBody(valid.replace('must be reviewed and validated', 'may be reviewed'));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /altered/.test(e)));
});

test('disclosure placed after Summary fails; missing or reordered sections fail', () => {
  assert.equal(checkPrBody('# t\n\n' + SECTIONS + '\n' + DISCLOSURE).ok, false);
  assert.ok(checkPrBody(valid.replace('## Known Limitations\nx\n\n', '')).errors.some((e) => /missing section "## Known Limitations"/.test(e)));
  assert.ok(checkPrBody(valid.replace('- [ ] item', 'plain text')).errors.some((e) => /no "- \[ \]" items/.test(e)));
});

test('the real docs/pr-description.md carries the disclosure and passes', () => {
  assert.equal(checkPrBody(read('docs/pr-description.md')).ok, true);
});

test('pr-authoring skill and pr-creator template contain the same disclosure text as the checker', () => {
  ['.claude/skills/pr-authoring/SKILL.md', '.claude/agents/pr-creator.agent.md'].forEach((file) => {
    const text = squash(read(file));
    AI_DISCLOSURE_PARAGRAPHS.forEach((p) => assert.ok(text.includes(p), file + ' is missing: ' + p.slice(0, 40)));
  });
});

test('pr-creator never merges and keeps the human release gate', () => {
  const text = read('.claude/agents/pr-creator.agent.md');
  assert.match(text, /never merge/i);
  assert.match(text, /only when the orchestrator says G8 is approved/);
  // A prohibition ("never --auto-merge") is fine; an instructed command is not.
  assert.doesNotMatch(text, /^\s*(\d+\.\s*)?`?gh pr merge/m, 'no merge command is instructed');
  text.split('\n').filter((l) => /gh pr create/.test(l) && /--(auto|admin)/.test(l))
    .forEach((l) => assert.match(l, /never/i, 'auto-merge flag may only appear in a prohibition'));
});
