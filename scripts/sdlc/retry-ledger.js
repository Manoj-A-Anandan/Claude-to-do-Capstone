'use strict';
/**
 * SDLC retry ledger.
 *
 * Claude/Copilot custom agents have no native retry property, so the orchestrator enforces the
 * retry policy through this ledger (invoked with its `execute` tool). The ledger is the single
 * place that decides whether a stage may run, how many attempts it has used, and whether an
 * external side effect (commit, push, PR, PR comment) has already happened.
 *
 * Policy: max 2 attempts per stage (1 initial + 1 retry). A human "Request changes" is a
 * controlled revision, never a failure, and never consumes an attempt.
 *
 * CLI:  node scripts/sdlc/retry-ledger.js <command> [args]   (see usage() below)
 * Env:  SDLC_LEDGER = path to ledger JSON (default .sdlc/retry-ledger.json)
 */
const fs = require('node:fs');
const path = require('node:path');

const MAX_ATTEMPTS = 2;

// kind 'gate' = pure human approval stage. `gate` on a work stage = inline human gate after it.
// `optional` stages may be SKIPPED. Stage W10 runs once per priority group: id `W10:P0`, `W10:P1`...
const STAGES = {
  W1: { name: 'Workflow initiation and user input', kind: 'work', agent: 'sdlc-orchestrator', requires: [], gate: 'G0' },
  W2: { name: 'Requirement analysis', kind: 'work', agent: 'requirements-analyst', requires: ['W1'] },
  W3: { name: 'Requirements approval', kind: 'gate', agent: 'human', requires: ['W2'], gate: 'G1', reviews: ['W2'] },
  W4: { name: 'Architecture design', kind: 'work', agent: 'architect', requires: ['W3'], gate: 'G2' },
  W5: { name: 'Design review', kind: 'work', agent: 'design-reviewer', requires: ['W4'] },
  W6: { name: 'Architecture revision', kind: 'work', agent: 'architect', requires: ['W5'], optional: true },
  W7: { name: 'Architecture approval', kind: 'gate', agent: 'human', requires: ['W5', 'W6'], gate: 'G3', reviews: ['W6'] },
  W8: { name: 'Implementation planning', kind: 'work', agent: 'implementation-planner', requires: ['W7'] },
  W9: { name: 'Plan approval', kind: 'gate', agent: 'human', requires: ['W8'], gate: 'G4', reviews: ['W8'] },
  W10: { name: 'Task-wise implementation', kind: 'work', agent: 'implementer', requires: ['W9'], gate: 'G5' },
  W11: { name: 'Code review', kind: 'work', agent: 'code-reviewer', requires: ['W10'] },
  W12: { name: 'Code remediation and re-review', kind: 'work', agent: 'implementer + code-reviewer', requires: ['W11'], gate: 'G6' },
  W13: { name: 'Independent verification and testing', kind: 'work', agent: 'verifier', requires: ['W12'] },
  W14: { name: 'Verification approval', kind: 'gate', agent: 'human', requires: ['W13'], gate: 'G7', reviews: ['W13'] },
  W15: { name: 'PR preparation', kind: 'work', agent: 'pr-creator', requires: ['W14'] },
  W16: { name: 'Release authorization', kind: 'gate', agent: 'human', requires: ['W15'], gate: 'G8', reviews: ['W15'] },
  W17: { name: 'Git commit, push and PR creation', kind: 'work', agent: 'pr-creator', requires: ['W16'] },
  W18: { name: 'Final workflow completion and reporting', kind: 'work', agent: 'sdlc-orchestrator', requires: ['W17'] },
};

const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{8,}/g,
  /github_pat_[A-Za-z0-9_]{8,}/g,
  /AKIA[0-9A-Z]{12,}/g,
  /xox[abprs]-[A-Za-z0-9-]{8,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /(token|password|secret|apikey)\s*[=:]\s*\S+/gi,
];

function scrub(text) {
  let out = String(text == null ? '' : text);
  SECRET_PATTERNS.forEach((p) => { out = out.replace(p, '[REDACTED]'); });
  return out;
}

function definitionOf(id) {
  const def = STAGES[String(id).split(':')[0]];
  if (!def) throw new Error('Unknown stage: ' + id);
  return def;
}

function createLedger() {
  return { version: 1, maxAttempts: MAX_ATTEMPTS, stages: {}, sideEffects: {} };
}

function entry(ledger, id) {
  definitionOf(id);
  if (!ledger.stages[id]) {
    ledger.stages[id] = { status: 'PENDING', attempts: 0, revisions: 0, history: [] };
  }
  return ledger.stages[id];
}

function log(ledger, id, outcome, reason, details) {
  const e = entry(ledger, id);
  e.history.push({
    attempt: e.attempts, outcome, reason: scrub(reason), details: scrub(details),
    at: new Date().toISOString(),
  });
}

function isSatisfied(ledger, baseId) {
  const def = STAGES[baseId];
  const instances = Object.keys(ledger.stages).filter((k) => k === baseId || k.startsWith(baseId + ':'));
  if (instances.length === 0) return false;
  return instances.every((k) => {
    const s = ledger.stages[k].status;
    if (s === 'SKIPPED') return true;
    return def.gate ? s === 'APPROVED' : s === 'SUCCEEDED';
  });
}

function unmetPrerequisites(ledger, id) {
  return definitionOf(id).requires.filter((r) => !isSatisfied(ledger, r));
}

/** Begins an attempt. Refuses when prerequisites are unmet, the stage already succeeded, or attempts are exhausted. */
function startAttempt(ledger, id) {
  const def = definitionOf(id);
  const e = entry(ledger, id);
  if (def.kind === 'gate') return { ok: false, reason: id + ' is a human gate; use await/approve/changes' };
  const unmet = unmetPrerequisites(ledger, id);
  if (unmet.length) return { ok: false, reason: 'prerequisites not satisfied: ' + unmet.join(', ') };
  if (e.status === 'BLOCKED') return { ok: false, reason: id + ' is BLOCKED after ' + e.attempts + ' failed attempts' };
  if (['SUCCEEDED', 'WAITING_FOR_HUMAN', 'APPROVED', 'SKIPPED'].includes(e.status)) {
    return { ok: false, reason: id + ' already ' + e.status + '; not re-executed' };
  }
  if (e.attempts >= MAX_ATTEMPTS) return { ok: false, reason: id + ' has no attempts left' };
  e.attempts += 1;
  e.status = e.attempts > 1 ? 'RETRYING' : 'IN_PROGRESS';
  const lastFailure = [...e.history].reverse().find((h) => h.outcome === 'FAILED');
  const lastRevision = [...e.history].reverse().find((h) => h.outcome === 'REVISION_REQUESTED');
  log(ledger, id, 'STARTED', e.attempts > 1 ? 'retry' : 'initial attempt', '');
  return {
    ok: true, attempt: e.attempts, retry: e.attempts > 1,
    failureContext: e.attempts > 1 && lastFailure ? { reason: lastFailure.reason, details: lastFailure.details } : null,
    revisionFeedback: e.attempts === 1 && lastRevision ? lastRevision.reason : null,
  };
}

function recordSuccess(ledger, id, note) {
  const e = entry(ledger, id);
  if (!['IN_PROGRESS', 'RETRYING'].includes(e.status)) throw new Error(id + ' has no attempt in progress');
  e.status = 'SUCCEEDED';
  log(ledger, id, 'SUCCEEDED', note || 'validation passed', '');
  return { ok: true, status: e.status };
}

/** Records a technical failure (agent error, invalid output, failed validation). A reason is mandatory. */
function recordFailure(ledger, id, reason, details) {
  const e = entry(ledger, id);
  if (!['IN_PROGRESS', 'RETRYING'].includes(e.status)) throw new Error(id + ' has no attempt in progress');
  if (!reason || !String(reason).trim()) throw new Error('A failure reason is required');
  log(ledger, id, 'FAILED', reason, details);
  const exhausted = e.attempts >= MAX_ATTEMPTS;
  e.status = exhausted ? 'BLOCKED' : 'RETRY_PENDING';
  return { ok: true, status: e.status, final: exhausted, willRetry: !exhausted };
}

function skip(ledger, id, reason) {
  const def = definitionOf(id);
  const e = entry(ledger, id);
  if (!def.optional) throw new Error(id + ' is not optional and cannot be skipped');
  if (unmetPrerequisites(ledger, id).length) throw new Error('prerequisites not satisfied for ' + id);
  e.status = 'SKIPPED';
  log(ledger, id, 'SKIPPED', reason || 'not required', '');
  return { ok: true, status: e.status };
}

/** Presents an artifact to the human. Only legal when the producing stage succeeded. */
function awaitHuman(ledger, id) {
  const def = definitionOf(id);
  const e = entry(ledger, id);
  if (!def.gate) throw new Error(id + ' has no human gate');
  if (def.kind === 'gate') {
    const unmet = unmetPrerequisites(ledger, id);
    if (unmet.length) throw new Error('prerequisites not satisfied: ' + unmet.join(', '));
    const reviewed = def.reviews.filter((r) => ledger.stages[r] && ledger.stages[r].status === 'RETRY_PENDING');
    if (reviewed.length) throw new Error('reviewed stage still failing: ' + reviewed.join(', '));
  } else if (e.status !== 'SUCCEEDED') {
    throw new Error(id + ' must be SUCCEEDED before its gate ' + def.gate + ' is presented (is ' + e.status + ')');
  }
  e.status = 'WAITING_FOR_HUMAN';
  log(ledger, id, 'GATE_PRESENTED', def.gate, '');
  return { ok: true, gate: def.gate };
}

function approve(ledger, id) {
  const def = definitionOf(id);
  const e = entry(ledger, id);
  if (e.status !== 'WAITING_FOR_HUMAN') throw new Error('Gate ' + def.gate + ' was not presented; approval cannot be bypassed');
  e.status = 'APPROVED';
  log(ledger, id, 'APPROVED', def.gate, '');
  return { ok: true, status: e.status };
}

/**
 * Human "Request changes" or a finding-driven loop-back. A controlled revision: it records the
 * feedback, reopens the owning stage(s) with a fresh attempt budget, and sends the gate back to
 * PENDING so it must be presented again. It is never counted as a failure.
 */
function requestChanges(ledger, id, feedback) {
  const def = definitionOf(id);
  const e = entry(ledger, id);
  if (!feedback || !String(feedback).trim()) throw new Error('Feedback text is required');
  if (e.status !== 'WAITING_FOR_HUMAN') throw new Error('Gate ' + def.gate + ' is not waiting for the human');
  const owners = def.kind === 'gate' ? def.reviews : [id];
  if (def.kind === 'gate') {
    e.revisions += 1;
    log(ledger, id, 'REVISION_REQUESTED', feedback, '');
    e.status = 'PENDING';
  }
  owners.forEach((ownerId) => reopen(ledger, ownerId, feedback));
  return { ok: true, reopened: owners };
}

function reopen(ledger, id, feedback) {
  const e = entry(ledger, id);
  e.revisions += 1;
  e.attempts = 0;
  e.status = 'PENDING';
  log(ledger, id, 'REVISION_REQUESTED', feedback, '');
  return { ok: true };
}

/** Idempotency for external side effects (commit, push, PR create, PR comment). */
function effectCheck(ledger, key) {
  const done = ledger.sideEffects[key];
  return done ? { done: true, ref: done.ref } : { done: false };
}

function effectDone(ledger, key, ref) {
  if (ledger.sideEffects[key]) return { ok: true, already: true, ref: ledger.sideEffects[key].ref };
  ledger.sideEffects[key] = { ref: scrub(ref), at: new Date().toISOString() };
  return { ok: true, already: false };
}

/** Runs `action` at most once per key, even across retries. Returns { executed, ref }. */
function runOnce(ledger, key, action) {
  const existing = effectCheck(ledger, key);
  if (existing.done) return { executed: false, ref: existing.ref };
  const ref = action();
  effectDone(ledger, key, ref);
  return { executed: true, ref: scrub(ref) };
}

function render(ledger) {
  const rows = [];
  const lines = ['# SDLC Retry Log', '', 'Policy: max ' + MAX_ATTEMPTS + ' attempts per stage (1 initial + 1 retry). Human revisions are not failures.', '',
    '## Stage summary', '', '| Stage | Name | Agent | Attempts | Revisions | Status |', '|-------|------|-------|----------|-----------|--------|'];
  Object.keys(ledger.stages).sort(byStageOrder).forEach((id) => {
    const e = ledger.stages[id];
    const def = definitionOf(id);
    lines.push('| ' + id + ' | ' + def.name + ' | ' + def.agent + ' | ' + e.attempts + ' | ' + e.revisions + ' | ' + e.status + ' |');
    e.history.filter((h) => h.outcome !== 'STARTED').forEach((h) => {
      rows.push('| ' + id + ' | ' + h.attempt + ' | ' + h.outcome + ' | ' + (h.reason || '-').replace(/\|/g, '/').replace(/\s+/g, ' ') + ' | ' + h.at + ' |');
    });
  });
  lines.push('', '## Attempt and revision events', '', '| Stage | Attempt | Outcome | Reason | Time (UTC) |', '|-------|---------|---------|--------|------------|', ...rows);
  lines.push('', '## External side effects (each executed once)', '', '| Key | Reference | Time (UTC) |', '|-----|-----------|------------|');
  Object.keys(ledger.sideEffects).forEach((k) => {
    lines.push('| ' + k + ' | ' + ledger.sideEffects[k].ref + ' | ' + ledger.sideEffects[k].at + ' |');
  });
  return lines.join('\n') + '\n';
}

function byStageOrder(a, b) {
  const num = (s) => parseInt(String(s).slice(1), 10);
  return num(a) - num(b) || a.localeCompare(b);
}

function load(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : createLedger();
}

function save(ledger, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
  fs.writeFileSync(path.join(path.dirname(file), 'retry-log.md'), render(ledger));
}

function usage() {
  return [
    'usage: node scripts/sdlc/retry-ledger.js <command> [args]',
    '  start <stage>              begin an attempt (exit 2 if not allowed)',
    '  ok <stage> [note]          record validated success',
    '  fail <stage> <reason> [details]   record failure (exit 3 when BLOCKED)',
    '  skip <stage> [reason]      skip an optional stage',
    '  await <stage>              present the stage gate to the human',
    '  approve <stage>            record human approval (only after await)',
    '  changes <stage> <feedback> record human Request changes (controlled revision)',
    '  reopen <stage> <feedback>  finding-driven loop-back (not a failure)',
    '  effect-check <key>         exit 0 = not done yet, exit 4 = already done',
    '  effect-done <key> <ref>    record that the side effect happened',
    '  status                     print the markdown retry log',
  ].join('\n');
}

function main(argv, env) {
  const file = (env && env.SDLC_LEDGER) || path.join('.sdlc', 'retry-ledger.json');
  const [cmd, a, b, c] = argv;
  const ledger = load(file);
  let result;
  let code = 0;
  try {
    if (cmd === 'start') { result = startAttempt(ledger, a); if (!result.ok) code = 2; }
    else if (cmd === 'ok') result = recordSuccess(ledger, a, b);
    else if (cmd === 'fail') { result = recordFailure(ledger, a, b, c); if (result.final) code = 3; }
    else if (cmd === 'skip') result = skip(ledger, a, b);
    else if (cmd === 'await') result = awaitHuman(ledger, a);
    else if (cmd === 'approve') result = approve(ledger, a);
    else if (cmd === 'changes') result = requestChanges(ledger, a, b);
    else if (cmd === 'reopen') result = reopen(ledger, a, b);
    else if (cmd === 'effect-check') { result = effectCheck(ledger, a); if (result.done) code = 4; }
    else if (cmd === 'effect-done') result = effectDone(ledger, a, b);
    else if (cmd === 'status') { process.stdout.write(render(ledger)); return 0; }
    else { process.stderr.write(usage() + '\n'); return 1; }
  } catch (err) {
    process.stderr.write('ERROR: ' + scrub(err.message) + '\n');
    return 1;
  }
  save(ledger, file);
  process.stdout.write(JSON.stringify(result) + '\n');
  return code;
}

module.exports = {
  MAX_ATTEMPTS, STAGES, createLedger, startAttempt, recordSuccess, recordFailure, skip,
  awaitHuman, approve, requestChanges, reopen, effectCheck, effectDone, runOnce, isSatisfied,
  render, scrub, main,
};

if (require.main === module) process.exitCode = main(process.argv.slice(2), process.env);
