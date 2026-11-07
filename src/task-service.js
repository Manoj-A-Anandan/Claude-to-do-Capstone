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

  function isUsable(status) {
    return status === 'ok' || status === 'missing';
  }

  /** Creates the task list service: validates titles, assigns ids, saves, and tracks unsaved tasks. */
  function createTaskService(deps) {
    var validator = deps.validator;
    var store = deps.store;
    // The list on screen: saved tasks followed by tasks that could not be saved yet.
    var displayed = [];
    // Tasks added since the last successful write; their ids are provisional.
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

    function warningFor(status) {
      if (status === 'unreadable') return 'UNREADABLE';
      if (status === 'unavailable') return 'UNAVAILABLE';
      return pending.length > 0 ? 'SAVE_FAILED' : null;
    }

    function init() {
      var result = store.read();
      pending = [];
      displayed = isUsable(result.status) ? result.tasks : [];
      return { tasks: copyTasks(displayed), warning: isUsable(result.status) ? null : warningFor(result.status) };
    }

    function addTask(rawTitle) {
      var validation = validator.validateTitle(rawTitle);
      if (!validation.ok) return { ok: false, code: validation.code };

      var current = store.read();
      var usable = isUsable(current.status);
      var backupOk = true;
      var base;
      if (usable) {
        base = storedPlusPending(current.tasks);
      } else {
        base = copyTasks(displayed);
        if (current.status === 'unreadable') backupOk = store.backup(current.raw);
      }

      var task = { id: maxId(base) + 1, title: validation.title, completed: false };
      var next = base.concat([task]);
      var written = store.write(next);

      displayed = next;
      var warning = null;
      if (written.ok) {
        pending = [];
        if (current.status === 'unreadable' && !backupOk) warning = 'BACKUP_FAILED';
      } else {
        pending = usable ? next.slice(current.tasks.length) : pending.concat([task]);
        warning = current.status === 'unavailable' ? 'UNAVAILABLE' : 'SAVE_FAILED';
      }

      return { ok: true, task: copyTasks([task])[0], tasks: copyTasks(displayed), warning: warning };
    }

    function refresh() {
      var current = store.read();
      if (isUsable(current.status)) displayed = storedPlusPending(current.tasks);
      return { tasks: copyTasks(displayed), warning: warningFor(current.status) };
    }

    function getTasks() {
      return copyTasks(displayed);
    }

    return { init: init, addTask: addTask, refresh: refresh, getTasks: getTasks };
  }

  global.Todo = global.Todo || {};
  global.Todo.createTaskService = createTaskService;
})(typeof globalThis !== 'undefined' ? globalThis : this);
