(function (global) {
  'use strict';

  var MAX_CODE_POINTS = 100;
  // A title needs one character outside these invisible classes; a negated class avoids regex stack overflow on huge input.
  var HAS_VISIBLE_CHARACTER = /[^\p{White_Space}\p{Z}\p{Cc}\p{Cf}\u115F\u1160\u2800\u3164]/u;

  /** Creates the title validator: trims, rejects blank titles and titles over 100 code points. */
  function createTaskValidator() {
    function validateTitle(rawTitle) {
      var title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
      if (!HAS_VISIBLE_CHARACTER.test(title)) {
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
