const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const api = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database', 'migrations', '2026-08-05-appointment-overlap.sql'), 'utf8');
const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.compose.example'), 'utf8');
const dialog = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Appointments', 'NewAppointmentDialog.jsx'), 'utf8');

test('appointment duration has an environment fallback and optional database override', () => {
  assert.match(envExample, /APPOINTMENT_DEFAULT_DURATION_MINUTES=30/);
  assert.match(compose, /APPOINTMENT_DEFAULT_DURATION_MINUTES: \$\{APPOINTMENT_DEFAULT_DURATION_MINUTES:-30\}/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS System_Configuration/);
  assert.match(api, /appointment\.defaultDurationMinutes/);
  assert.match(api, /APPOINTMENT_DEFAULT_DURATION_MINUTES/);
  assert.match(api, /databaseDefault.*safeEnvironmentDefault/);
});

test('appointments persist a server-derived interval and reject intersecting ranges', () => {
  assert.match(migration, /Duration_Minutes/);
  assert.match(migration, /Appointment_End_Date_Time/);
  assert.match(api, /scheduledAt\.getTime\(\) \+ resolvedDuration \* 60 \* 1000/);
  assert.match(api, /Appointment\.Appointment_Date_Time < \?/);
  assert.match(api, /Appointment\.Appointment_End_Date_Time > \?/);
  assert.match(api, /APPOINTMENT_TIME_CONFLICT/);
  assert.match(api, /appointmentDurationBounds = \{ min: 30, max: 480 \}/);
  assert.match(api, /GET_LOCK\('edr:appointment-schedule',5\)/);
  assert.match(api, /RELEASE_LOCK\('edr:appointment-schedule'\)/);
});

test('web clients may select a duration while omission preserves compatibility', () => {
  assert.match(dialog, /durationMinutes: ''/);
  assert.match(dialog, /Clinic default/);
  assert.match(dialog, /30 minutes/);
});
