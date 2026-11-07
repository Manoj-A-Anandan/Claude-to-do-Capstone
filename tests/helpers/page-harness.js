'use strict';

const assert = require('node:assert/strict');
const { afterEach } = require('node:test');

const { makePage } = require('./make-page');

function type(p, value) {
  p.input.value = value;
  p.input.dispatchEvent(new p.window.Event('input', { bubbles: true }));
}

function add(p, value) {
  type(p, value);
  p.button.click();
}

function rows(p) {
  return Array.from(p.list.querySelectorAll('li')).map((li) => ({
    title: li.querySelector('.task-title').textContent,
    status: li.querySelector('.task-status').textContent,
  }));
}

function titles(p) {
  return rows(p).map((row) => row.title);
}

// Call once at the top of a test file: opens pages on demand and closes them, checking for jsdom errors, after each test.
function createPageHarness() {
  const open = [];

  afterEach(() => {
    const messages = [];
    while (open.length) {
      const closing = open.pop();
      messages.push(...closing.errors.map((error) => error.message));
      closing.close();
    }
    assert.deepStrictEqual(messages, [], 'a page reported a jsdom error');
  });

  async function page(options) {
    const created = await makePage(options);
    open.push(created);
    return created;
  }

  return { page, type, add, rows, titles };
}

module.exports = { createPageHarness, type, add, rows, titles };
