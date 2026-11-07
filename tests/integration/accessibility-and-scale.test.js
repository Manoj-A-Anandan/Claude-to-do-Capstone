'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

function add(p, title) {
  p.input.value = title;
  p.button.click();
}

test('NFR-7: live regions exist in the initial HTML with the right roles', async () => {
  const p = await page({ storage: createFakeStorage() });
  assert.equal(p.errorRegion.getAttribute('role'), 'alert');
  assert.equal(p.warningRegion.getAttribute('role'), 'status');
  assert.equal(p.confirmationRegion.getAttribute('role'), 'status');
});

test('NFR-7: aria-describedby on a rejected input resolves to the error region', async () => {
  const p = await page({ storage: createFakeStorage() });
  add(p, '');
  const target = p.document.getElementById(p.input.getAttribute('aria-describedby'));
  assert.equal(target, p.errorRegion);
  assert.equal(target.textContent, 'Task title cannot be empty.');
});

test('NFR-7: a repeated validation error is a new node, so it is announced again', async () => {
  const p = await page({ storage: createFakeStorage() });
  add(p, '');
  const first = p.errorRegion.firstChild;
  add(p, '');
  const second = p.errorRegion.firstChild;
  assert.notEqual(first, second);
  assert.equal(second.textContent, first.textContent);
});

test('DD-5, NFR-7: each add announces "Task added" with a new node, even for the same title', async () => {
  const p = await page({ storage: createFakeStorage() });
  add(p, 'A');
  const first = p.confirmationRegion.firstChild;
  assert.equal(first.textContent, 'Task added: A');
  add(p, 'A');
  const second = p.confirmationRegion.firstChild;
  assert.notEqual(first, second);
  assert.equal(second.textContent, 'Task added: A');
});

test('DD-5: the confirmation text is the title as plain text, not markup', async () => {
  const p = await page({ storage: createFakeStorage() });
  add(p, '<b>bold</b>');
  assert.equal(p.confirmationRegion.textContent, 'Task added: <b>bold</b>');
  assert.equal(p.confirmationRegion.querySelector('b'), null);
});

test('NFR-7: the confirmation region is hidden visually, not removed from the accessibility tree', async () => {
  const p = await page({ storage: createFakeStorage() });
  assert.equal(p.confirmationRegion.hasAttribute('hidden'), false);
  assert.equal(p.confirmationRegion.getAttribute('aria-hidden'), null);
  assert.ok(p.confirmationRegion.classList.contains('visually-hidden'));

  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles.css'), 'utf8');
  const rule = css.match(/\.visually-hidden\s*\{([^}]*)\}/);
  assert.ok(rule, 'visually-hidden rule exists');
  assert.match(rule[1], /clip/);
  assert.doesNotMatch(rule[1], /display\s*:\s*none|visibility\s*:\s*hidden/);
});

test('NFR-7: the input has a label and nothing removes the controls from the tab order', async () => {
  const p = await page({ storage: createFakeStorage() });
  assert.ok(p.document.querySelector('label[for="title-input"]'));
  assert.equal(p.input.getAttribute('tabindex'), null);
  assert.equal(p.button.getAttribute('tabindex'), null);
  assert.equal(p.list.getAttribute('aria-label'), 'Tasks');
});

test('NFR-3: the page declares a responsive viewport and wraps long unbroken titles', async () => {
  const p = await page({ storage: createFakeStorage() });
  const viewport = p.document.querySelector('meta[name="viewport"]');
  assert.match(viewport.getAttribute('content'), /width=device-width/);

  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles.css'), 'utf8');
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /min-height:\s*2\.75rem/);
});

test('NFR-2: a 500-task list renders and a new task is added quickly', async (t) => {
  const tasks = [];
  for (let id = 1; id <= 500; id += 1) tasks.push({ id, title: `Task number ${id}`, completed: false });
  const storage = createFakeStorage({ [KEY]: JSON.stringify(tasks) });

  const started = performance.now();
  const p = await page({ storage });
  const loadMs = performance.now() - started;
  assert.equal(p.list.querySelectorAll('li').length, 500);

  const addStarted = performance.now();
  add(p, 'Task number 501');
  const addMs = performance.now() - addStarted;
  assert.equal(p.list.querySelectorAll('li').length, 501);
  assert.equal(p.list.lastElementChild.querySelector('.task-title').textContent, 'Task number 501');

  t.diagnostic(`500 tasks: page load ${loadMs.toFixed(1)} ms, add one task ${addMs.toFixed(1)} ms (jsdom, not a browser)`);
  assert.ok(addMs < 1000, `adding to a 500-task list took ${addMs} ms`);
});
