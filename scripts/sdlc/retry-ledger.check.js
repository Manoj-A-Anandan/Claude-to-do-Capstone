'use strict';
// Controlled validation of the SDLC retry policy. Run: npm run test:sdlc
// Uses a temporary ledger file and an in-memory fake "GitHub"; no network, no real git, no PRs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const L = require('./retry-ledger.js');

function approveThrough(ledger, ids) {
  ids.forEach((id) => {
    const def = L.STAGES[id.split(':')[0]];
    if (def.kind === 'gate') { L.awaitHuman(ledger, id); L.approve(ledger, id); return; }
    L.startAttempt(ledger, id); L.recordSuccess(ledger, id);
    if (def.gate) { L.awaitHuman(ledger, id); L.approve(ledger, id); }
  });
}

test('first attempt fails validation, second succeeds, failure context is handed to the retry', () => {
  const ledger = L.createLedger();
  approveThrough(ledger, ['W1']);

  const first = L.startAttempt(ledger, 'W2');
  assert.equal(first.attempt, 1);
  assert.equal(first.retry, false);
  const fail = L.recordFailure(ledger, 'W2', 'docs/requirements.md missing section "Acceptance criteria"', 'validator exit 1');
  assert.deepEqual([fail.willRetry, fail.final], [true, false]);

  const second = L.startAttempt(ledger, 'W2');
  assert.equal(second.attempt, 2);
  assert.equal(second.retry, true);
  assert.match(second.failureContext.reason, /missing section/);
  L.recordSuccess(ledger, 'W2');

  assert.equal(ledger.stages.W2.status, 'SUCCEEDED');
  assert.equal(ledger.stages.W2.attempts, 2);
  const outcomes = ledger.stages.W2.history.map((h) => h.outcome);
  assert.deepEqual(outcomes, ['STARTED', 'FAILED', 'STARTED', 'SUCCEEDED']);
});

test('second failure BLOCKS the stage with the exact reason and dependents cannot run', () => {
  const ledger = L.createLedger();
  approveThrough(ledger, ['W1']);
  L.startAttempt(ledger, 'W2');
  L.recordFailure(ledger, 'W2', 'reason one');
  L.startAttempt(ledger, 'W2');
  const end = L.recordFailure(ledger, 'W2', 'reason two: FR-3 has no Given/When/Then');
  assert.equal(end.final, true);
  assert.equal(ledger.stages.W2.status, 'BLOCKED');
  assert.match(ledger.stages.W2.history.at(-1).reason, /FR-3 has no Given/);

  assert.equal(L.startAttempt(ledger, 'W2').ok, false, 'no third attempt');
  const dependent = L.startAttempt(ledger, 'W4');
  assert.equal(dependent.ok, false);
  assert.match(dependent.reason, /prerequisites not satisfied/);
  assert.throws(() => L.awaitHuman(ledger, 'W3'), /prerequisites not satisfied/);
});

test('a successful stage is never re-executed', () => {
  const ledger = L.createLedger();
  approveThrough(ledger, ['W1', 'W2']);
  const again = L.startAttempt(ledger, 'W2');
  assert.equal(again.ok, false);
  assert.match(again.reason, /already SUCCEEDED/);
  assert.equal(ledger.stages.W2.attempts, 1);
});

test('retry does not duplicate external side effects (push, PR, PR comment)', () => {
  const ledger = L.createLedger();
  const fakeGitHub = { prs: [], comments: [], pushes: [] };
  const branch = 'feature/demo';
  const publish = () => {
    L.runOnce(ledger, 'push:' + branch, () => { fakeGitHub.pushes.push(branch); return 'pushed ' + branch; });
    L.runOnce(ledger, 'pr-create:' + branch, () => { fakeGitHub.prs.push({ branch }); return 'PR #1'; });
    // The comment step is the one that fails on attempt 1 (temporary injected failure).
    return L.runOnce(ledger, 'pr-comment:' + branch + ':ai-disclosure', () => {
      if (!publish.commentAllowed) throw new Error('simulated gh failure');
      fakeGitHub.comments.push('AI disclosure');
      return 'comment 1';
    });
  };

  const attempt = (id) => { L.startAttempt(ledger, id); };
  // Walk W1..W16 to reach W17.
  approveThrough(ledger, ['W1', 'W2', 'W3', 'W4', 'W5']);
  L.skip(ledger, 'W6', 'no blocker findings');
  approveThrough(ledger, ['W7', 'W8', 'W9', 'W10:P0', 'W11', 'W12', 'W13', 'W14', 'W15', 'W16']);

  attempt('W17');
  publish.commentAllowed = false;
  assert.throws(publish, /simulated gh failure/);
  L.recordFailure(ledger, 'W17', 'PR comment failed: simulated gh failure');

  attempt('W17');
  publish.commentAllowed = true;
  publish();
  L.recordSuccess(ledger, 'W17');
  publish(); // even a stray extra call changes nothing

  assert.equal(fakeGitHub.pushes.length, 1);
  assert.equal(fakeGitHub.prs.length, 1);
  assert.equal(fakeGitHub.comments.length, 1);
  assert.equal(ledger.stages.W17.attempts, 2);
});

test('human Request changes is a revision cycle: not a failure, attempts reset, gate cannot be bypassed', () => {
  const ledger = L.createLedger();
  approveThrough(ledger, ['W1']);
  L.startAttempt(ledger, 'W2');
  L.recordFailure(ledger, 'W2', 'transient');
  L.startAttempt(ledger, 'W2');
  L.recordSuccess(ledger, 'W2');
  L.awaitHuman(ledger, 'W3');

  const r = L.requestChanges(ledger, 'W3', 'Add an out-of-scope list');
  assert.deepEqual(r.reopened, ['W2']);
  assert.equal(ledger.stages.W2.attempts, 0, 'technical budget is fresh for the revision');
  assert.equal(ledger.stages.W2.status, 'PENDING');
  assert.throws(() => L.approve(ledger, 'W3'), /cannot be bypassed/);
  assert.equal(L.startAttempt(ledger, 'W4').ok, false, 'downstream blocked while gate is open');

  const rev = L.startAttempt(ledger, 'W2');
  assert.equal(rev.revisionFeedback, 'Add an out-of-scope list');
  assert.equal(rev.failureContext, null);
  L.recordSuccess(ledger, 'W2');
  L.awaitHuman(ledger, 'W3');
  L.approve(ledger, 'W3');
  assert.equal(L.startAttempt(ledger, 'W4').ok, true);
  assert.equal(ledger.stages.W3.revisions, 1);
  assert.ok(!ledger.stages.W2.history.some((h) => h.outcome === 'FAILED' && /out-of-scope/.test(h.reason)));
});

test('approval of an unpresented gate is refused; failures need a reason; secrets are scrubbed', () => {
  const ledger = L.createLedger();
  assert.throws(() => L.approve(ledger, 'W3'), /cannot be bypassed/);
  approveThrough(ledger, ['W1']);
  L.startAttempt(ledger, 'W2');
  assert.throws(() => L.recordFailure(ledger, 'W2', '  '), /reason is required/);
  L.recordFailure(ledger, 'W2', 'push failed with token=ghp_FAKE1234567890abcdef', 'Authorization: password=hunter2');
  const h = ledger.stages.W2.history.at(-1);
  assert.doesNotMatch(JSON.stringify(h), /ghp_FAKE|hunter2/);
  assert.match(h.reason, /\[REDACTED\]/);
});

test('CLI persists the ledger, exit codes distinguish blocked / already-done, and renders retry-log.md', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-ledger-'));
  const file = path.join(dir, 'retry-ledger.json');
  const run = (...args) => L.main(args, { SDLC_LEDGER: file });
  const quiet = (fn) => { const w = process.stdout.write; process.stdout.write = () => true; try { return fn(); } finally { process.stdout.write = w; } };
  try {
    assert.equal(quiet(() => run('start', 'W1')), 0);
    assert.equal(quiet(() => run('ok', 'W1')), 0);
    assert.equal(quiet(() => run('await', 'W1')), 0);
    assert.equal(quiet(() => run('approve', 'W1')), 0);
    assert.equal(quiet(() => run('start', 'W2')), 0);
    assert.equal(quiet(() => run('fail', 'W2', 'first')), 0);
    assert.equal(quiet(() => run('start', 'W2')), 0);
    assert.equal(quiet(() => run('fail', 'W2', 'second')), 3, 'exit 3 = BLOCKED');
    assert.equal(quiet(() => run('start', 'W2')), 2, 'exit 2 = not allowed');
    assert.equal(quiet(() => run('effect-check', 'push:x')), 0);
    assert.equal(quiet(() => run('effect-done', 'push:x', 'abc')), 0);
    assert.equal(quiet(() => run('effect-check', 'push:x')), 4, 'exit 4 = already done');
    const md = fs.readFileSync(path.join(dir, 'retry-log.md'), 'utf8');
    assert.match(md, /\| W2 \| Requirement analysis \| requirements-analyst \| 2 \| 0 \| BLOCKED \|/);
    assert.match(md, /push:x/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stage table defines W1..W18 with a responsible agent each', () => {
  const ids = Object.keys(L.STAGES);
  assert.equal(ids.length, 18);
  ids.forEach((id, i) => {
    assert.equal(id, 'W' + (i + 1));
    assert.ok(L.STAGES[id].agent && L.STAGES[id].name);
  });
});
