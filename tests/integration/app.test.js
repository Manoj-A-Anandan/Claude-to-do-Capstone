'use strict';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { createFakeStorage } = require('../helpers/fake-storage');
const { makePage } = require('../helpers/make-page');

const KEY = 'todo-app.tasks.v1';
const open = [];

async function page(options) {
  const created = await makePage(options);
  open.push(created);
  return created;
}

afterEach(() => {
  while (open.length) {
    const closing = open.pop();
    assert.deepStrictEqual(
      closing.errors.map((error) => error.message),
      [],
      'the page reported a jsdom error',
    );
    closing.close();
  }
});

function type(p, value) {
  p.input.value = value;
  p.input.dispatchEvent(new p.window.Event('input', { bubbles: true }));
}

function clickAdd(p, value) {
  type(p, value);
  p.button.click();
}

function rows(p) {
  return Array.from(p.list.querySelectorAll('li')).map((li) => ({
    title: li.querySelector('.task-title').textContent,
    status: li.querySelector('.task-status').textContent,
  }));
}

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
  clickAdd(p, '​​');
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
