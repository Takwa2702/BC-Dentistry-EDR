const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const api = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database', 'migrations', '2026-07-15-appointment-management.sql'), 'utf8');
const route = (method, routePath) => {
  const marker = `app.${method}('${routePath}'`;
  const start = api.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${method.toUpperCase()} ${routePath}`);
  return api.slice(start, api.indexOf('\n});', start) + 4);
};

test('appointment migration adds persisted datetime, specialty, status, and cancellation evidence', () => {
  for (const column of ['Appointment_Date_Time', 'Specialty', 'Status', 'Cancelled_Date', 'Modified_Date']) assert.match(migration, new RegExp(column));
  assert.match(migration, /AUTO_INCREMENT/);
});

test('admin-only create validates both patient and doctor clinic scope', () => {
  const source = route('post', '/appointments');
  assert.match(source, /requireRoles\('admin'\)/);
  assert.match(source, /requireAdminClinic\(req, rows\[0\]\.Patient_Clinic_ID\)/);
  assert.match(source, /Doctor_Clinic_ID === null/);
  assert.match(source, /Patient_Doctors/);
  assert.match(source, /APPOINTMENT_DOCTOR_SCOPE_DENIED/);
  assert.match(source, /requireAdminClinic\(req, rows\[0\]\.Doctor_Clinic_ID\)/);
  assert.match(source, /INSERT INTO Appointment/);
});

test('appointment doctor options include clinic doctors and assigned doctors without clinic metadata', () => {
  const source = route('get', '/appointment-options/doctors');
  assert.match(source, /requireRoles\('admin'\)/);
  assert.match(source, /Doctor\.Clinic_ID=\?/);
  assert.match(source, /Doctor\.Clinic_ID IS NULL/);
  assert.match(source, /JSON_CONTAINS\(Patient\.Doctors/);
});

test('update and cancel are admin-only and patient-clinic scoped', () => {
  const update = route('put', '/appointments/:id');
  const cancel = route('patch', '/appointments/:id/cancel');
  for (const source of [update, cancel]) { assert.match(source, /requireRoles\('admin'\)/); assert.match(source, /requireAdminClinic/); }
  assert.match(update, /Status='scheduled'/);
  assert.match(cancel, /Status='cancelled'/);
});

test('patient list derives identity from JWT and supports upcoming and past partitions', () => {
  assert.match(api, /Patient\.Blockchain_ID = \?/);
  assert.match(api, /params = \[req\.user\.blockchainID\]/);
  assert.match(api, /period === 'upcoming'/);
  assert.match(api, /period === 'past'/);
  assert.doesNotMatch(api, /req\.query\.patientID/);
});
