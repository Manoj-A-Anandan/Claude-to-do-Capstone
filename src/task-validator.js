(function (global) {
  'use strict';

  var MAX_CODE_POINTS = 100;
  var INVISIBLE_ONLY = /^[\p{White_Space}\p{Z}\p{Cc}\p{Cf}\u115F\u1160\u2800\u3164]*$/u;

  function createTaskValidator() {
    function validateTitle(rawTitle) {
      var title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
      if (INVISIBLE_ONLY.test(title)) {
        return { ok: false, code: 'EMPTY' };
      }
      if (Array.from(title).length > MAX_CODE_POINTS) {
        return { ok: false, code: 'TOO_LONG' };
      }
      return { ok: true, title: title };
    }

    return { validateTitle: validateTitle };
  }

  global.Todo = global.Todo || {};
  global.Todo.createTaskValidator = createTaskValidator;
})(typeof globalThis !== 'undefined' ? globalThis : this);
