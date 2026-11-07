(function (global) {
  'use strict';

  function maxId(tasks) {
    var max = 0;
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id > max) max = tasks[i].id;
    }
    return max;
  }

  function copyTasks(tasks) {
    return tasks.map(function (task) {
      return { id: task.id, title: task.title, completed: task.completed };
    });
  }

  function createTaskService(deps) {
    var validator = deps.validator;
    var store = deps.store;
    var tasks = [];
    var pending = [];

    function storedPlusPending(stored) {
      var list = copyTasks(stored);
      var nextId = maxId(stored) + 1;
      pending.forEach(function (task) {
        list.push({ id: nextId, title: task.title, completed: task.completed });
        nextId += 1;
      });
      return list;
    }

    function init() {
      var result = store.read();
      var warning = null;
      pending = [];
      if (result.status === 'ok' || result.status === 'missing') {
        tasks = result.tasks;
      } else {
        tasks = [];
        warning = result.status === 'unreadable' ? 'UNREADABLE' : 'UNAVAILABLE';
      }
      return { tasks: copyTasks(tasks), warning: warning };
    }

    function addTask(rawTitle) {
      var validation = validator.validateTitle(rawTitle);
      if (!validation.ok) return { ok: false, code: validation.code };

      var current = store.read();
      var storedIsUsable = current.status === 'ok' || current.status === 'missing';
      var backupOk = true;
      var base;
      if (storedIsUsable) {
        base = storedPlusPending(current.tasks);
      } else {
        base = copyTasks(tasks);
        if (current.status === 'unreadable') backupOk = store.backup(current.raw);
      }

      var task = { id: maxId(base) + 1, title: validation.title, completed: false };
      var next = base.concat([task]);
      var written = store.write(next);

      tasks = next;
      var warning = null;
      if (written.ok) {
        pending = [];
        if (current.status === 'unreadable' && !backupOk) warning = 'BACKUP_FAILED';
      } else {
        pending = storedIsUsable ? next.slice(current.tasks.length) : next.slice();
        warning = current.status === 'unavailable' ? 'UNAVAILABLE' : 'SAVE_FAILED';
      }

      return { ok: true, task: copyTasks([task])[0], tasks: copyTasks(tasks), warning: warning };
    }

    function refresh() {
      var current = store.read();
      if (current.status === 'ok' || current.status === 'missing') {
        tasks = storedPlusPending(current.tasks);
      }
      return { tasks: copyTasks(tasks) };
    }

    function getTasks() {
      return copyTasks(tasks);
    }

    return { init: init, addTask: addTask, refresh: refresh, getTasks: getTasks };
  }

  global.Todo = global.Todo || {};
  global.Todo.createTaskService = createTaskService;
})(typeof globalThis !== 'undefined' ? globalThis : this);
