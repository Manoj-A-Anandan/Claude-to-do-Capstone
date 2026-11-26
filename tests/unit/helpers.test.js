'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { createFakeStorage } = require('../helpers/fake-storage');
const { loadModules } = require('../helpers/load-modules');

test('fake storage returns null for a missing key and the stored string otherwise', () => {
  const storage = createFakeStorage({ a: '1' });
  assert.equal(storage.getItem('a'), '1');
  assert.equal(storage.getItem('missing'), null);
  storage.setItem('b', 2);
  assert.equal(storage.getItem('b'), '2');
  assert.equal(storage.length, 2);
});

test('fake storage failure switches throw named errors', () => {
  const storage = createFakeStorage();

  storage.failures.get = true;
  assert.throws(() => storage.getItem('a'), { name: 'SecurityError' });
  storage.failures.get = false;

  storage.failures.set = true;
  assert.throws(() => storage.setItem('a', 'x'), { name: 'SecurityError' });
  storage.failures.set = false;

  storage.failures.quota = true;
  assert.throws(() => storage.setItem('a', 'x'), { name: 'QuotaExceededError' });
  storage.failures.quota = false;

  storage.failures.setKeys.add('only-this');
  assert.throws(() => storage.setItem('only-this', 'x'), { name: 'SecurityError' });
  storage.setItem('other', 'ok');
  assert.equal(storage.peek('other'), 'ok');
});

test('loadModules runs files in order, returns Todo, and leaves no global behind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-load-'));
  try {
    const wrapper = (name) =>
      `(function (global) { 'use strict'; global.Todo = global.Todo || {}; global.Todo.${name} = function () { return '${name}'; }; })(typeof globalThis !== 'undefined' ? globalThis : this);`;
    fs.writeFileSync(path.join(dir, 'one.js'), wrapper('one'));
    fs.writeFileSync(path.join(dir, 'two.js'), wrapper('two'));

    const first = loadModules({ dir, files: ['one.js', 'two.js'] });
    assert.deepStrictEqual(Object.keys(first), ['one', 'two']);
    assert.equal(first.two(), 'two');
    assert.equal(globalThis.Todo, undefined);

    const second = loadModules({ dir, files: ['one.js'] });
    assert.deepStrictEqual(Object.keys(second), ['one']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
