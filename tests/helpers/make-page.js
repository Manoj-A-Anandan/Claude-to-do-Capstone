'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const ORIGIN = 'http://localhost';
const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
};

const serveRepoFiles = requestInterceptor(async (request) => {
  const url = new URL(request.url);
  if (url.origin !== ORIGIN) return new Response('No network in tests', { status: 404 });

  const file = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT + path.sep)) return new Response('Forbidden', { status: 403 });
  if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });

  const type = CONTENT_TYPES[path.extname(file)] || 'application/octet-stream';
  return new Response(fs.readFileSync(file), { headers: { 'Content-Type': type } });
});

async function makePage(options) {
  const settings = options || {};
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));

  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
    url: ORIGIN + '/',
    runScripts: 'dangerously',
    resources: { interceptors: [serveRepoFiles] },
    virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          if (settings.storageUnavailable) {
            const error = new Error('localStorage is blocked');
            error.name = 'SecurityError';
            throw error;
          }
          return settings.storage;
        },
      });
    },
  });

  const { window } = dom;
  if (window.document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve));
  }

  const document = window.document;
  return {
    dom,
    window,
    document,
    errors,
    input: document.getElementById('title-input'),
    form: document.getElementById('task-form'),
    button: document.querySelector('#task-form button'),
    list: document.getElementById('task-list'),
    errorRegion: document.getElementById('title-error'),
    warningRegion: document.getElementById('warning'),
    confirmationRegion: document.getElementById('confirmation'),
    close() {
      window.close();
    },
  };
}

module.exports = { makePage };
