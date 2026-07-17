import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('web appointment dialog persists create requests and scoped identifiers', () => {
  const dialog = read('src/assets/components/Appointments/NewAppointmentDialog.jsx');
  assert.match(dialog, /databaseUrl\('\/appointments'\)/);
  assert.match(dialog, /appointment-options\/doctors/);
  assert.match(dialog, /method: 'POST'/);
  for (const field of ['patientID', 'doctorID', 'appointmentDateTime', 'specialty', 'meetingFor']) assert.match(dialog, new RegExp(field));
});

test('web appointment tickets call persisted update and cancel endpoints', () => {
  const section = read('src/assets/Sections/Appointments/AppointmentsSection.jsx');
  assert.match(section, /`\/appointments\/\$\{id\}\/cancel`/);
  assert.match(section, /method: action === 'cancel' \? 'PATCH' : 'PUT'/);
  assert.match(section, /authHeaders/);
});

test('mobile loads authenticated upcoming and past appointments and groups by specialty', () => {
  const mobile = fs.readFileSync(new URL('../../BC-Dentistry-Mobile-App/components/Appointments.jsx', import.meta.url), 'utf8');
  assert.match(mobile, /useUser\(\)/);
  assert.match(mobile, /authHeaders\(token\)/);
  assert.match(mobile, /appointments\?period=/);
  assert.match(mobile, /appointment\.Specialty/);
  assert.doesNotMatch(mobile, /appointmentsData/);
});
