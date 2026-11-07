'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { createFakeStorage } = require('../helpers/fake-storage');
const { loadModules } = require('../helpers/load-modules');

const Todo = loadModules({ files: ['task-store.js'] });
const KEY = 'todo-app.tasks.v1';
const BACKUP_KEY = 'todo-app.tasks.v1.unreadable';

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8');
}

function storeWith(raw) {
  const storage = createFakeStorage(raw === undefined ? {} : { [KEY]: raw });
  return { storage, store: Todo.createTaskStore(() => storage) };
}

test('the storage keys are namespaced', () => {
  const { store } = storeWith();
  assert.equal(store.key, KEY);
  assert.equal(store.backupKey, BACKUP_KEY);
});

test('FR-9: reads a valid saved list in order', () => {
  const { store } = storeWith(fixture('valid.json'));
  const result = store.read();
  assert.equal(result.status, 'ok');
  assert.deepStrictEqual(result.tasks, [
    { id: 1, title: 'Complete Java revision', completed: false },
    { id: 2, title: 'Buy milk', completed: false },
  ]);
});

test('an empty saved array is ok with no tasks', () => {
  const { store } = storeWith('[]');
  assert.deepStrictEqual(store.read(), { status: 'ok', tasks: [], raw: '[]' });
});

test('a missing key is "missing" with no tasks and no warning status', () => {
  const { store } = storeWith();
  assert.deepStrictEqual(store.read(), { status: 'missing', tasks: [], raw: null });
});

for (const name of [
  'invalid-json.txt',
  'not-an-array.json',
  'missing-title.json',
  'missing-completed.json',
  'empty-title.json',
  'float-id.json',
  'negative-id.json',
  'zero-id.json',
  'duplicate-ids.json',
  'unsafe-id.json',
  'record-is-null.json',
  'record-is-array.json',
  'completed-is-string.json',
]) {
  test(`FR-15: ${name} is unreadable and the raw value is returned`, () => {
    const raw = fixture(name);
    const { store } = storeWith(raw);
    assert.deepStrictEqual(store.read(), { status: 'unreadable', tasks: [], raw });
  });
}

test('NFR-6: extra properties on stored records are dropped', () => {
  const { store } = storeWith('[{"id":1,"title":"a","completed":false,"html":"<b>x</b>"}]');
  assert.deepStrictEqual(store.read().tasks, [{ id: 1, title: 'a', completed: false }]);
});

test('FR-15: a storage getter that throws gives "unavailable"', () => {
  const store = Todo.createTaskStore(() => {
    throw new Error('SecurityError');
  });
  assert.deepStrictEqual(store.read(), { status: 'unavailable', tasks: [], raw: null });
});

test('FR-15: getItem that throws gives "unavailable"', () => {
  const { storage, store } = storeWith('[]');
  storage.failures.get = true;
  assert.equal(store.read().status, 'unavailable');
});

test('FR-15: a getter that returns nothing gives "unavailable"', () => {
  const store = Todo.createTaskStore(() => undefined);
  assert.equal(store.read().status, 'unavailable');
});

test('FR-8: write stores the JSON array under the key', () => {
  const { storage, store } = storeWith();
  const tasks = [{ id: 1, title: 'a', completed: false }];
  assert.deepStrictEqual(store.write(tasks), { ok: true });
  assert.deepStrictEqual(JSON.parse(storage.peek(KEY)), tasks);
});

test('FR-15: write reports failure for a quota error and for a blocked setItem, never throwing', () => {
  const { storage, store } = storeWith();
  storage.failures.quota = true;
  assert.deepStrictEqual(store.write([]), { ok: false });
  storage.failures.quota = false;
  storage.failures.set = true;
  assert.deepStrictEqual(store.write([]), { ok: false });
});

test('FR-15: write reports failure when the storage getter throws', () => {
  const store = Todo.createTaskStore(() => {
    throw new Error('SecurityError');
  });
  assert.deepStrictEqual(store.write([]), { ok: false });
});

test('FR-15: backup copies the raw string to the backup key', () => {
  const { storage, store } = storeWith('not json');
  assert.equal(store.backup('not json'), true);
  assert.equal(storage.peek(BACKUP_KEY), 'not json');
  assert.equal(storage.peek(KEY), 'not json');
});

test('FR-15: backup returns false when only the backup key cannot be written', () => {
  const { storage, store } = storeWith('not json');
  storage.failures.setKeys.add(BACKUP_KEY);
  assert.equal(store.backup('not json'), false);
  assert.deepStrictEqual(store.write([]), { ok: true });
});

test('NFR-4: the store never touches the network', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'task-store.js'), 'utf8');
  assert.doesNotMatch(source, /fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
});
