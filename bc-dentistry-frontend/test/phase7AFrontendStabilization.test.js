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

test('web session uses HttpOnly-cookie APIs and never stores a bearer token', () => {
  const auth = read('src/assets/utils/auth.js');
  assert.match(auth, /clearSession/);
  assert.doesNotMatch(auth, /localStorage\.(getItem|setItem)\(['"]token/);
  const api = read('src/assets/config/api.js');
  assert.match(api, /\/auth\/refresh/);
  assert.match(api, /\/auth\/me/);
  const topbar = read('src/assets/Sections/Topbar.jsx');
  assert.match(topbar, /\/auth\/logout/);
  assert.match(topbar, /Log out/);
});

test('doctor patient list and patient detail use scoped Database API routes', () => {
  assert.match(read('src/assets/Pages/Patients.jsx'), /databaseUrl\('\/doctor\/me\/assigned-patients'\)/);
  assert.match(read('src/assets/Pages/Patient.jsx'), /databaseUrl\(`\/patients\/\$\{encodeURIComponent\(patientId\)\}`\)/);
});

test('production build strips console statements and demo lab results are not rendered', () => {
  assert.match(read('vite.config.js'), /drop: \["console", "debugger"\]/);
  const lab = read('src/assets/Pages/LabResults.jsx');
  assert.match(lab, /databaseUrl\(`\/lab-results/);
  assert.match(lab, /No lab results have been recorded/);
  assert.match(lab, /Operational metadata only/);
  assert.doesNotMatch(lab, /LabResultsSection/);
  assert.doesNotMatch(lab, /Phase 9 smoke|sample lab|demo result/i);
});

test('appointments page consumes the scoped API response envelope without mapping the response object', () => {
  const source = read('src/assets/Sections/Appointments/AppointmentsSection.jsx');
  assert.match(source, /Array\.isArray\(data\?\.data\) \? data\.data : \[\]/);
  assert.doesNotMatch(source, /setAppointmentsTickets\(data\)/);
  assert.match(source, /No appointments match the selected filters\./);
  assert.match(source, /onDataLoaded\?\.\(appointments\)/);
  assert.match(source, /className="col-span-12 rounded-xl border bg-white p-6"/);
});

test('appointment statistics use the scoped API records rather than bundled demo data', () => {
  const source = read('src/assets/Sections/Appointments/AppointmentsStatstics.jsx');
  assert.doesNotMatch(source, /from "\.\.\/\.\.\/\.\.\/\.\.\/data"/);
  assert.match(source, /appointments\.reduce/);
  assert.match(source, /appointments\.length/);
  assert.match(source, /new Set\(appointments\.map/);
});

test('patient profile uses an initials avatar when image upload is unavailable', () => {
  const source = read('src/assets/components/Patient/PatientMainBar.jsx');
  assert.match(source, /const initials =/);
  assert.match(source, /role="img"/);
  assert.doesNotMatch(source, /<img\s+src=""/);
});
