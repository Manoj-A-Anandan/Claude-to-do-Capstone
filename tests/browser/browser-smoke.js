'use strict';

/*
 * Real-browser smoke test (Chrome DevTools Protocol, no dependencies).
 *
 * How to run (from the repository root):
 *     node tests/browser/browser-smoke.js
 *
 * It finds Microsoft Edge or Google Chrome, starts it headless with a throw-away profile,
 * opens index.html over file://, and drives it with real input events (Input.insertText,
 * Input.dispatchKeyEvent, Input.dispatchMouseEvent). Uses only Node built-ins (Node 22+:
 * global WebSocket and fetch). Set BROWSER_PATH to use a specific browser executable.
 *
 * Exit code: 0 = all checks passed, 1 = a check failed, 2 = no browser found or the run
 * could not start (printed as "SKIPPED"). It is NOT named *.test.js, so `npm test` ignores it.
 * The browser process is always killed and the temporary profile deleted at the end.
 *
 * Lines starting with INFO report observed browser behaviour that is not pass/fail.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const PAGE_URL = pathToFileURL(path.resolve(__dirname, '..', '..', 'index.html')).href;
const STORAGE_KEY = 'todo-app.tasks.v1';
const BACKUP_KEY = STORAGE_KEY + '.unreadable';

const results = [];
function record(status, name, detail) {
  results.push({ status, name, detail });
  console.log(status + ' ' + name + (detail ? ' - ' + detail : ''));
}
function check(name, condition, detail) {
  record(condition ? 'PASS' : 'FAIL', name, detail);
  return condition;
}
function info(name, detail) {
  record('INFO', name, detail);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, timeoutMs, label) {
  const end = Date.now() + (timeoutMs || 3000);
  let last;
  while (Date.now() < end) {
    try {
      last = await fn();
      if (last) return last;
    } catch (error) {
      last = error;
    }
    await sleep(50);
  }
  throw new Error('timed out waiting for ' + (label || 'condition') + (last instanceof Error ? ': ' + last.message : ''));
}

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

// ---- Minimal CDP client -------------------------------------------------------------------

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (message) => {
      const data = JSON.parse(message.data);
      if (data.id) {
        const waiter = this.pending.get(data.id);
        if (!waiter) return;
        this.pending.delete(data.id);
        if (data.error) waiter.reject(new Error(data.error.message + ' (' + waiter.method + ')'));
        else waiter.resolve(data.result);
      } else {
        this.listeners.forEach((listener) => listener(data));
      }
    });
  }
  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => resolve(new Cdp(ws)));
      ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
    });
  }
  send(method, params, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify(payload));
    });
  }
  on(listener) {
    this.listeners.push(listener);
  }
  close() {
    try {
      this.ws.close();
    } catch (error) {
      // ignore
    }
  }
}

// A browser tab attached through a flat session, with problem collectors.
class Tab {
  constructor(cdp, sessionId, targetId, label) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.label = label;
    this.problems = [];
    this.requests = [];
    this.dialogs = [];
    cdp.on((event) => this.handle(event));
  }
  handle(event) {
    if (event.sessionId !== this.sessionId) return;
    const p = event.params || {};
    if (event.method === 'Runtime.exceptionThrown') {
      const d = p.exceptionDetails || {};
      this.problems.push('exception: ' + ((d.exception && d.exception.description) || d.text));
    } else if (event.method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'assert')) {
      this.problems.push('console.' + p.type + ': ' + (p.args || []).map((a) => a.value || a.description).join(' '));
    } else if (event.method === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning')) {
      this.problems.push('log ' + p.entry.level + ': ' + p.entry.text + ' ' + (p.entry.url || ''));
    } else if (event.method === 'Network.requestWillBeSent') {
      this.requests.push(p.request.url);
    } else if (event.method === 'Page.javascriptDialogOpening') {
      this.dialogs.push(p.message);
      this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  }
  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error('evaluate failed: ' + ((result.exceptionDetails.exception || {}).description || result.exceptionDetails.text));
    }
    return result.result.value;
  }
  async enableDomains() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('Network.enable');
  }
  async open(url, beforeNavigateScript) {
    await this.enableDomains();
    if (beforeNavigateScript) await this.send('Page.addScriptToEvaluateOnNewDocument', { source: beforeNavigateScript });
    await this.send('Page.navigate', { url });
    await waitFor(() => this.eval('document.readyState === "complete" && !!document.getElementById("task-form")'), 8000, 'page load');
  }
  async reload() {
    await this.send('Page.reload');
    await sleep(150);
    await waitFor(() => this.eval('document.readyState === "complete" && !!document.getElementById("task-form")'), 8000, 'page reload');
  }
  async rect(selector) {
    return this.eval('(function(){var r=document.querySelector(' + JSON.stringify(selector) + ').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()');
  }
  async click(selector) {
    await this.send('Page.bringToFront');
    const r = await this.rect(selector);
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  // Focus the input, select its content, and type (insertText replaces the selection and fires real input events).
  async typeIntoInput(text) {
    await this.send('Page.bringToFront');
    await this.eval('(function(){var i=document.getElementById("title-input");i.focus();i.select();})()');
    if (text === '') {
      await this.key('Backspace', 8);
    } else {
      await this.send('Input.insertText', { text });
    }
  }
  async key(key, code) {
    const base = { key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code };
    await this.send('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown' }, base));
    await this.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
  }
  async pressEnter() {
    await this.send('Page.bringToFront');
    const base = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' };
    await this.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base));
    await this.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
  }
  async addByButton(title) {
    await this.typeIntoInput(title);
    await this.click('#task-form button');
  }
  titles() {
    return this.eval('Array.from(document.querySelectorAll("#task-list .task-title")).map(function(e){return e.textContent;})');
  }
  statuses() {
    return this.eval('Array.from(document.querySelectorAll("#task-list .task-status")).map(function(e){return e.textContent;})');
  }
  errorText() {
    return this.eval('document.getElementById("title-error").textContent');
  }
  warningText() {
    return this.eval('document.getElementById("warning").textContent');
  }
  inputValue() {
    return this.eval('document.getElementById("title-input").value');
  }
  stored(key) {
    return this.eval('localStorage.getItem(' + JSON.stringify(key || STORAGE_KEY) + ')');
  }
  async close() {
    await this.cdp.send('Target.closeTarget', { targetId: this.targetId }).catch(() => {});
  }
}

async function newTab(cdp, label) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  return new Tab(cdp, sessionId, targetId, label);
}

// ---- Scenarios ----------------------------------------------------------------------------

async function scenarioMain(cdp) {
  const tab = await newTab(cdp, 'main');
  await tab.open(PAGE_URL);
  await tab.eval('localStorage.clear()');
  await tab.reload();

  // Load, controls
  check('page loads from file:// with controls visible',
    await tab.eval('location.protocol === "file:" && !!document.getElementById("title-input") && !!document.querySelector("#task-form button") && document.getElementById("task-list").children.length === 0'));
  check('FR-2: Add Task button label', (await tab.eval('document.querySelector("#task-form button").textContent')) === 'Add Task');
  check('FR-1/NFR-7: input has an associated label', await tab.eval('document.getElementById("title-input").labels.length === 1'));

  // S1 by real mouse click
  await tab.addByButton('Complete Java revision');
  await waitFor(async () => (await tab.titles()).length === 1, 2000, 'task rendered');
  check('S1/FR-3/FR-5/FR-6: click adds task with status incomplete',
    JSON.stringify(await tab.titles()) === '["Complete Java revision"]' && JSON.stringify(await tab.statuses()) === '["incomplete"]');
  check('S4/FR-7: input cleared after add', (await tab.inputValue()) === '');
  check('S4/DR-8: input keeps focus after add', await tab.eval('document.activeElement === document.getElementById("title-input")'));
  check('FR-8: localStorage holds the task under todo-app.tasks.v1',
    (await tab.stored()) === '[{"id":1,"title":"Complete Java revision","completed":false}]', await tab.stored());

  // Enter key with real key events
  await tab.typeIntoInput('Added with Enter');
  await tab.pressEnter();
  await waitFor(async () => (await tab.titles()).length === 2, 2000, 'Enter adds task');
  check('FR-10: real Enter key in the input adds the task', (await tab.titles())[1] === 'Added with Enter');

  // Empty / whitespace validation
  const before = await tab.stored();
  await tab.click('#task-form button');
  await sleep(100);
  check('S2/FR-4: empty title shows "Task title cannot be empty." and adds nothing',
    (await tab.errorText()) === 'Task title cannot be empty.' && (await tab.titles()).length === 2);
  check('NFR-7: error region is role=alert and input is aria-invalid',
    await tab.eval('document.getElementById("title-error").getAttribute("role")==="alert" && document.getElementById("title-input").getAttribute("aria-invalid")==="true"'));
  await tab.typeIntoInput('   \t  ');
  await tab.click('#task-form button');
  await sleep(100);
  check('S3/FR-4: spaces/tabs only is rejected', (await tab.errorText()) === 'Task title cannot be empty.' && (await tab.titles()).length === 2);
  await tab.typeIntoInput('\u200B\u200B');
  await tab.click('#task-form button');
  await sleep(100);
  check('FR-4: zero-width-space-only title is rejected', (await tab.errorText()) === 'Task title cannot be empty.' && (await tab.titles()).length === 2);
  check('FR-16: storage unchanged after rejections', (await tab.stored()) === before);

  // FR-12: typing clears the message
  await tab.typeIntoInput('x');
  await sleep(100);
  check('FR-12: typing removes the validation message',
    (await tab.errorText()) === '' && (await tab.eval('!document.getElementById("title-input").hasAttribute("aria-invalid")')));

  // FR-11 boundary
  await tab.typeIntoInput('y'.repeat(101));
  await tab.click('#task-form button');
  await sleep(100);
  check('FR-11: 101 characters shows the 100-character message, adds nothing, keeps the text',
    (await tab.errorText()) === 'Task title must be 100 characters or fewer.' && (await tab.titles()).length === 2 && (await tab.inputValue()).length === 101);
  await tab.typeIntoInput('z'.repeat(100));
  await tab.click('#task-form button');
  await waitFor(async () => (await tab.titles()).length === 3, 2000, '100-char task');
  check('FR-11: 100 characters is accepted', (await tab.titles())[2].length === 100 && (await tab.errorText()) === '');

  // FR-13/FR-14
  await tab.addByButton('  Buy milk  ');
  await tab.addByButton('A');
  await tab.addByButton('B');
  await tab.addByButton('A');
  await waitFor(async () => (await tab.titles()).length === 7, 2000, 'order tasks');
  const titles = await tab.titles();
  check('FR-13: title is trimmed', titles[3] === 'Buy milk');
  check('FR-14: duplicates allowed, creation order, newest last', JSON.stringify(titles.slice(4)) === '["A","B","A"]');

  // NFR-6 markup
  const markup = '<img src=x onerror=alert(1)>';
  await tab.addByButton(markup);
  await waitFor(async () => (await tab.titles()).length === 8, 2000, 'markup task');
  await sleep(300);
  check('NFR-6: markup title is shown literally as text',
    (await tab.titles())[7] === markup && (await tab.eval('document.querySelectorAll("#task-list img, #task-list script").length === 0')));
  check('NFR-6: no alert dialog opened', tab.dialogs.length === 0, JSON.stringify(tab.dialogs));
  check('NFR-6: "Task added" confirmation is plain text',
    (await tab.eval('document.getElementById("confirmation").textContent')) === 'Task added: ' + markup);

  // Keyboard: real Tab order and visible focus (fresh load so nothing is focused yet)
  await tab.reload();
  await tab.send('Page.bringToFront');
  await tab.key('Tab', 9);
  const first = await tab.eval('document.activeElement.id || document.activeElement.tagName');
  await tab.key('Tab', 9);
  const second = await tab.eval('document.activeElement.tagName');
  check('NFR-7: Tab reaches the input, then the button', first === 'title-input' && second === 'BUTTON', first + ' then ' + second);
  const outline = await tab.eval('(function(){var s=getComputedStyle(document.activeElement);return s.outlineStyle+" "+s.outlineWidth;})()');
  check('NFR-7: keyboard focus shows a 3px outline on the button', /solid 3px/.test(outline), outline);

  // Persistence across reload
  const expected = JSON.stringify(titles.concat([markup]));
  await tab.reload();
  check('S5/FR-9/NFR-5: tasks persist after a real reload, in order, as incomplete',
    JSON.stringify(await tab.titles()) === expected && (await tab.statuses()).every((s) => s === 'incomplete'));
  const parsed = JSON.parse(await tab.stored());
  check('FR-8: stored records have unique ids and completed=false',
    parsed.length === 8 && new Set(parsed.map((t) => t.id)).size === 8 && parsed.every((t) => t.completed === false && typeof t.title === 'string'));

  // Output document quality (rendered DOM)
  const bodyText = await tab.eval('document.body.innerText');
  check('rendered page has no "undefined", "null" or "[object" text', !/undefined|\bnull\b|\[object/.test(bodyText));
  check('rendered page has no absolute local path or secret-like value', !/[A-Za-z]:\\|file:\/\/\/|Bearer |api[_-]?key|secret|token/i.test(bodyText));
  check('no task title is empty', await tab.eval('Array.from(document.querySelectorAll(".task-title")).every(function(e){return e.textContent.trim().length>0;})'));
  check('regions present: main, h1, form, one alert, two status, list of 8',
    await tab.eval('!!document.querySelector("main") && !!document.querySelector("h1") && !!document.querySelector("form") && document.querySelectorAll("[role=alert]").length===1 && document.querySelectorAll("[role=status]").length===2 && document.querySelectorAll("ul#task-list li").length===8'));

  // Layout at 320 and 1920 with a 100-char unbroken title present
  await tab.eval('localStorage.clear()');
  await tab.reload();
  await tab.addByButton('W'.repeat(100));
  await tab.addByButton('Narrow screen check');
  await waitFor(async () => (await tab.titles()).length === 2, 2000, 'layout tasks');
  for (const width of [320, 1920]) {
    await tab.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(250);
    const m = await tab.eval('({inner: window.innerWidth, scroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth})');
    const button = await tab.rect('#task-form button');
    const inputRect = await tab.rect('#title-input');
    check('NFR-3: ' + width + 'px wide has no horizontal scroll', m.inner === width && m.scroll <= m.inner && m.bodyScroll <= m.inner, JSON.stringify(m));
    check('NFR-3: ' + width + 'px Add Task button is at least 44x44', button.width >= 44 && button.height >= 44, button.width.toFixed(1) + 'x' + button.height.toFixed(1));
    check('NFR-3: ' + width + 'px input is at least 44 px tall', inputRect.height >= 44, inputRect.height.toFixed(1));
    const overflowing = await tab.eval('Array.from(document.querySelectorAll(".task")).filter(function(e){return e.getBoundingClientRect().right > window.innerWidth;}).length');
    check('NFR-3: ' + width + 'px no task card extends past the viewport', overflowing === 0);
  }
  await tab.send('Emulation.clearDeviceMetricsOverride');

  // NFR-2: 500 tasks
  const many = JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ id: i + 1, title: 'Task ' + (i + 1), completed: false })));
  await tab.eval('localStorage.setItem(' + JSON.stringify(STORAGE_KEY) + ',' + JSON.stringify(many) + ')');
  await tab.reload();
  check('NFR-2: 500 stored tasks render', (await tab.titles()).length === 500);
  const ms = await tab.eval('(function(){var i=document.getElementById("title-input");i.value="one more";var t=performance.now();document.querySelector("#task-form button").click();return performance.now()-t;})()');
  check('NFR-2: adding to a 500-task list takes under 100 ms in the handler', ms < 100, ms.toFixed(1) + ' ms');

  // Malformed stored data (FR-15)
  await tab.eval('localStorage.clear(); localStorage.setItem(' + JSON.stringify(STORAGE_KEY) + ', "garbage")');
  await tab.reload();
  check('FR-15: malformed stored data shows a warning and the page stays usable',
    /could not be read/.test(await tab.warningText()) && (await tab.eval('!document.getElementById("title-input").disabled')));
  check('FR-15: malformed data is not overwritten before a task is added', (await tab.stored()) === 'garbage');
  await tab.addByButton('after garbage');
  await waitFor(async () => (await tab.titles()).length === 1, 2000, 'add after garbage');
  check('FR-15: add replaces data, backup key holds the old data, warning cleared',
    (await tab.stored(BACKUP_KEY)) === 'garbage' && JSON.parse(await tab.stored())[0].title === 'after garbage' && (await tab.warningText()) === '');

  // Missing field in a stored record
  await tab.eval('localStorage.setItem(' + JSON.stringify(STORAGE_KEY) + ', JSON.stringify([{id:1,completed:false}]))');
  await tab.reload();
  check('Missing field: a stored record without a title is unreadable (warning, no blank row)',
    /could not be read/.test(await tab.warningText()) && (await tab.titles()).length === 0);

  // Network
  const nonFile = tab.requests.filter((u) => !u.startsWith('file:') && !u.startsWith('data:'));
  check('NFR-4: no network (non-file) requests were made', nonFile.length === 0, 'requests seen: ' + tab.requests.length + ', non-file: ' + JSON.stringify(nonFile));

  // Console cleanliness for the whole session
  check('no console errors, log errors/warnings or exceptions during the session', tab.problems.length === 0, JSON.stringify(tab.problems));
  await tab.close();
}

async function scenarioTwoTabs(cdp) {
  const tab1 = await newTab(cdp, 'tab1');
  await tab1.open(PAGE_URL);
  await tab1.eval('localStorage.clear()');
  await tab1.reload();
  await tab1.eval('window.__storageEvents = 0; window.addEventListener("storage", function(){ window.__storageEvents++; });');
  const tab2 = await newTab(cdp, 'tab2');
  await tab2.open(PAGE_URL);

  await tab1.addByButton('from tab 1');
  await waitFor(async () => (await tab1.titles()).length === 1, 2000, 'tab1 add');
  await tab2.addByButton('from tab 2');
  await waitFor(async () => (await tab2.titles()).length >= 1, 2000, 'tab2 add');
  const t2 = await tab2.titles();
  check('FR-17: tab 2 adds on top of tab 1\'s task (tab 2 shows both)', JSON.stringify(t2) === '["from tab 1","from tab 2"]', JSON.stringify(t2));
  const stored = JSON.parse(await tab2.stored());
  check('FR-17: storage holds both tasks with different ids', stored.length === 2 && stored[0].id !== stored[1].id, JSON.stringify(stored));

  let updated = false;
  try {
    await waitFor(async () => (await tab1.titles()).length === 2, 3000, 'tab1 storage event');
    updated = true;
  } catch (error) {
    updated = false;
  }
  const events = await tab1.eval('window.__storageEvents');
  check('FR-17: tab 1 updated without a reload via the real storage event', updated,
    (updated ? '' : 'tab 1 still shows ' + JSON.stringify(await tab1.titles()) + '; ') + 'storage events seen by tab 1: ' + events);
  check('two tabs: no console errors or exceptions', tab1.problems.length === 0 && tab2.problems.length === 0, JSON.stringify(tab1.problems.concat(tab2.problems)));
  await tab1.reload();
  check('FR-17: after reload both tasks remain', JSON.stringify(await tab1.titles()) === '["from tab 1","from tab 2"]');
  await tab1.close();
  await tab2.close();
}

const BLOCK_STORAGE = 'Object.defineProperty(window, "localStorage", {configurable: true, get: function () { throw new DOMException("blocked", "SecurityError"); }});';
const QUOTA_FAIL = 'Storage.prototype.setItem = function () { throw new DOMException("quota", "QuotaExceededError"); };';

async function scenarioStorageFailures(cdp) {
  const blocked = await newTab(cdp, 'blocked');
  await blocked.open(PAGE_URL, BLOCK_STORAGE);
  check('FR-15 (simulated: throwing localStorage getter in a real browser): warning shown, page usable',
    /Saving is not available/.test(await blocked.warningText()));
  await blocked.addByButton('in memory only');
  await waitFor(async () => (await blocked.titles()).length === 1, 2000, 'blocked add');
  await blocked.addByButton('second');
  await waitFor(async () => (await blocked.titles()).length === 2, 2000, 'blocked add 2');
  check('FR-15: tasks stay in the list in memory when storage is blocked', JSON.stringify(await blocked.titles()) === '["in memory only","second"]');
  check('FR-15: warning still shown after add', /Saving is not available/.test(await blocked.warningText()));
  check('blocked storage: no uncaught exceptions', blocked.problems.filter((p) => p.startsWith('exception')).length === 0, JSON.stringify(blocked.problems));
  await blocked.close();

  const quota = await newTab(cdp, 'quota');
  await quota.open(PAGE_URL, QUOTA_FAIL);
  await quota.addByButton('cannot save');
  await waitFor(async () => (await quota.titles()).length === 3, 2000, "quota add");
  const quotaTitles = await quota.titles();
  const quotaStored = JSON.parse(await quota.stored());
  check("FR-15 (simulated: quota error on setItem): the unsaved task stays listed after the saved ones, with a warning",
    JSON.stringify(quotaTitles) === JSON.stringify(["from tab 1", "from tab 2", "cannot save"]) && /could not be saved/.test(await quota.warningText()), await quota.warningText());
  check("FR-15: a failed write leaves the previously saved tasks untouched", quotaStored.length === 2);
  await quota.close();

  info('browser-level "block all site data" setting',
    'Not Found: not simulated; the blocked-storage checks above replace window.localStorage with a throwing getter inside the real browser');
}

// ---- Main ---------------------------------------------------------------------------------

async function main() {
  const browserPath = findBrowser();
  if (!browserPath) {
    console.log('SKIPPED: no Edge or Chrome found (set BROWSER_PATH to a browser executable)');
    return 2;
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-browser-smoke-'));
  const child = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });

  let cdp = null;
  let code = 0;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    const lines = await waitFor(() => {
      if (!fs.existsSync(portFile)) return null;
      const parts = fs.readFileSync(portFile, 'utf8').split('\n').filter(Boolean);
      return parts.length >= 2 ? parts : null;
    }, 20000, 'browser start');
    cdp = await Cdp.connect('ws://127.0.0.1:' + lines[0].trim() + lines[1].trim());
    const version = await cdp.send('Browser.getVersion');
    console.log('Browser: ' + version.product + ' (' + path.basename(browserPath) + '), ' + os.platform() + ' ' + os.release());
    console.log('Page: ' + PAGE_URL);

    await scenarioMain(cdp);
    await scenarioTwoTabs(cdp);
    await scenarioStorageFailures(cdp);
  } catch (error) {
    record('FAIL', 'run aborted', error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : String(error));
  } finally {
    if (cdp) {
      await cdp.send('Browser.close').catch(() => {});
      cdp.close();
    }
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        child.kill('SIGKILL');
      } catch (error) {
        // already gone
      }
    }
    await sleep(800);
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.log('WARN could not delete temp profile ' + profile + ': ' + error.message);
    }
    console.log('Cleanup: browser stopped, temp profile ' + (fs.existsSync(profile) ? 'STILL EXISTS' : 'deleted'));
  }

  const failed = results.filter((r) => r.status === 'FAIL').length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  console.log('\nSummary: ' + passed + ' passed, ' + failed + ' failed, ' + results.filter((r) => r.status === 'INFO').length + ' info');
  if (failed > 0) code = 1;
  return code;
}

main().then((code) => process.exit(code), (error) => {
  console.error(error);
  process.exit(2);
});
