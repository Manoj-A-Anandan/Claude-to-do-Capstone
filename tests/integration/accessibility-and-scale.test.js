'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createFakeStorage } = require('../helpers/fake-storage');
const { createPageHarness } = require('../helpers/page-harness');
const { css, ruleDeclarations } = require('../helpers/css-rule');

const KEY = 'todo-app.tasks.v1';
const { page, add } = createPageHarness();

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

  const rule = ruleDeclarations('.visually-hidden');
  assert.ok(rule.clip);
  assert.equal(rule.display, undefined);
  assert.equal(rule.visibility, undefined);
});

test('NFR-7: the input has a label and nothing removes the controls from the tab order', async () => {
  const p = await page({ storage: createFakeStorage() });
  assert.ok(p.document.querySelector('label[for="title-input"]'));
  assert.equal(p.input.getAttribute('tabindex'), null);
  assert.equal(p.button.getAttribute('tabindex'), null);
  assert.equal(p.list.getAttribute('aria-label'), 'Tasks');
});

test('NFR-3: viewport meta, 44 px targets on the button and input, and wrapping of long titles', async () => {
  const p = await page({ storage: createFakeStorage() });
  const viewport = p.document.querySelector('meta[name="viewport"]');
  assert.match(viewport.getAttribute('content'), /width=device-width/);

  const button = ruleDeclarations('button');
  assert.equal(button['min-height'], '2.75rem');
  assert.equal(button['min-width'], '2.75rem');
  assert.equal(ruleDeclarations('input[type="text"]')['min-height'], '2.75rem');
  assert.equal(ruleDeclarations('.task-title')['overflow-wrap'], 'anywhere');
  assert.equal(ruleDeclarations('.message')['overflow-wrap'], 'anywhere');
  assert.equal(ruleDeclarations('.app')['max-width'], '36rem');
  assert.match(css, /box-sizing:\s*border-box/);
});

test('NFR-2: smoke test, a 500-task list renders and a new task is added (timing is only logged, bounded loosely)', async (t) => {
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
