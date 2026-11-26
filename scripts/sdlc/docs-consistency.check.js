'use strict';
// Validates workflow configuration and docs: frontmatter, references, stage coverage, retry policy,
// review checklist, mermaid fences, and absence of secrets. Run: npm run test:sdlc
// `.claude/` is git-ignored in this repo, so the checks that need it are skipped when it is absent.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { STAGES } = require('./retry-ledger.js');

const root = path.join(__dirname, '..', '..');
const abs = (rel) => path.join(root, rel);
const read = (rel) => fs.readFileSync(abs(rel), 'utf8');
const exists = (rel) => fs.existsSync(abs(rel));
const haveClaude = exists('.claude/agents');
const opts = { skip: haveClaude ? false : '.claude/ not present (git-ignored)' };

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const kv = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2];
  });
  return out;
}
const listDir = (rel) => fs.readdirSync(abs(rel));
const agentFiles = () => listDir('.claude/agents').filter((f) => f.endsWith('.agent.md'));
const skillDirs = () => listDir('.claude/skills').filter((d) => exists('.claude/skills/' + d + '/SKILL.md'));

test('every agent has valid frontmatter (name matches file, description, tools)', opts, () => {
  agentFiles().forEach((file) => {
    const fm = frontmatter(read('.claude/agents/' + file));
    assert.ok(fm, file + ': frontmatter missing');
    assert.equal(fm.name, file.replace('.agent.md', ''), file + ': name must match file name');
    assert.ok(fm.description && fm.description.length > 20, file + ': description');
    assert.match(fm.tools || '', /^(\[.*\]|[A-Za-z]+(, [A-Za-z]+)*)$/, file + ': tools list');
  });
});

test('orchestrator lists only existing agents; every stage agent is present', opts, () => {
  const text = read('.claude/agents/sdlc-orchestrator.agent.md');
  const block = text.match(/^agents:\r?\n((?:  - .*\r?\n)+)/m)[1];
  const listed = [...block.matchAll(/- (\S+)/g)].map((m) => m[1]);
  listed.forEach((a) => assert.ok(exists('.claude/agents/' + a + '.agent.md'), 'agent file missing: ' + a));
  ['requirements-analyst', 'architect', 'design-reviewer', 'implementation-planner', 'implementer', 'code-reviewer', 'verifier', 'docs-sync', 'pr-creator']
    .forEach((a) => assert.ok(listed.includes(a), a + ' not listed'));
});

test('every skill has frontmatter whose name matches its folder', opts, () => {
  skillDirs().forEach((d) => {
    const fm = frontmatter(read('.claude/skills/' + d + '/SKILL.md'));
    assert.ok(fm && fm.name === d && fm.description, d + ': invalid skill frontmatter');
  });
});

test('no broken references to skills, instructions, agents, prompts or scripts', opts, () => {
  const files = [
    ...agentFiles().map((f) => '.claude/agents/' + f),
    ...listDir('.claude/instructions').map((f) => '.claude/instructions/' + f),
    ...listDir('.claude/prompts').map((f) => '.claude/prompts/' + f),
    ...skillDirs().map((d) => '.claude/skills/' + d + '/SKILL.md'),
    'docs/sdlc/orchestrator.md', 'docs/sdlc/README.md', 'docs/sdlc/implementation-report.md',
  ].filter(exists);
  const refs = /(?:\.claude\/(?:skills|agents|instructions|prompts)\/[A-Za-z0-9._/-]*[A-Za-z0-9]\.md|scripts\/sdlc\/[A-Za-z0-9.-]+\.js)/g;
  files.forEach((f) => {
    (read(f).match(refs) || []).forEach((r) => assert.ok(exists(r), f + ' references missing file ' + r));
  });
  const names = skillDirs();
  const text = agentFiles().map((f) => read('.claude/agents/' + f)).join('\n');
  [...text.matchAll(/`([a-z-]+)` skill/g)].forEach((m) => assert.ok(names.includes(m[1]), 'unknown skill ' + m[1]));
});

test('agents reference the improved skills they must follow', opts, () => {
  const need = {
    'requirements-analyst': 'requirements-engineering', architect: 'architecture-design', 'design-reviewer': 'architecture-design',
    implementer: 'js-implementation', 'code-reviewer': 'code-review-checklist', verifier: 'verification-practices', 'pr-creator': 'pr-authoring',
  };
  Object.keys(need).forEach((a) => assert.ok(read('.claude/agents/' + a + '.agent.md').includes(need[a]), a + ' must reference ' + need[a]));
  assert.ok(read('.claude/agents/implementer.agent.md').includes('testing-practices'));
  assert.ok(read('.claude/agents/verifier.agent.md').includes('testing-practices'));
});

test('orchestrator agent file and docs/sdlc/orchestrator.md document every stage W1-W18', opts, () => {
  const agent = read('.claude/agents/sdlc-orchestrator.agent.md');
  const doc = read('docs/sdlc/orchestrator.md');
  Object.keys(STAGES).forEach((id) => {
    assert.ok(new RegExp('^\\| ' + id + ' \\|', 'm').test(agent), id + ' missing from stage table in agent file');
    const section = doc.match(new RegExp('### ' + id + ' — [\\s\\S]*?(?=\\n### W|\\n## )'));
    assert.ok(section, id + ' missing section in docs');
    const body = section[0];
    assert.match(body, /Next/, id + ' needs a Next');
    assert.match(body, /Failure handling|revision|Request changes/i, id + ' needs failure/revision handling');
    if (STAGES[id].kind === 'work') {
      ['Inputs', 'Outputs', 'Preconditions', 'Validation', 'Failure handling'].forEach((k) => {
        assert.ok(body.includes(k) || id === 'W18' || id === 'W16', id + ' needs ' + k);
      });
    }
  });
  [/max 2 attempts/, /FAILURE CONTEXT/, /BLOCKED/, /REVISION FEEDBACK/, /never merge/i].forEach((re) => assert.match(agent, re, String(re)));
});

test('code-review skill carries the 15-point checklist, 4 severities and path:line evidence rule', opts, () => {
  const s = read('.claude/skills/code-review-checklist/SKILL.md');
  for (let i = 1; i <= 15; i += 1) assert.match(s, new RegExp('^' + i + '\\. \\*\\*', 'm'), 'check ' + i);
  ['Blocker', 'Major', 'Minor', 'Suggestion', 'path:line', 'never modifies production code'].forEach((k) => assert.ok(s.includes(k), k));
  const reviewer = read('.claude/agents/code-reviewer.agent.md');
  assert.match(reviewer, /Never edit source files or tests/);
  assert.match(reviewer, /Dependency and configuration safety/);
});

test('code fences are balanced in workflow docs and agent files', opts, () => {
  ['docs/sdlc/orchestrator.md', '.claude/agents/sdlc-orchestrator.agent.md', 'docs/sdlc/README.md', 'docs/sdlc/implementation-report.md']
    .filter(exists).forEach((f) => {
      const fences = (read(f).match(/^```/gm) || []).length;
      assert.equal(fences % 2, 0, f + ' has unbalanced code fences');
    });
});

test('no secrets in new or changed workflow files', () => {
  const patterns = [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /AKIA[0-9A-Z]{16}/, /xox[abprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
  const claudeFiles = haveClaude
    ? agentFiles().map((f) => '.claude/agents/' + f).concat(skillDirs().map((d) => '.claude/skills/' + d + '/SKILL.md'))
    : [];
  const files = ['scripts/sdlc/retry-ledger.js', 'scripts/sdlc/check-pr-body.js', 'docs/sdlc/orchestrator.md', 'docs/pr-description.md', 'package.json']
    .concat(claudeFiles).filter(exists);
  files.forEach((f) => patterns.forEach((p) => assert.doesNotMatch(read(f), p, f + ' looks like it contains a secret')));
});

test('package.json gained no dependencies (no Selenium / REST Assured added)', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(Object.keys(pkg.devDependencies), ['jsdom']);
  assert.equal(pkg.dependencies, undefined);
});
