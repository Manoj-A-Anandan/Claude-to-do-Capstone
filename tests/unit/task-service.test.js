'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createFakeStorage } = require('../helpers/fake-storage');
const { loadModules } = require('../helpers/load-modules');

const Todo = loadModules({ files: ['task-validator.js', 'task-store.js', 'task-service.js'] });
const KEY = 'todo-app.tasks.v1';
const BACKUP_KEY = 'todo-app.tasks.v1.unreadable';

function makeService(storage) {
  return Todo.createTaskService({
    validator: Todo.createTaskValidator(),
    store: Todo.createTaskStore(() => storage),
  });
}

function makeUnavailableService() {
  return Todo.createTaskService({
    validator: Todo.createTaskValidator(),
    store: Todo.createTaskStore(() => {
      throw new Error('SecurityError');
    }),
  });
}

function titles(tasks) {
  return tasks.map((task) => task.title);
}

function ids(tasks) {
  return tasks.map((task) => task.id);
}

function stored(storage) {
  return JSON.parse(storage.peek(KEY));
}

test('init: a missing key gives an empty list and no warning', () => {
  const service = makeService(createFakeStorage());
  assert.deepStrictEqual(service.init(), { tasks: [], warning: null });
});

test('FR-9: init loads saved tasks in order', () => {
  const storage = createFakeStorage({
    [KEY]: '[{"id":1,"title":"a","completed":false},{"id":2,"title":"b","completed":false}]',
  });
  const result = makeService(storage).init();
  assert.deepStrictEqual(titles(result.tasks), ['a', 'b']);
  assert.equal(result.warning, null);
});

test('FR-15: init with unreadable data gives an empty list, UNREADABLE, and writes nothing', () => {
  const storage = createFakeStorage({ [KEY]: 'garbage' });
  const result = makeService(storage).init();
  assert.deepStrictEqual(result, { tasks: [], warning: 'UNREADABLE' });
  assert.equal(storage.peek(KEY), 'garbage');
  assert.equal(storage.peek(BACKUP_KEY), null);
});

test('FR-15: init with unavailable storage gives an empty list and UNAVAILABLE', () => {
  assert.deepStrictEqual(makeUnavailableService().init(), { tasks: [], warning: 'UNAVAILABLE' });
});

test('FR-3, FR-6, FR-8: adding a valid title creates an incomplete task and saves it', () => {
  const storage = createFakeStorage();
  const service = makeService(storage);
  service.init();
  const result = service.addTask('Complete Java revision');
  assert.equal(result.ok, true);
  assert.deepStrictEqual(result.task, { id: 1, title: 'Complete Java revision', completed: false });
  assert.deepStrictEqual(result.tasks, [result.task]);
  assert.equal(result.warning, null);
  assert.deepStrictEqual(stored(storage), [result.task]);
});

test('FR-13: the title is stored trimmed', () => {
  const service = makeService(createFakeStorage());
  service.init();
  assert.equal(service.addTask('  Buy milk  ').task.title, 'Buy milk');
});

test('FR-14: duplicates are allowed and order is creation order, newest last', () => {
  const storage = createFakeStorage();
  const service = makeService(storage);
  service.init();
  service.addTask('A');
  service.addTask('B');
  const result = service.addTask('A');
  assert.deepStrictEqual(titles(result.tasks), ['A', 'B', 'A']);
  assert.deepStrictEqual(ids(result.tasks), [1, 2, 3]);
  assert.deepStrictEqual(titles(stored(storage)), ['A', 'B', 'A']);
});

test('ids continue after the highest saved id', () => {
  const storage = createFakeStorage({
    [KEY]: '[{"id":1,"title":"a","completed":false},{"id":5,"title":"b","completed":false}]',
  });
  const service = makeService(storage);
  service.init();
  assert.equal(service.addTask('c').task.id, 6);
});

test('FR-4, FR-16: an empty or blank title is rejected and nothing changes', () => {
  const storage = createFakeStorage();
  const service = makeService(storage);
  service.init();
  for (const value of ['', '   ', '\t', '\u200B\u200B']) {
    assert.deepStrictEqual(service.addTask(value), { ok: false, code: 'EMPTY' });
  }
  assert.deepStrictEqual(service.getTasks(), []);
  assert.equal(storage.peek(KEY), null);
});

test('FR-11, FR-16: a too-long title is rejected and the saved list is untouched', () => {
  const storage = createFakeStorage();
  const service = makeService(storage);
  service.init();
  service.addTask('keep me');
  const before = storage.peek(KEY);
  assert.deepStrictEqual(service.addTask('x'.repeat(101)), { ok: false, code: 'TOO_LONG' });
  assert.equal(storage.peek(KEY), before);
  assert.deepStrictEqual(titles(service.getTasks()), ['keep me']);
});

test('returned task lists are copies; changing them does not change the service', () => {
  const service = makeService(createFakeStorage());
  service.init();
  const result = service.addTask('a');
  result.tasks[0].title = 'changed';
  result.tasks.push({ id: 99, title: 'x', completed: false });
  assert.deepStrictEqual(titles(service.getTasks()), ['a']);
});

test('FR-17: two services on one storage lose no tasks and never share an id', () => {
  const storage = createFakeStorage();
  const tabA = makeService(storage);
  const tabB = makeService(storage);
  tabA.init();
  tabB.init();

  tabA.addTask('from A');
  const resultB = tabB.addTask('from B');

  assert.deepStrictEqual(titles(resultB.tasks), ['from A', 'from B']);
  assert.deepStrictEqual(ids(stored(storage)), [1, 2]);
  assert.deepStrictEqual(titles(tabA.refresh().tasks), ['from A', 'from B']);
});

test('FR-15, DD-3: unreadable data is backed up, then replaced by the new list', () => {
  const storage = createFakeStorage({ [KEY]: 'garbage' });
  const service = makeService(storage);
  service.init();
  const result = service.addTask('first');
  assert.equal(result.ok, true);
  assert.equal(result.warning, null);
  assert.equal(storage.peek(BACKUP_KEY), 'garbage');
  assert.deepStrictEqual(titles(stored(storage)), ['first']);
});

test('FR-15, DD-7: if the backup cannot be written the task is still added with BACKUP_FAILED', () => {
  const storage = createFakeStorage({ [KEY]: 'garbage' });
  storage.failures.setKeys.add(BACKUP_KEY);
  const service = makeService(storage);
  service.init();
  const result = service.addTask('first');
  assert.equal(result.ok, true);
  assert.equal(result.warning, 'BACKUP_FAILED');
  assert.deepStrictEqual(titles(stored(storage)), ['first']);
  assert.equal(storage.peek(BACKUP_KEY), null);
});

test('FR-15: with unavailable storage the app works in memory and keeps UNAVAILABLE, never SAVE_FAILED', () => {
  const service = makeUnavailableService();
  service.init();
  const first = service.addTask('a');
  const second = service.addTask('b');
  assert.equal(first.warning, 'UNAVAILABLE');
  assert.equal(second.warning, 'UNAVAILABLE');
  assert.deepStrictEqual(titles(second.tasks), ['a', 'b']);
  assert.deepStrictEqual(ids(second.tasks), [1, 2]);
});

test('FR-15, DR-17: when saving fails but reading works, unsaved tasks stay in the list', () => {
  const storage = createFakeStorage();
  storage.failures.set = true;
  const service = makeService(storage);
  service.init();

  const first = service.addTask('a');
  assert.equal(first.warning, 'SAVE_FAILED');
  const second = service.addTask('b');
  assert.equal(second.warning, 'SAVE_FAILED');
  assert.deepStrictEqual(titles(second.tasks), ['a', 'b']);
  assert.deepStrictEqual(ids(second.tasks), [1, 2]);
  assert.equal(storage.peek(KEY), null);

  storage.failures.set = false;
  const third = service.addTask('c');
  assert.equal(third.warning, null);
  assert.deepStrictEqual(titles(third.tasks), ['a', 'b', 'c']);
  assert.deepStrictEqual(titles(stored(storage)), ['a', 'b', 'c']);
});

test('FR-15: a storage quota error is reported as SAVE_FAILED and the task stays listed', () => {
  const storage = createFakeStorage();
  storage.failures.quota = true;
  const service = makeService(storage);
  service.init();
  const result = service.addTask('a');
  assert.equal(result.warning, 'SAVE_FAILED');
  assert.deepStrictEqual(titles(result.tasks), ['a']);
});

test('DR-17, FR-17: refresh keeps unsaved tasks on top of tasks saved by another tab, with unique ids', () => {
  const storage = createFakeStorage();
  const tabA = makeService(storage);
  const tabB = makeService(storage);
  tabA.init();
  tabB.init();

  storage.failures.set = true;
  tabA.addTask('unsaved in A');
  storage.failures.set = false;
  tabB.addTask('saved by B');

  const refreshed = tabA.refresh();
  assert.deepStrictEqual(titles(refreshed.tasks), ['saved by B', 'unsaved in A']);
  assert.deepStrictEqual(ids(refreshed.tasks), [1, 2]);

  const next = tabA.addTask('later in A');
  assert.deepStrictEqual(titles(next.tasks), ['saved by B', 'unsaved in A', 'later in A']);
  assert.deepStrictEqual(ids(stored(storage)), [1, 2, 3]);
  assert.equal(next.warning, null);
});

test('refresh with a missing key shows only unsaved tasks', () => {
  const storage = createFakeStorage();
  storage.failures.set = true;
  const service = makeService(storage);
  service.init();
  service.addTask('unsaved');
  assert.deepStrictEqual(titles(service.refresh().tasks), ['unsaved']);
});

test('refresh keeps the in-memory list when the saved data is unreadable or storage is unavailable', () => {
  const storage = createFakeStorage();
  const service = makeService(storage);
  service.init();
  service.addTask('a');

  storage.setItem(KEY, 'garbage');
  assert.deepStrictEqual(titles(service.refresh().tasks), ['a']);

  const unavailable = makeUnavailableService();
  unavailable.init();
  unavailable.addTask('b');
  assert.deepStrictEqual(titles(unavailable.refresh().tasks), ['b']);
});

test('NFR-8: the service has no DOM or window dependency', () => {
  const source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', '..', 'src', 'task-service.js'),
    'utf8',
  );
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|localStorage/);
});

function makeSwitchableService(storage) {
  const state = { broken: false };
  const service = Todo.createTaskService({
    validator: Todo.createTaskValidator(),
    store: Todo.createTaskStore(() => {
      if (state.broken) throw new Error('SecurityError');
      return storage;
    }),
  });
  return { service, state };
}

test('CR-1: saved tasks are not duplicated when storage becomes readable again after an outage', () => {
  const storage = createFakeStorage();
  const { service, state } = makeSwitchableService(storage);
  service.init();
  service.addTask('a');

  state.broken = true;
  const during = service.addTask('b');
  assert.equal(during.warning, 'UNAVAILABLE');
  assert.deepStrictEqual(titles(during.tasks), ['a', 'b']);

  state.broken = false;
  const after = service.addTask('c');
  assert.equal(after.warning, null);
  assert.deepStrictEqual(titles(after.tasks), ['a', 'b', 'c']);
  assert.deepStrictEqual(ids(after.tasks), [1, 2, 3]);
  assert.deepStrictEqual(titles(stored(storage)), ['a', 'b', 'c']);
});

test('CR-1: refresh after an outage keeps the saved task once and the unsaved task once', () => {
  const storage = createFakeStorage();
  const { service, state } = makeSwitchableService(storage);
  service.init();
  service.addTask('a');
  state.broken = true;
  service.addTask('b');
  state.broken = false;
  assert.deepStrictEqual(titles(service.refresh().tasks), ['a', 'b']);
});

test('CR-1: unreadable data followed by a failed save and a later good save keeps each task once', () => {
  const storage = createFakeStorage({ [KEY]: 'garbage' });
  const service = makeService(storage);
  service.init();
  storage.failures.set = true;
  service.addTask('x');
  service.addTask('y');
  storage.failures.set = false;
  storage.setItem(KEY, '[]');
  const result = service.addTask('z');
  assert.deepStrictEqual(titles(result.tasks), ['x', 'y', 'z']);
  assert.deepStrictEqual(titles(stored(storage)), ['x', 'y', 'z']);
});

test('CR-7: refresh reports the warning that applies now', () => {
  const storage = createFakeStorage();
  const service = makeService(storage);
  service.init();
  assert.equal(service.refresh().warning, null);

  storage.failures.set = true;
  service.addTask('unsaved');
  assert.equal(service.refresh().warning, 'SAVE_FAILED');

  storage.failures.set = false;
  service.addTask('saved');
  assert.equal(service.refresh().warning, null);

  storage.setItem(KEY, 'garbage');
  assert.equal(service.refresh().warning, 'UNREADABLE');
  assert.deepStrictEqual(titles(service.refresh().tasks), ['unsaved', 'saved']);

  assert.equal(makeUnavailableService().refresh().warning, 'UNAVAILABLE');
});
