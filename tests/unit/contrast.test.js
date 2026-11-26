'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { ruleDeclarations } = require('../helpers/css-rule');

function luminance(hex) {
  const channels = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const pairs = [
  ['body text on page', ruleDeclarations('body').color, ruleDeclarations('body').background],
  ['input text', ruleDeclarations('input[type="text"]').color, ruleDeclarations('input[type="text"]').background],
  ['button text', ruleDeclarations('button').color, ruleDeclarations('button').background],
  ['button text on hover', ruleDeclarations('button').color, ruleDeclarations('button:hover').background],
  ['error message', ruleDeclarations('.message-error').color, ruleDeclarations('.message-error').background],
  ['warning message', ruleDeclarations('.message-warning').color, ruleDeclarations('.message-warning').background],
  ['task status text', ruleDeclarations('.task-status').color, ruleDeclarations('.task').background],
];

for (const [name, foreground, background] of pairs) {
  test(`NFR-7: ${name} has a contrast ratio of at least 4.5:1`, (t) => {
    assert.match(foreground, /^#[0-9a-f]{6}$/i);
    assert.match(background, /^#[0-9a-f]{6}$/i);
    const ratio = contrast(foreground, background);
    t.diagnostic(`${name}: ${foreground} on ${background} = ${ratio.toFixed(2)}:1`);
    assert.ok(ratio >= 4.5, `${name} is ${ratio.toFixed(2)}:1`);
  });
}

test('NFR-7: the input border meets the 3:1 contrast for interface components', () => {
  const border = ruleDeclarations('input[type="text"]').border.match(/#[0-9a-f]{6}/i)[0];
  assert.ok(contrast(border, ruleDeclarations('body').background) >= 3);
});
