(function (global) {
  'use strict';

  /** Wires validator, store, service and view to the page and starts listening for events. */
  function startApp(options) {
    var doc = options.document;
    var win = doc.defaultView;
    var Todo = global.Todo;

    var validator = Todo.createTaskValidator();
    var store = Todo.createTaskStore(options.getStorage, validator.validateTitle);
    var service = Todo.createTaskService({ validator: validator, store: store });
    var view = Todo.createTaskView(doc);

    var form = doc.getElementById('task-form');
    var input = doc.getElementById('title-input');

    function applyWarning(code) {
      if (code) {
        view.showWarning(code);
      } else {
        view.clearWarning();
      }
    }

    var initial = service.init();
    view.renderTasks(initial.tasks);
    applyWarning(initial.warning);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var result = service.addTask(input.value);
      if (!result.ok) {
        view.showError(result.code);
        view.focusInput();
        return;
      }
      view.renderTasks(result.tasks);
      view.clearInput();
      view.clearError();
      view.focusInput();
      view.announceAdded(result.task.title);
      applyWarning(result.warning);
    });

    input.addEventListener('input', function () {
      view.clearError();
    });

    win.addEventListener('storage', function (event) {
      if (event.key === null || event.key === store.key) {
        var refreshed = service.refresh();
        view.renderTasks(refreshed.tasks);
        applyWarning(refreshed.warning);
      }
    });

    return { service: service, store: store, view: view };
  }

  global.Todo = global.Todo || {};
  global.Todo.startApp = startApp;
})(typeof globalThis !== 'undefined' ? globalThis : this);
