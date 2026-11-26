'use strict';

// Verifier-added tests: the app has no secrets, so these assert that nothing secret-like,
// no environment access, no external URL and no error internals can reach the source,
// the page, or the rendered output.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { createFakeStorage } = require('../helpers/fake-storage');
const { createPageHarness } = require('../helpers/page-harness');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');
const sourceFiles = fs.readdirSync(SRC_DIR).filter((name) => /\.(js|css)$/.test(name));
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { page, add, rows } = createPageHarness();

const TOKEN_LIKE = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /xox[abp]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
  /\b(password|passwd|secret|api[_-]?key|bearer)\b\s*[:=]/i,
];

for (const name of sourceFiles) {
  test(`secrets: ${name} has no token-like strings, env access, or external URLs`, () => {
    const source = fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
    for (const pattern of TOKEN_LIKE) assert.doesNotMatch(source, pattern, String(pattern));
    assert.doesNotMatch(source, /process\.env|import\.meta\.env|\.env\b|dotenv/);
    assert.doesNotMatch(source, /https?:\/\//i);
    assert.doesNotMatch(source, /[A-Za-z]:\\\\|\/Users\/|\/home\/|C:\/Users/);
  });
}

test('secrets: index.html has no token-like strings, external URLs, or absolute local paths', () => {
  for (const pattern of TOKEN_LIKE) assert.doesNotMatch(indexHtml, pattern, String(pattern));
  assert.doesNotMatch(indexHtml, /https?:\/\//i);
  assert.doesNotMatch(indexHtml, /<(img|iframe|link|script)\b[^>]*(src|href)\s*=\s*["'](?!src\/)[^"']*["']/i);
  assert.doesNotMatch(indexHtml, /[A-Za-z]:\\|file:\/\//);
});

test('secrets: the committed package.json holds no credentials or registry tokens', () => {
  const text = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  for (const pattern of TOKEN_LIKE) assert.doesNotMatch(text, pattern, String(pattern));
  assert.doesNotMatch(text, /_authToken|npm_[A-Za-z0-9]{20,}/);
});

test('secrets: a storage error message and stack never reach the rendered page', async () => {
  const storage = createFakeStorage();
  const leak = 'SECRET-LEAK-MARKER-12345';
  storage.setItem = () => {
    const error = new Error(leak);
    error.name = 'QuotaExceededError';
    throw error;
  };
  storage.getItem = () => {
    const error = new Error(leak);
    error.name = 'SecurityError';
    throw error;
  };
  const p = await page({ storage });
  add(p, 'A task');
  const text = p.document.body.textContent;
  assert.doesNotMatch(text, new RegExp(leak));
  assert.doesNotMatch(text, /\bat\s+\S+\s*\(|Error:|stack|TypeError|SecurityError|QuotaExceededError/);
  assert.deepStrictEqual(rows(p).map((row) => row.title), ['A task']);
});

test('output quality: a representative session renders no undefined/null/[object text and no empty titles', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  for (const title of ['Complete Java revision', '  Buy milk  ', '<b>bold</b>', 'A', 'A']) add(p, title);
  add(p, '   ');
  add(p, 'x'.repeat(101));
  const text = p.document.body.textContent;
  assert.doesNotMatch(text, /undefined|\bnull\b|\[object|NaN/);
  const items = rows(p);
  assert.equal(items.length, 5);
  assert.ok(items.every((row) => row.title.trim().length > 0 && row.status === 'incomplete'));
  assert.doesNotMatch(p.document.body.innerHTML, /[A-Za-z]:\\|file:\/\//);
  assert.ok(p.document.querySelector('main'));
  assert.ok(p.document.querySelector('h1'));
  assert.equal(p.document.querySelectorAll('[role="alert"]').length, 1);
  assert.equal(p.document.querySelectorAll('[role="status"]').length, 2);
});

test('secrets: the page makes no network requests while a session runs (NFR-4)', async () => {
  const p = await page({ storage: createFakeStorage() });
  const calls = [];
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
    if (p.window[name]) {
      p.window[name] = function (...args) {
        calls.push(name + ' ' + args[0]);
        throw new Error('network used');
      };
    }
  }
  p.window.navigator.sendBeacon = function (url) {
    calls.push('sendBeacon ' + url);
    return false;
  };
  add(p, 'one');
  add(p, 'two');
  add(p, '');
  assert.deepStrictEqual(calls, []);
  assert.equal(rows(p).length, 2);
});
