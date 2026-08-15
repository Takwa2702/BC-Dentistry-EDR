import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const login = fs.readFileSync(path.join(here, '..', 'src', 'assets', 'Sections', 'LoginSection.jsx'), 'utf8');

test('login handles mandatory enrollment and verification without storing a user early', () => {
  assert.match(login, /response\.data\.mfaRequired/);
  assert.match(login, /enrollmentRequired/);
  assert.match(login, /\/auth\/mfa\/verify/);
  assert.match(login, /autoComplete="one-time-code"/);
});

test('enrollment exposes an authenticator URI, manual key, and one-time recovery codes', () => {
  assert.match(login, /provisioningUri/);
  assert.match(login, /QRCode\.toDataURL/);
  assert.match(login, /Scan a QR code/);
  assert.match(login, /alt="QR code for adding this EDR account/);
  assert.match(login, /setup\.secret/);
  assert.match(login, /Save your recovery codes/);
  assert.match(login, /They will not be shown again/);
});
