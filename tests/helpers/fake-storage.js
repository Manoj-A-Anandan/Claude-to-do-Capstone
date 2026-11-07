'use strict';

function createFakeStorage(initial) {
  const data = new Map(Object.entries(initial || {}));
  const failures = { get: false, set: false, setKeys: new Set(), quota: false };

  function failure(name, message) {
    const error = new Error(message);
    error.name = name;
    return error;
  }

  return {
    failures,
    getItem(key) {
      if (failures.get) throw failure('SecurityError', 'getItem blocked');
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (failures.set || failures.setKeys.has(key)) throw failure('SecurityError', 'setItem blocked');
      if (failures.quota) throw failure('QuotaExceededError', 'quota exceeded');
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    key(index) {
      return Array.from(data.keys())[index] ?? null;
    },
    get length() {
      return data.size;
    },
    peek(key) {
      return data.has(key) ? data.get(key) : null;
    },
  };
}

module.exports = { createFakeStorage };
