const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'CustomInput.jsx'), 'utf8');

test('shared mobile input honors numeric MFA keyboards and one-time-code autofill', () => {
  assert.match(source, /type === 'number-pad' \? 'number-pad'/);
  assert.match(source, /autoComplete=\{autoComplete\}/);
  assert.match(source, /'number-pad'\]\.includes\(type\)/);
});
