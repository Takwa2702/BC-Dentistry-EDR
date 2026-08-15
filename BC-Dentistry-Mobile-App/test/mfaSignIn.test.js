const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'app', '(auth)', 'sign-in.jsx'), 'utf8');

test('mobile password login handles mandatory MFA before storing a session', () => {
  assert.match(source, /payload\.mfaRequired/);
  assert.match(source, /\/auth\/mfa\/verify/);
  assert.match(source, /finishSignIn\(payload\)/);
});
test('mobile supports authenticator enrollment and one-time recovery codes', () => {
  assert.match(source, /setup\.provisioningUri/);
  assert.match(source, /Linking\.canOpenURL/);
  assert.match(source, /autoComplete="one-time-code"/);
  assert.match(source, /setup\.secret/);
  assert.match(source, /Save recovery codes/);
});
