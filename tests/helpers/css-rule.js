'use strict';

const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles.css'), 'utf8');

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns the declarations of the rule whose selector list is exactly `selector`, as an object.
function ruleDeclarations(selector) {
  const match = css.match(new RegExp('(?:^|\\n)' + escapeForRegex(selector) + '\\s*\\{([^}]*)\\}'));
  if (!match) throw new Error('No CSS rule for selector: ' + selector);
  const declarations = {};
  for (const line of match[1].split(';')) {
    const colon = line.indexOf(':');
    if (colon > 0) declarations[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return declarations;
}

module.exports = { css, ruleDeclarations };
