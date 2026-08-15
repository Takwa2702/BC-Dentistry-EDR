import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('web appointment dialog persists create requests and scoped identifiers', () => {
  const dialog = read('src/assets/components/Appointments/NewAppointmentDialog.jsx');
  const controls = read('src/assets/components/Appointments/AppointmentsControlBar.jsx');
  assert.match(dialog, /databaseUrl\('\/appointments'\)/);
  assert.match(dialog, /appointment-options\/doctors/);
  assert.match(dialog, /clinic\/me/);
  assert.match(dialog, /isSearchable/);
  assert.match(dialog, /readOnly aria-readonly="true"/);
  assert.match(dialog, /method: 'POST'/);
  for (const field of ['patientID', 'doctorID', 'appointmentDateTime', 'specialty', 'meetingFor']) assert.match(dialog, new RegExp(field));
  assert.match(dialog, /max-h-\[calc\(100vh-1\.5rem\)\]/);
  assert.match(dialog, /grid-cols-1[\s\S]*md:grid-cols-2/);
  assert.doesNotMatch(dialog, /translate-y|classList\.replace/);
  assert.match(controls, /isDialogOpen && <NewAppointmentDialog/);
});

test('web appointment tickets call persisted update and cancel endpoints', () => {
  const section = read('src/assets/Sections/Appointments/AppointmentsSection.jsx');
  const actionDialog = read('src/assets/components/ActionDialog.jsx');
  assert.match(section, /`\/appointments\/\$\{id\}\/cancel`/);
  assert.match(section, /method: action === 'cancel' \? 'PATCH' : 'PUT'/);
  assert.match(section, /authHeaders/);
  assert.match(actionDialog, /const onCloseRef = useRef\(onClose\)/);
  assert.match(actionDialog, /onCloseRef\.current\?\.\(\)/);
  assert.match(actionDialog, /\}, \[busy\]\);/);
  assert.doesNotMatch(actionDialog, /\[busy, onClose\]/);
});

test('mobile loads authenticated upcoming and past appointments and groups by specialty', () => {
  const mobile = fs.readFileSync(new URL('../../BC-Dentistry-Mobile-App/components/Appointments.jsx', import.meta.url), 'utf8');
  assert.match(mobile, /apiClient\.get\(databaseUrl/);
  assert.match(mobile, /appointments\?period=/);
  assert.match(mobile, /appointment\.Specialty/);
  assert.doesNotMatch(mobile, /appointmentsData/);
});

test('patient web appointments are authorized, navigable, grouped, and read-only', () => {
  const app = read('src/App.jsx');
  const nav = read('src/assets/Sections/Navbar.jsx');
  const page = read('src/assets/Pages/Appointments.jsx');
  const section = read('src/assets/Sections/Appointments/AppointmentsSection.jsx');
  const ticket = read('src/assets/components/Appointments/AppointmentTicket.jsx');
  assert.match(app, /roles=\{\['admin','doctor','patient'\]\}/);
  assert.match(nav, /normalizedRole === 'patient'[\s\S]*Appointments/);
  assert.match(page, /My Appointments/);
  assert.match(section, /Upcoming appointments/);
  assert.match(section, /Past and cancelled appointments/);
  assert.match(section, /canManage=\{!isPatient/);
  assert.match(ticket, /canManage && status !== 'cancelled'/);
});
