const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('pending patient requests show canonical doctor and clinic details without doctor UUIDs', () => {
  const requests = read(path.join('app', '(tabs)', 'requests.jsx'));
  assert.match(requests, /doctorName=\{request\.doctorName/);
  assert.match(requests, /clinicName=\{request\.requestingClinicName \|\| request\.doctorClinicName/);
  assert.doesNotMatch(requests, /from=\{request\.doctorID\}/);
});

test('patient consent actions use canonical routes and ACTIVE lifecycle status', () => {
  const actions = read(path.join('components', 'AccesptReject.jsx'));
  assert.match(actions, /databaseUrl\('\/grantConsent'\)/);
  assert.match(actions, /databaseUrl\('\/patient\/rejectRequest'\)/);
  assert.match(actions, /response\.data\?\.data\?\.status \|\| "ACTIVE"/);
  assert.doesNotMatch(actions, /provideConsent|blockchainUrl|CONSENT_GRANTED/);
});

test('patient consent controls are not clipped inside a fixed-height animated detail panel', () => {
  const card = read(path.join('components', 'DataRequest.jsx'));
  assert.match(card, /currentStatus === 'PENDING_PATIENT_CONSENT'/);
  assert.doesNotMatch(card, /toValue: 250|height: animatedHeight/);
  assert.match(card, /showRevoke && currentStatus === 'ACTIVE'/);
});

test('dashboard and history screens use lifecycleStatus and refresh on focus', () => {
  const api = read(path.join('services', 'apiClient.js'));
  const home = read(path.join('app', '(tabs)', 'home.jsx'));
  const approved = read(path.join('app', 'proceedRequests.jsx'));
  const rejected = read(path.join('app', 'rejectedRequests.jsx'));

  assert.match(api, /request\?\.lifecycleStatus \|\| request\?\.status/);
  assert.match(api, /throw error/);
  assert.match(home, /getRequestLifecycleStatus/);
  assert.match(approved, /useFocusEffect/);
  assert.match(approved, /getRequestLifecycleStatus\(request\) === 'ACTIVE'/);
  assert.match(rejected, /useFocusEffect/);
  assert.match(rejected, /getRequestLifecycleStatus\(request\)/);
});

test('request cards use the API requestedAt timestamp instead of missing date and time fields', () => {
  const pending = read(path.join('app', '(tabs)', 'requests.jsx'));
  const approved = read(path.join('app', 'proceedRequests.jsx'));
  const rejected = read(path.join('app', 'rejectedRequests.jsx'));
  const card = read(path.join('components', 'DataRequest.jsx'));

  for (const screen of [pending, approved, rejected]) {
    assert.match(screen, /requestedAt=\{request\.requestedAt\}/);
    assert.doesNotMatch(screen, /date=\{request\.date|time=\{request\.time/);
  }
  assert.match(card, /new Date\(requestedAt\)/);
  assert.match(card, /timestamp\.toLocaleString\(\)/);
  assert.match(card, /Date unavailable/);
});
