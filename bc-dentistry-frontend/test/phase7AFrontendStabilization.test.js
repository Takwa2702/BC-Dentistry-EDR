import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('all clinical application routes use the protected route boundary', () => {
  const app = read('src/App.jsx');
  for (const route of ['/dashboard', '/appointments', '/patients', '/patients/:id', '/doctors', '/datarequests', '/labresults', '/settings', '/info']) {
    assert.match(app, new RegExp(`path=["']${route.replace('/', '\\/')}`));
  }
  assert.match(app, /ProtectedRoute/);
  assert.doesNotMatch(app, /path="\/signup"/);
});

test('session validity requires an unexpired JWT and supports explicit clearing', () => {
  const auth = read('src/assets/utils/auth.js');
  assert.match(auth, /payload\.exp \* 1000 <= Date\.now\(\)/);
  assert.match(auth, /clearSession/);
  assert.match(read('src/assets/Sections/Topbar.jsx'), /Log out/);
});

test('doctor patient list and patient detail use scoped Database API routes', () => {
  assert.match(read('src/assets/Pages/Patients.jsx'), /databaseUrl\('\/doctor\/me\/assigned-patients'\)/);
  assert.match(read('src/assets/Pages/Patient.jsx'), /databaseUrl\(`\/patients\/\$\{encodeURIComponent\(patientId\)\}`\)/);
});

test('production build strips console statements and demo lab results are not rendered', () => {
  assert.match(read('vite.config.js'), /drop: \["console", "debugger"\]/);
  const lab = read('src/assets/Pages/LabResults.jsx');
  assert.match(lab, /Lab results unavailable/);
  assert.doesNotMatch(lab, /LabResultsSection/);
});

test('appointments page consumes the scoped API response envelope without mapping the response object', () => {
  const source = read('src/assets/Sections/Appointments/AppointmentsSection.jsx');
  assert.match(source, /Array\.isArray\(data\?\.data\) \? data\.data : \[\]/);
  assert.doesNotMatch(source, /setAppointmentsTickets\(data\)/);
  assert.match(source, /No appointments found\./);
});
