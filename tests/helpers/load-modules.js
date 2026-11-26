'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE_DIR = path.join(__dirname, '..', '..', 'src');
const SOURCE_FILES = [
  'task-validator.js',
  'task-store.js',
  'task-service.js',
  'task-view.js',
  'app.js',
];

function loadModules(options) {
  const dir = (options && options.dir) || SOURCE_DIR;
  const files = (options && options.files) || SOURCE_FILES;
  globalThis.Todo = undefined;
  for (const file of files) {
    const filename = path.join(dir, file);
    vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
  }
  const Todo = globalThis.Todo;
  globalThis.Todo = undefined;
  return Todo;
}

module.exports = { loadModules, SOURCE_FILES };
