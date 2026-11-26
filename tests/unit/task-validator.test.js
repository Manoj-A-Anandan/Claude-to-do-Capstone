'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadModules } = require('../helpers/load-modules');

const Todo = loadModules({ files: ['task-validator.js'] });
const { validateTitle } = Todo.createTaskValidator();

const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
const ENGLAND_FLAG = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';

test('FR-3: a plain title is accepted', () => {
  assert.deepStrictEqual(validateTitle('Complete Java revision'), {
    ok: true,
    title: 'Complete Java revision',
  });
});

test('FR-13: leading and trailing whitespace is trimmed', () => {
  assert.deepStrictEqual(validateTitle('  Buy milk  '), { ok: true, title: 'Buy milk' });
  assert.deepStrictEqual(validateTitle('\t\nBuy milk\u00A0'), { ok: true, title: 'Buy milk' });
});

for (const [name, value] of [
  ['empty string', ''],
  ['spaces', '     '],
  ['tabs and newlines', '\t\n\r'],
  ['non-breaking space', '\u00A0\u00A0'],
  ['only ZWJ', '\u200D'],
  ['only ZWNJ', '\u200C'],
  ['only zero-width space', '\u200B\u200B'],
  ['braille blank U+2800', '\u2800'],
  ['Hangul filler U+3164', '\u3164'],
  ['Hangul choseong filler U+115F and jungseong filler U+1160', '\u115F\u1160'],
  ['spaces mixed with zero-width space', ' \u200B \u200B '],
  ['byte order mark', '\uFEFF'],
]) {
  test(`FR-4: rejects blank title (${name})`, () => {
    assert.deepStrictEqual(validateTitle(value), { ok: false, code: 'EMPTY' });
  });
}

for (const value of [undefined, null, 42, {}, []]) {
  test(`FR-4: rejects non-string input (${typeof value})`, () => {
    assert.deepStrictEqual(validateTitle(value), { ok: false, code: 'EMPTY' });
  });
}

for (const [name, value] of [
  ['Persian with ZWNJ', '\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645'],
  ['Devanagari with ZWJ', '\u0915\u094D\u200D\u0937'],
  ['ZWJ family emoji', FAMILY],
  ['subdivision flag (tag characters)', ENGLAND_FLAG],
  ['a single emoji', '\u{1F44D}'],
  ['zero-width space plus a letter', '\u200Ba'],
  ['a single visible letter', 'a'],
]) {
  test(`FR-4: accepts title with a visible character (${name})`, () => {
    assert.equal(validateTitle(value).ok, true);
  });
}

test('FR-11: 100 code points is accepted and 101 is rejected', () => {
  assert.equal(validateTitle('a'.repeat(100)).ok, true);
  assert.deepStrictEqual(validateTitle('a'.repeat(101)), { ok: false, code: 'TOO_LONG' });
});

test('FR-11: the limit applies after trimming', () => {
  assert.equal(validateTitle('  ' + 'a'.repeat(100) + '  ').ok, true);
});

test('FR-11: a single-code-point emoji counts once, not twice', () => {
  assert.equal(validateTitle('\u{1F44D}'.repeat(100)).ok, true);
  assert.equal(validateTitle('\u{1F44D}'.repeat(101)).ok, false);
});

test('FR-11: a ZWJ family emoji counts as several code points (documented limit)', () => {
  assert.equal(Array.from(FAMILY).length, 7);
  assert.equal(validateTitle(FAMILY.repeat(14)).ok, true);
  assert.deepStrictEqual(validateTitle(FAMILY.repeat(15)), { ok: false, code: 'TOO_LONG' });
});

test('CR-3: a very large invisible-only title is rejected without throwing', () => {
  assert.deepStrictEqual(validateTitle('\u200B'.repeat(5e6)), { ok: false, code: 'EMPTY' });
});

test('CR-3: a very large title with a visible character is too long, not a crash', () => {
  assert.deepStrictEqual(validateTitle('\u200B'.repeat(5e6) + 'a'), { ok: false, code: 'TOO_LONG' });
});
