const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const sessions = fs.readFileSync(path.join(__dirname, '..', 'sessionService.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'migrations', '2026-08-15-administrator-totp-mfa.sql'), 'utf8');

test('all password logins stop at an MFA challenge before session issuance', () => {
  const login = server.slice(server.indexOf("app.post('/login'"), server.indexOf("app.post('/auth/mfa/verify'"));
  assert.match(login, /Auth_MFA_Credential/);
  assert.match(login, /Auth_MFA_Challenge/);
  assert.match(login, /status\(202\)/);
  assert.doesNotMatch(login, /createSession\(/);
});

test('only successful MFA verification issues a session and supports one-time recovery codes', () => {
  const verify = server.slice(server.indexOf("app.post('/auth/mfa/verify'"), server.indexOf('const getBearerToken'));
  assert.match(verify, /matchingTotpStep/);
  assert.match(verify, /Used_At IS NULL/);
  assert.match(verify, /createSession\(/);
  assert.match(verify, /MFA_ENROLLED/);
  assert.match(verify, /MFA_RECOVERY_LOGIN/);
  assert.match(verify, /Last_TOTP_Step/);
});

test('sessions carry and enforce the MFA authentication claim', () => {
  assert.match(sessions, /mfa: Boolean\(user\.mfa\)/);
  assert.match(server, /user\.mfa !== true/);
  assert.match(server, /'MFA_REQUIRED'/);
});

test('rollout revokes legacy sessions and requires enrollment for every user role', () => {
  assert.match(migration, /UPDATE User SET Security_Version=Security_Version\+1/);
  assert.match(migration, /Revocation_Reason='MFA rollout'/);
  assert.doesNotMatch(migration, /Role_ID/);
});

test('controlled reset requires system role plus password and current TOTP', () => {
  assert.match(server, /auth\/mfa\/users\/:userID\/reset/);
  assert.match(server, /requireRoles\('system'\)/);
  assert.match(server, /bcrypt\.compare/);
  assert.match(server, /MFA_RESET_BY_SYSTEM/);
});
