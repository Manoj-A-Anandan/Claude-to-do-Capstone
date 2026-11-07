(function (global) {
  'use strict';

  var MESSAGES = {
    EMPTY: 'Task title cannot be empty.',
    TOO_LONG: 'Task title must be 100 characters or fewer.',
    UNAVAILABLE: 'Saving is not available in this browser. Your tasks will be lost when you leave this page.',
    UNREADABLE: 'Your saved tasks could not be read. Adding a task replaces them (a backup copy is kept if there is room).',
    SAVE_FAILED: 'This task could not be saved and may be lost when you refresh.',
    BACKUP_FAILED: 'Your old saved data could not be copied and has been replaced.',
  };
  var FALLBACK_MESSAGE = 'Something went wrong.';

  function createTaskView(doc) {
    var input = doc.getElementById('title-input');
    var errorRegion = doc.getElementById('title-error');
    var warningRegion = doc.getElementById('warning');
    var confirmationRegion = doc.getElementById('confirmation');
    var list = doc.getElementById('task-list');

    function removeChildren(element) {
      while (element.firstChild) element.removeChild(element.firstChild);
    }

    function setMessage(region, text) {
      var paragraph = doc.createElement('p');
      paragraph.textContent = text;
      removeChildren(region);
      region.appendChild(paragraph);
    }

    function messageFor(code) {
      return Object.prototype.hasOwnProperty.call(MESSAGES, code) ? MESSAGES[code] : FALLBACK_MESSAGE;
    }

    function renderTasks(tasks) {
      removeChildren(list);
      tasks.forEach(function (task) {
        var item = doc.createElement('li');
        item.className = 'task';
        item.setAttribute('data-id', String(task.id));

        var title = doc.createElement('span');
        title.className = 'task-title';
        title.textContent = task.title;

        var status = doc.createElement('span');
        status.className = 'task-status';
        status.textContent = task.completed ? 'complete' : 'incomplete';

        item.appendChild(title);
        item.appendChild(status);
        list.appendChild(item);
      });
    }

    function showError(code) {
      setMessage(errorRegion, messageFor(code));
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'title-error');
    }

    function clearError() {
      removeChildren(errorRegion);
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }

    function showWarning(code) {
      setMessage(warningRegion, messageFor(code));
    }

    function clearWarning() {
      removeChildren(warningRegion);
    }

    function announceAdded(title) {
      setMessage(confirmationRegion, 'Task added: ' + title);
    }

    function clearInput() {
      input.value = '';
    }

    function focusInput() {
      input.focus();
    }

    return {
      renderTasks: renderTasks,
      showError: showError,
      clearError: clearError,
      showWarning: showWarning,
      clearWarning: clearWarning,
      announceAdded: announceAdded,
      clearInput: clearInput,
      focusInput: focusInput,
    };
  }

  global.Todo = global.Todo || {};
  global.Todo.createTaskView = createTaskView;
})(typeof globalThis !== 'undefined' ? globalThis : this);
