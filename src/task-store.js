(function (global) {
  'use strict';

  var KEY = 'todo-app.tasks.v1';
  var BACKUP_KEY = KEY + '.unreadable';

  /**
   * Creates the local storage gateway. validateTitle is optional; when given, a saved
   * task whose title is blank makes the whole list unreadable (long titles are kept).
   */
  function createTaskStore(getStorage, validateTitle) {
    function hasShowableTitle(title) {
      if (typeof title !== 'string' || title.length === 0) return false;
      return !validateTitle || validateTitle(title).code !== 'EMPTY';
    }

    function isValidTask(task) {
      return (
        task !== null &&
        typeof task === 'object' &&
        !Array.isArray(task) &&
        Number.isSafeInteger(task.id) &&
        task.id >= 1 &&
        task.id < Number.MAX_SAFE_INTEGER &&
        hasShowableTitle(task.title) &&
        typeof task.completed === 'boolean'
      );
    }

    function parseTasks(raw) {
      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        return null;
      }
      if (!Array.isArray(parsed)) return null;

      var seenIds = new Set();
      var tasks = [];
      for (var i = 0; i < parsed.length; i++) {
        var task = parsed[i];
        if (!isValidTask(task) || seenIds.has(task.id)) return null;
        seenIds.add(task.id);
        tasks.push({ id: task.id, title: task.title, completed: task.completed });
      }
      return tasks;
    }

    function read() {
      var raw;
      try {
        raw = getStorage().getItem(KEY);
      } catch (error) {
        return { status: 'unavailable', tasks: [], raw: null };
      }
      if (raw === null || raw === undefined) return { status: 'missing', tasks: [], raw: null };

      var tasks = typeof raw === 'string' ? parseTasks(raw) : null;
      if (tasks === null) return { status: 'unreadable', tasks: [], raw: String(raw) };
      return { status: 'ok', tasks: tasks, raw: raw };
    }

    function write(tasks) {
      try {
        getStorage().setItem(KEY, JSON.stringify(tasks));
        return { ok: true };
      } catch (error) {
        return { ok: false };
      }
    }

    function backup(raw) {
      try {
        getStorage().setItem(BACKUP_KEY, raw);
        return true;
      } catch (error) {
        return false;
      }
    }

    return { key: KEY, backupKey: BACKUP_KEY, read: read, write: write, backup: backup };
  }

  global.Todo = global.Todo || {};
  global.Todo.createTaskStore = createTaskStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
