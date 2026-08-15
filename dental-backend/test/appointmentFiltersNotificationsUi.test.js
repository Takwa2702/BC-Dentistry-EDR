const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets');
const page = fs.readFileSync(path.join(root, 'Pages', 'Appointments.jsx'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'components', 'Appointments', 'AppointmentsControlBar.jsx'), 'utf8');
const section = fs.readFileSync(path.join(root, 'Sections', 'Appointments', 'AppointmentsSection.jsx'), 'utf8');
const notifications = fs.readFileSync(path.join(root, 'components', 'Notifications.jsx'), 'utf8');

test('appointment controls filter and sort the rendered collection', () => {
  assert.match(page, /filters=\{filters\}/);
  assert.match(controls, /Search appointments/);
  assert.match(controls, /All dates/);
  assert.match(section, /visibleAppointments = appointmentsTickets\.filter/);
  assert.match(section, /searchable\.includes\(query\)/);
  assert.match(section, /filters\?\.sort === 'Doctor'/);
  assert.match(section, /appointment\.Doctor_Name \|\| appointment\.Doctor_ID/);
  assert.match(section, /appointment\.Patient_Name \|\| appointment\.Patient_ID/);
});

test('notification panel uses human-readable copy and bounded wrapping', () => {
  assert.match(notifications, /const notificationCopy/);
  assert.match(notifications, /Patient consent granted/);
  assert.match(notifications, /overflow-x-hidden/);
  assert.match(notifications, /break-words/);
  assert.match(notifications, /Notification devices could not be loaded/);
  assert.match(notifications, /onClick=\{loadDevices\}/);
});
