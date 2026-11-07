(function (global) {
  'use strict';

  function startApp(options) {
    var doc = options.document;
    var win = doc.defaultView;
    var Todo = global.Todo;

    var store = Todo.createTaskStore(options.getStorage);
    var service = Todo.createTaskService({ validator: Todo.createTaskValidator(), store: store });
    var view = Todo.createTaskView(doc);

    var form = doc.getElementById('task-form');
    var input = doc.getElementById('title-input');

    var initial = service.init();
    view.renderTasks(initial.tasks);
    if (initial.warning) view.showWarning(initial.warning);

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
      if (result.warning) {
        view.showWarning(result.warning);
      } else {
        view.clearWarning();
      }
    });

    input.addEventListener('input', function () {
      view.clearError();
    });

    win.addEventListener('storage', function (event) {
      if (event.key === null || event.key === store.key) {
        view.renderTasks(service.refresh().tasks);
      }
    });

    return { service: service, store: store, view: view };
  }

  global.Todo = global.Todo || {};
  global.Todo.startApp = startApp;
})(typeof globalThis !== 'undefined' ? globalThis : this);
