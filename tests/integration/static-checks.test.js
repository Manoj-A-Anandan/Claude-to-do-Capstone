'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'src');
const sourceFiles = fs.readdirSync(SRC_DIR).filter((name) => name.endsWith('.js'));
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function read(name) {
  return fs.readFileSync(path.join(SRC_DIR, name), 'utf8');
}

test('there are source files to check', () => {
  assert.deepStrictEqual(sourceFiles.sort(), [
    'app.js',
    'task-service.js',
    'task-store.js',
    'task-validator.js',
    'task-view.js',
  ]);
});

for (const name of sourceFiles) {
  test(`NFR-6: ${name} has no HTML-writing sinks`, () => {
    assert.doesNotMatch(read(name), /innerHTML|outerHTML|insertAdjacentHTML|document\.write|createContextualFragment/);
  });

  test(`NFR-4: ${name} uses no network API`, () => {
    assert.doesNotMatch(read(name), /\bfetch\b|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts/);
  });

  test(`NFR-10: ${name} has no module system or eval`, () => {
    assert.doesNotMatch(read(name), /\bmodule\b|\brequire\s*\(|\bimport\s|\bexport\s|\beval\s*\(|new Function/);
  });

  test(`${name} is ASCII-only, so invisible characters cannot hide in the source`, () => {
    assert.doesNotMatch(read(name), /[^\x00-\x7F]/);
  });
}

test('NFR-10: package.json lists no runtime dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.type, 'commonjs');
});

test('NFR-10: the page has no build step: every script is a plain classic script from src/', () => {
  const scripts = Array.from(indexHtml.matchAll(/<script\b([^>]*)>/g)).map((match) => match[1]);
  const external = scripts.filter((attributes) => /\ssrc=/.test(' ' + attributes));
  assert.equal(external.length, 5);
  for (const attributes of scripts) {
    assert.doesNotMatch(attributes, /type\s*=\s*["']module["']/);
  }
});

test('DR-6: scripts load in dependency order, app last, then the bootstrap', () => {
  const order = Array.from(indexHtml.matchAll(/<script src="src\/([^"]+)"/g)).map((match) => match[1]);
  assert.deepStrictEqual(order, [
    'task-validator.js',
    'task-store.js',
    'task-service.js',
    'task-view.js',
    'app.js',
  ]);
  assert.ok(indexHtml.indexOf('Todo.startApp') > indexHtml.lastIndexOf('src/app.js'));
});

test('DD-2: the page has no Content-Security-Policy, inline handlers, or inline styles', () => {
  assert.doesNotMatch(indexHtml, /http-equiv/i);
  assert.doesNotMatch(indexHtml, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(indexHtml, /\sstyle\s*=/i);
});

test('DR-23: every source file uses the same opening line and attaches to Todo', () => {
  for (const name of sourceFiles) {
    const source = read(name);
    assert.ok(source.startsWith("(function (global) {\n  'use strict';"), `${name} opening`);
    assert.ok(
      source.trimEnd().endsWith("})(typeof globalThis !== 'undefined' ? globalThis : this);"),
      `${name} closing`,
    );
    assert.match(source, /global\.Todo = global\.Todo \|\| \{\};/);
  }
});
