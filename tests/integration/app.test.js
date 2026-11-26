'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createFakeStorage } = require('../helpers/fake-storage');
const { createPageHarness } = require('../helpers/page-harness');

const KEY = 'todo-app.tasks.v1';
const { page, type, add: clickAdd, rows } = createPageHarness();

function savedTitles(storage) {
  return JSON.parse(storage.peek(KEY)).map((task) => task.title);
}

test('T-09: the real page loads its scripts and starts with zero jsdom errors', async () => {
  const p = await page({ storage: createFakeStorage() });
  assert.equal(typeof p.window.Todo.startApp, 'function');
  assert.deepStrictEqual(rows(p), []);
  assert.equal(p.errorRegion.textContent, '');
  assert.equal(p.warningRegion.textContent, '');
});

test('FR-1, FR-2: the page has a labelled input and an Add Task button', async () => {
  const p = await page({ storage: createFakeStorage() });
  const label = p.document.querySelector('label[for="title-input"]');
  assert.ok(label);
  assert.equal(p.input.type, 'text');
  assert.equal(p.button.textContent, 'Add Task');
  assert.equal(p.button.type, 'submit');
});

test('S1 (FR-3, FR-5, FR-6): clicking Add Task lists the task as incomplete', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  clickAdd(p, 'Complete Java revision');
  assert.deepStrictEqual(rows(p), [{ title: 'Complete Java revision', status: 'incomplete' }]);
  assert.deepStrictEqual(savedTitles(storage), ['Complete Java revision']);
});

test('S2 (FR-4): an empty title creates no task and shows a message', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  clickAdd(p, '');
  assert.deepStrictEqual(rows(p), []);
  assert.equal(p.errorRegion.textContent, 'Task title cannot be empty.');
  assert.equal(storage.peek(KEY), null);
  assert.equal(p.input.getAttribute('aria-invalid'), 'true');
});

test('S3 (FR-4): a whitespace-only title creates no task and shows a message', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  clickAdd(p, '   \t  ');
  assert.deepStrictEqual(rows(p), []);
  assert.equal(p.errorRegion.textContent, 'Task title cannot be empty.');
  assert.equal(storage.peek(KEY), null);
});

test('S3 (FR-4, DD-6): a title of only invisible characters is rejected', async () => {
  const p = await page({ storage: createFakeStorage() });
  clickAdd(p, '\u200B\u200B');
  assert.deepStrictEqual(rows(p), []);
  assert.equal(p.errorRegion.textContent, 'Task title cannot be empty.');
});

test('S4 (FR-7): the input is cleared and keeps focus after a task is added', async () => {
  const p = await page({ storage: createFakeStorage() });
  clickAdd(p, 'Buy milk');
  assert.equal(p.input.value, '');
  assert.equal(p.document.activeElement, p.input);
});

test('S5 (FR-8, FR-9): a task is still listed after the page is reloaded', async () => {
  const storage = createFakeStorage();
  const first = await page({ storage });
  clickAdd(first, 'Persist me');

  const second = await page({ storage });
  assert.deepStrictEqual(rows(second), [{ title: 'Persist me', status: 'incomplete' }]);
});

test('FR-10: submitting the form (as Enter does) adds the task like the button', async () => {
  const p = await page({ storage: createFakeStorage() });
  type(p, 'Added by submit');
  p.form.requestSubmit();
  assert.deepStrictEqual(rows(p), [{ title: 'Added by submit', status: 'incomplete' }]);
  assert.equal(p.input.value, '');
});

test('FR-13: the title is trimmed before it is shown and saved', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  clickAdd(p, '  Buy milk  ');
  assert.equal(rows(p)[0].title, 'Buy milk');
  assert.deepStrictEqual(savedTitles(storage), ['Buy milk']);
});

test('FR-14: duplicates are allowed and the newest task is at the bottom', async () => {
  const p = await page({ storage: createFakeStorage() });
  clickAdd(p, 'A');
  clickAdd(p, 'B');
  clickAdd(p, 'A');
  assert.deepStrictEqual(rows(p).map((row) => row.title), ['A', 'B', 'A']);
});

test('FR-11: 100 characters is accepted and 101 shows the limit message', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  clickAdd(p, 'x'.repeat(100));
  assert.equal(rows(p).length, 1);
  clickAdd(p, 'y'.repeat(101));
  assert.equal(rows(p).length, 1);
  assert.equal(p.errorRegion.textContent, 'Task title must be 100 characters or fewer.');
  assert.equal(JSON.parse(storage.peek(KEY)).length, 1);
});

test('DR-8: a rejected title stays in the input and the input is focused', async () => {
  const p = await page({ storage: createFakeStorage() });
  const tooLong = 'z'.repeat(120);
  clickAdd(p, tooLong);
  assert.equal(p.input.value, tooLong);
  assert.equal(p.document.activeElement, p.input);
});

test('FR-12: typing clears the validation message and the invalid state', async () => {
  const p = await page({ storage: createFakeStorage() });
  clickAdd(p, '');
  assert.notEqual(p.errorRegion.textContent, '');
  type(p, 'a');
  assert.equal(p.errorRegion.textContent, '');
  assert.equal(p.input.getAttribute('aria-invalid'), null);
  assert.equal(p.input.getAttribute('aria-describedby'), null);
});

test('FR-12: a successful add clears an earlier validation message', async () => {
  const p = await page({ storage: createFakeStorage() });
  clickAdd(p, '');
  p.input.value = 'Real task';
  p.button.click();
  assert.equal(p.errorRegion.textContent, '');
  assert.equal(rows(p).length, 1);
});

test('FR-16: a rejected add leaves the saved list and the displayed list unchanged', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  clickAdd(p, 'keep');
  const before = storage.peek(KEY);
  clickAdd(p, '   ');
  assert.equal(storage.peek(KEY), before);
  assert.deepStrictEqual(rows(p).map((row) => row.title), ['keep']);
});

test('NFR-6: a title containing markup is shown as text and nothing is injected', async () => {
  const p = await page({ storage: createFakeStorage() });
  const payload = '<img src=x onerror=alert(1)><script>window.hacked=1</script>';
  clickAdd(p, payload);
  const item = p.list.querySelector('li');
  assert.equal(item.querySelector('.task-title').textContent, payload);
  assert.equal(p.list.querySelector('img'), null);
  assert.equal(p.list.querySelector('script'), null);
  assert.equal(p.window.hacked, undefined);
});

test('NFR-6: stored data with markup in a title is also rendered as text', async () => {
  const payload = '<b>bold</b>';
  const storage = createFakeStorage({
    [KEY]: JSON.stringify([{ id: 1, title: payload, completed: false }]),
  });
  const p = await page({ storage });
  assert.equal(p.list.querySelector('.task-title').textContent, payload);
  assert.equal(p.list.querySelector('b'), null);
});

test('FR-15: unreadable saved data shows a warning that typing does not clear', async () => {
  const storage = createFakeStorage({ [KEY]: 'garbage' });
  const p = await page({ storage });
  assert.match(p.warningRegion.textContent, /could not be read/);
  assert.equal(p.warningRegion.getAttribute('role'), 'status');
  type(p, 'a');
  assert.match(p.warningRegion.textContent, /could not be read/);
});

test('FR-15, DD-3: adding after unreadable data replaces it, keeps a backup, and clears the warning', async () => {
  const storage = createFakeStorage({ [KEY]: 'garbage' });
  const p = await page({ storage });
  clickAdd(p, 'fresh');
  assert.equal(storage.peek(KEY + '.unreadable'), 'garbage');
  assert.deepStrictEqual(savedTitles(storage), ['fresh']);
  assert.equal(p.warningRegion.textContent, '');
});

test('FR-15: with local storage blocked the page warns and still works in memory', async () => {
  const p = await page({ storageUnavailable: true });
  assert.match(p.warningRegion.textContent, /not available/);
  clickAdd(p, 'in memory');
  assert.deepStrictEqual(rows(p).map((row) => row.title), ['in memory']);
  assert.match(p.warningRegion.textContent, /not available/);
});

test('FR-15: a failed save keeps the task listed and shows a warning', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  storage.failures.set = true;
  clickAdd(p, 'unsaved');
  assert.deepStrictEqual(rows(p).map((row) => row.title), ['unsaved']);
  assert.match(p.warningRegion.textContent, /could not be saved/);
});

test('FR-1: the input is visible and can take focus', async () => {
  const p = await page({ storage: createFakeStorage() });
  assert.equal(p.input.hasAttribute('hidden'), false);
  assert.equal(p.input.disabled, false);
  p.input.focus();
  assert.equal(p.document.activeElement, p.input);
});

test('NFR-1: the page has one input, one button, one list and one message block', async () => {
  const p = await page({ storage: createFakeStorage() });
  assert.equal(p.document.querySelectorAll('input').length, 1);
  assert.equal(p.document.querySelectorAll('button').length, 1);
  assert.equal(p.document.querySelectorAll('ul').length, 1);
  assert.equal(p.document.querySelectorAll('.messages').length, 1);
  assert.equal(p.document.querySelectorAll('form').length, 1);
});

test('CR-9: the task list keeps list semantics when list-style is removed', async () => {
  const p = await page({ storage: createFakeStorage() });
  assert.equal(p.list.getAttribute('role'), 'list');
});

test('FR-15, DD-7: BACKUP_FAILED is shown when the old data could not be copied', async () => {
  const storage = createFakeStorage({ [KEY]: 'garbage' });
  storage.failures.setKeys.add(KEY + '.unreadable');
  const p = await page({ storage });
  clickAdd(p, 'fresh');
  assert.match(p.warningRegion.textContent, /could not be copied/);
  assert.deepStrictEqual(savedTitles(storage), ['fresh']);
});

test('the view falls back to a generic message for an unknown code', async () => {
  const p = await page({ storage: createFakeStorage() });
  p.window.Todo.createTaskView(p.document).showError('NOT_A_CODE');
  assert.equal(p.errorRegion.textContent, 'Something went wrong.');
});

test('a saved task marked completed is shown as complete', async () => {
  const storage = createFakeStorage({ [KEY]: JSON.stringify([{ id: 1, title: 'done', completed: true }]) });
  const p = await page({ storage });
  assert.deepStrictEqual(rows(p), [{ title: 'done', status: 'complete' }]);
});

test('CR-8: a warning that does not change is not announced again after every add', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  storage.failures.set = true;
  clickAdd(p, 'a');
  const firstNode = p.warningRegion.firstChild;
  assert.ok(firstNode);
  clickAdd(p, 'b');
  assert.equal(p.warningRegion.firstChild, firstNode);
});

test('FR-15: the failed-save warning goes away after a later save works', async () => {
  const storage = createFakeStorage();
  const p = await page({ storage });
  storage.failures.set = true;
  clickAdd(p, 'a');
  assert.match(p.warningRegion.textContent, /could not be saved/);
  storage.failures.set = false;
  clickAdd(p, 'b');
  assert.equal(p.warningRegion.textContent, '');
  assert.deepStrictEqual(savedTitles(storage), ['a', 'b']);
});
