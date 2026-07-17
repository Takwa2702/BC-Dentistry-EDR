import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('web shell provides responsive layout, semantic navigation, and visible focus', () => {
  const app = read('src/App.jsx');
  const nav = read('src/assets/Sections/Navbar.jsx');
  const css = read('src/index.css');
  assert.match(app, /<main id="main-content" tabIndex="-1"/);
  assert.match(app, /lg:ml-\[15\.5%\]/);
  assert.match(nav, /<nav[^>]+aria-label="Primary navigation"/);
  assert.match(nav, /overflow-x-auto/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test('notification control exposes its accessible name and state', () => {
  const notifications = read('src/assets/components/Notifications.jsx');
  assert.match(notifications, /aria-label=\{`\$\{unread\} unread notifications/);
  assert.match(notifications, /disabled=\{!unread\}/);
  assert.match(notifications, /aria-live="polite"/);
});

test('DICOM viewer securely streams real records and loads Cornerstone lazily', () => {
  const viewer = read('src/assets/components/Patient/DicomViewer.jsx');
  const files = read('src/assets/components/Patient/RadiographicFiles.jsx');
  assert.match(files, /lazy\(\(\) => import\('\.\/DicomViewer\.jsx'\)\)/);
  assert.match(viewer, /radiographic-files\/\$\{encodeURIComponent\(file\.fileID\)\}\/content/);
  assert.match(viewer, /import\('@cornerstonejs\/core'\)/);
  assert.match(viewer, /renderingEngine\?\.destroy\(\)/);
  assert.doesNotMatch(viewer, /0002\.DCM|X-Ray Sample/);
});

test('mobile account and personal information use authenticated data without fixtures', () => {
  const settings = fs.readFileSync(new URL('../../BC-Dentistry-Mobile-App/app/(tabs)/settings.jsx', import.meta.url), 'utf8');
  const personal = fs.readFileSync(new URL('../../BC-Dentistry-Mobile-App/components/PersonalInfo.jsx', import.meta.url), 'utf8');
  assert.match(settings, /useUser\(\)/);
  assert.match(settings, /session has expired/);
  assert.doesNotMatch(settings, /const sample/);
  assert.match(personal, /Patient information is unavailable/);
  assert.doesNotMatch(personal, /John|Peanuts|Aspirin/);
});

test('patient list and request controls remove placeholders and expose unique names', () => {
  const page = read('src/assets/Pages/Patients.jsx').replace(/^\s*\/\/.*$/gm, '');
  const request = read('src/assets/components/Patients/RequestPatientCard.jsx').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(page, /PatientsFilters/);
  assert.match(request, /aria-label="Request access/);
  assert.doesNotMatch(request, /console\.log/);
});

test('patient detail displays all SRS profile categories', () => {
  const detail = read('src/assets/components/Patient/PatientPersonalInfo.jsx');
  for (const label of ['Patient ID', 'Insurance Provider', 'Policy Number', 'Coverage Type', 'Emirates ID', 'Nationality', 'Address', 'Blood Type', 'Phone Number', 'Email', 'Clinic', 'Assigned Doctors']) assert.match(detail, new RegExp(label));
});

test('patient login uses an owner-scoped route and admin patient creation is mounted accessibly', () => {
  const login = read('src/assets/Sections/LoginSection.jsx'), app = read('src/App.jsx');
  const cards = read('src/assets/Sections/Patients/PatientsCards.jsx'), dialog = read('src/assets/components/Patients/NewPatientDialog.jsx');
  assert.match(login, /role === 'patient' \? '\/my-record'/);
  assert.match(app, /path="\/my-record"/);
  assert.match(app, /getStoredUser\(\)\?\.blockchainID/);
  assert.doesNotMatch(app, /PagesCover/);
  assert.match(cards, /role === 'admin' && isAddPatientOpen/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.doesNotMatch(dialog, /document\.getElementById|window\.location\.hash|translate-y/);
});
