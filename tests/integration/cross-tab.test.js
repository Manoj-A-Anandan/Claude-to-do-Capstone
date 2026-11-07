'use strict';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { createFakeStorage } = require('../helpers/fake-storage');
const { makePage } = require('../helpers/make-page');

const KEY = 'todo-app.tasks.v1';
const open = [];

async function page(storage) {
  const created = await makePage({ storage });
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

function add(p, title) {
  p.input.value = title;
  p.button.click();
}

function titles(p) {
  return Array.from(p.list.querySelectorAll('.task-title')).map((node) => node.textContent);
}

function storageEvent(p, key) {
  p.window.dispatchEvent(new p.window.StorageEvent('storage', { key }));
}

test('FR-17: a task saved by another tab appears after the matching storage event', async () => {
  const storage = createFakeStorage();
  const tabA = await page(storage);
  const tabB = await page(storage);

  add(tabB, 'from B');
  assert.deepStrictEqual(titles(tabA), []);

  storageEvent(tabA, KEY);
  assert.deepStrictEqual(titles(tabA), ['from B']);
});

test('FR-17: a storage event with a null key (storage cleared or replaced) also refreshes the list', async () => {
  const storage = createFakeStorage();
  const tabA = await page(storage);
  const tabB = await page(storage);

  add(tabB, 'from B');
  storageEvent(tabA, null);
  assert.deepStrictEqual(titles(tabA), ['from B']);
});

test('FR-17: a storage event for an unrelated key is ignored', async () => {
  const storage = createFakeStorage();
  const tabA = await page(storage);
  const tabB = await page(storage);

  add(tabB, 'from B');
  storageEvent(tabA, 'some-other-app.key');
  assert.deepStrictEqual(titles(tabA), []);
});

test('FR-17, NFR-5: adding in a stale tab keeps tasks saved by another tab and keeps ids unique', async () => {
  const storage = createFakeStorage();
  const tabA = await page(storage);
  const tabB = await page(storage);

  add(tabB, 'from B');
  add(tabA, 'from A');

  assert.deepStrictEqual(titles(tabA), ['from B', 'from A']);
  const saved = JSON.parse(storage.peek(KEY));
  assert.deepStrictEqual(saved.map((task) => task.title), ['from B', 'from A']);
  assert.deepStrictEqual(saved.map((task) => task.id), [1, 2]);
});

test('FR-17: a refresh keeps a task that could not be saved on top of the other tab\'s tasks', async () => {
  const storage = createFakeStorage();
  const tabA = await page(storage);
  const tabB = await page(storage);

  storage.failures.set = true;
  add(tabA, 'unsaved in A');
  storage.failures.set = false;
  add(tabB, 'saved by B');

  storageEvent(tabA, KEY);
  assert.deepStrictEqual(titles(tabA), ['saved by B', 'unsaved in A']);
});

test('FR-17: a storage event does not clear a warning or a validation message', async () => {
  const storage = createFakeStorage({ [KEY]: 'garbage' });
  const tabA = await page(storage);
  assert.match(tabA.warningRegion.textContent, /could not be read/);

  storageEvent(tabA, KEY);
  assert.match(tabA.warningRegion.textContent, /could not be read/);
  assert.deepStrictEqual(titles(tabA), []);
});
