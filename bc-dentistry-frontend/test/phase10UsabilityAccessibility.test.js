import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('web shell provides responsive layout, semantic navigation, and visible focus', () => {
  const app = read('src/App.jsx');
  const nav = read('src/assets/Sections/Navbar.jsx');
  const css = read('src/index.css');
  assert.match(app, /<main id="main-content" tabIndex="-1"/);
  assert.match(app, /data-release="2026-07-18-responsive-forms"/);
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

test('patient management uses complete themed workflows without browser dialogs', () => {
  const patientCard = read('src/assets/components/Patients/PatientCard.jsx');
  const patientDialog = read('src/assets/components/Patients/NewPatientDialog.jsx');
  const patientCards = read('src/assets/Sections/Patients/PatientsCards.jsx');
  assert.match(patientCard, /appointment-options\/doctors/);
  assert.match(patientCard, /title=\{`Delete \$\{fullName\}\?`\}/);
  assert.match(patientDialog, /method: isEditing \? 'PUT' : 'POST'/);
  assert.match(patientDialog, /appointment-options\/doctors/);
  assert.match(patientDialog, /type="search" role="combobox"/);
  assert.match(patientDialog, /aria-multiselectable="true"/);
  assert.doesNotMatch(patientDialog, /Doctor IDs \(comma-separated\)/);
  assert.match(patientCards, /role === 'doctor' && <RequestPatientCard/);
  for (const field of ['nationality', 'address', 'bloodType', 'medicalHistory', 'allergies', 'medications', 'insuranceProvider']) assert.match(patientDialog, new RegExp(field));

  const sourceRoot = new URL('../src/', import.meta.url);
  const sourceFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const location = new URL(entry.name, directory.href.endsWith('/') ? directory : new URL(`${directory.href}/`));
      if (entry.isDirectory()) visit(location);
      else if (/\.(js|jsx)$/.test(entry.name)) sourceFiles.push(location);
    }
  };
  visit(sourceRoot);
  const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(source, /\b(?:window\.)?(?:alert|prompt|confirm)\s*\(/);
});
