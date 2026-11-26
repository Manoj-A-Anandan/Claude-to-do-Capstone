'use strict';
/**
 * Validates a PR body file before it is used with `gh pr create --body-file`.
 * Run: node scripts/sdlc/check-pr-body.js docs/pr-description.md   (exit 0 = valid, 1 = invalid)
 *
 * Checks: (1) the AI-assistance disclosure is present word for word, directly after the title and
 * before "## Summary"; (2) the five required sections exist in order; (3) the reviewer checklist has items.
 */
const fs = require('node:fs');

const AI_DISCLOSURE_PARAGRAPHS = [
  'This pull request was created with the assistance of an AI-driven SDLC workflow.',
  'AI assistance was used for requirements analysis, planning, design, implementation and supporting documentation, as applicable to this PR.',
  'Human Review Required: All generated changes and supporting evidence must be reviewed and validated by a human before approval and merging.',
];
const DISCLOSURE_HEADING = 'AI-Assisted Pull Request';
const REQUIRED_SECTIONS = ['Summary', 'Changes Made', 'Test Evidence', 'Known Limitations', 'Reviewer Checklist'];

function normalise(text) {
  return text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function checkPrBody(body) {
  const errors = [];
  const headings = [...body.matchAll(/^##\s+(.*)$/gm)].map((m) => ({ text: m[1].trim(), index: m.index }));
  const disclosure = headings.find((h) => h.text.includes(DISCLOSURE_HEADING));
  const summary = headings.find((h) => h.text === 'Summary');

  if (!disclosure) {
    errors.push('missing heading "' + DISCLOSURE_HEADING + '" (expected as "## 🤖 ' + DISCLOSURE_HEADING + '")');
  } else {
    if (!disclosure.text.startsWith('🤖')) errors.push('disclosure heading must start with the robot emoji');
    const next = headings.find((h) => h.index > disclosure.index);
    const block = normalise(body.slice(disclosure.index, next ? next.index : body.length));
    AI_DISCLOSURE_PARAGRAPHS.forEach((p) => {
      if (!block.includes(p)) errors.push('disclosure text missing or altered: "' + p.slice(0, 50) + '..."');
    });
    if (summary && disclosure.index > summary.index) errors.push('disclosure must come before "## Summary"');
  }

  let last = -1;
  REQUIRED_SECTIONS.forEach((name) => {
    const h = headings.find((x) => x.text === name);
    if (!h) errors.push('missing section "## ' + name + '"');
    else if (h.index < last) errors.push('section "' + name + '" is out of order');
    else last = h.index;
  });

  const checklist = headings.find((h) => h.text === 'Reviewer Checklist');
  if (checklist) {
    const items = body.slice(checklist.index).match(/^- \[[ xX]\] /gm) || [];
    if (items.length === 0) errors.push('reviewer checklist has no "- [ ]" items');
  }
  return { ok: errors.length === 0, errors };
}

function main(argv) {
  const file = argv[0];
  if (!file) { process.stderr.write('usage: node scripts/sdlc/check-pr-body.js <pr-body.md>\n'); return 1; }
  if (!fs.existsSync(file)) { process.stderr.write('Not Found: ' + file + '\n'); return 1; }
  const result = checkPrBody(fs.readFileSync(file, 'utf8'));
  if (result.ok) { process.stdout.write('PR body OK: AI disclosure, five sections and reviewer checklist present\n'); return 0; }
  result.errors.forEach((e) => process.stderr.write('PR body invalid: ' + e + '\n'));
  return 1;
}

module.exports = { checkPrBody, AI_DISCLOSURE_PARAGRAPHS, REQUIRED_SECTIONS };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
