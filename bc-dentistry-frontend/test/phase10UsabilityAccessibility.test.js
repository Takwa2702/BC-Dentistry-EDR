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
  assert.match(notifications, /aria-label=\{`\$\{unread\} unread notifications`\}/);
  assert.match(notifications, /aria-expanded=\{open\}/);
  assert.match(notifications, /aria-controls="notification-panel"/);
  assert.match(notifications, /aria-live="polite"/);
});

test('DICOM viewer securely streams real records and loads Cornerstone lazily', () => {
  const viewer = read('src/assets/components/Patient/DicomViewer.jsx');
  const files = read('src/assets/components/Patient/RadiographicFiles.jsx');
  assert.match(files, /lazy\(\(\) => import\('\.\/DicomViewer\.jsx'\)\)/);
  assert.match(viewer, /radiographic-files\/\$\{encodeURIComponent\(file\.fileID\)\}\/content/);
  assert.match(viewer, /import\('@cornerstonejs\/core'\)/);
  assert.match(viewer, /renderingEngine\?\.destroy\(\)/);
  assert.match(viewer, /This DICOM file is corrupt or unreadable and cannot be displayed/);
  assert.match(viewer, /state\.status === 'image' \|\| state\.status === 'error'/);
  assert.match(files, /role=\{messageType === "error" \? "alert" : "status"\}/);
  assert.doesNotMatch(viewer, /0002\.DCM|X-Ray Sample/);
});

test('mobile account and personal information use authenticated data without fixtures', () => {
  const settings = fs.readFileSync(new URL('../../BC-Dentistry-Mobile-App/app/(tabs)/settings.jsx', import.meta.url), 'utf8');
  const personal = fs.readFileSync(new URL('../../BC-Dentistry-Mobile-App/components/PersonalInfo.jsx', import.meta.url), 'utf8');
  assert.match(settings, /useUser\(\)/);
  assert.match(settings, /Unable to load patient profile data/);
  assert.doesNotMatch(settings, /const sample/);
  assert.match(personal, /Not provided/);
  assert.doesNotMatch(personal, /John|Peanuts|Aspirin/);
});

test('patient list and request controls remove placeholders and expose unique names', () => {
  const page = read('src/assets/Pages/Patients.jsx').replace(/^\s*\/\/.*$/gm, '');
  const request = read('src/assets/components/Patients/RequestDataAccessDialog.jsx').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(page, /PatientsFilters/);
  assert.match(request, /Create cross-clinic referral/);
  assert.match(request, /Referral access expires/);
  assert.match(request, /Complete treatment/);
  assert.doesNotMatch(request, /console\.log/);
});

test('patient detail displays all SRS profile categories', () => {
  const detail = read('src/assets/components/Patient/PatientPersonalInfo.jsx');
  for (const label of ['Insurance Provider', 'Policy Number', 'Coverage Type', 'Emirates ID', 'Nationality', 'Address', 'Blood Type', 'Phone Number', 'Email', 'Clinic', 'Assigned Doctors']) assert.match(detail, new RegExp(label));
  assert.doesNotMatch(detail, /header=\{'Patient ID'\}/);
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

test('patient web requests expose pending consent, granted consent, history, and explicit revocation', () => {
  const app = read('src/App.jsx');
  const nav = read('src/assets/Sections/Navbar.jsx');
  const requests = read('src/assets/Pages/PatientDataRequests.jsx');
  assert.match(app, /path="\/patient-requests"/);
  assert.match(app, /roles=\{\['patient'\]\}/);
  assert.match(nav, /Patient-Requests/);
  assert.match(requests, /getAllRequestsForPatient/);
  assert.match(requests, /Waiting for your consent/);
  assert.match(requests, /Granted consent/);
  assert.match(requests, /Decision history/);
  assert.match(requests, /\/grantConsent/);
  assert.match(requests, /\/patient\/rejectRequest/);
  assert.match(requests, /\/patient\/revokeConsent/);
  assert.doesNotMatch(requests, /patient\.patientID|Patient blockchain ID/);
});

test('patient management uses complete themed workflows without browser dialogs', () => {
  const patientCard = read('src/assets/components/Patients/PatientCard.jsx');
  const patientDialog = read('src/assets/components/Patients/NewPatientDialog.jsx');
  const patientCards = read('src/assets/Sections/Patients/PatientsCards.jsx');
  assert.match(patientCard, /appointment-options\/doctors/);
  assert.match(patientCard, /title=\{`Deactivate \$\{fullName\}\?`\}/);
  assert.match(patientCard, /patients\/\$\{encodeURIComponent\(patientId\)\}\/unassign/);
  assert.match(patientCard, /result\?\.message \|\| 'Doctor assigned successfully\.'/);
  assert.match(patientCard, /already assigned/);
  assert.match(patientCard, /will not create a duplicate/);
  assert.match(patientDialog, /method:isEditing\?'PUT':'POST'/);
  assert.match(patientDialog, /clinic\/me/);
  assert.match(patientDialog, /appointment-options\/doctors/);
  assert.match(patientDialog, /isMulti isSearchable/);
  assert.match(patientDialog, /readOnly aria-readonly="true"/);
  assert.match(patientDialog, /firstName:100, lastName:100/);
  assert.match(patientDialog, /hyphens and apostrophes\. Maximum 100 characters per field/);
  assert.match(patientDialog, /aria-describedby=\{named\?'patient-name-rule':undefined\}/);
  assert.match(patientDialog, /maxLength=\{limits\[name\]\}/);
  assert.match(patientDialog, /784-\[0-9\]\{4\}/);
  assert.doesNotMatch(patientDialog, /Doctor IDs \(comma-separated\)/);
  assert.match(read('src/assets/Pages/Patients.jsx'), /role === 'doctor' && <button[\s\S]*?Request cross-clinic data access/);
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

test('web forms mirror server-side bounds for profiles, appointments, and clinical text', () => {
  const doctors = read('src/assets/Pages/Doctors.jsx');
  const clinics = read('src/assets/Pages/Clinics.jsx');
  const appointment = read('src/assets/components/Appointments/NewAppointmentDialog.jsx');
  const ticket = read('src/assets/components/Appointments/AppointmentTicket.jsx');
  const clinical = read('src/assets/components/Patient/ClinicalRecords.jsx');
  assert.match(doctors, /doctorFieldLimits/);
  assert.match(doctors, /maxLength=\{72\}/);
  assert.match(clinics, /clinicLimits/);
  assert.match(clinics, /adminLimits/);
  assert.match(appointment, /maxLength=\{255\}/);
  assert.match(appointment, /maxLength=\{2000\}/);
  assert.match(ticket, /maxLength=\{1000\}/);
  assert.match(clinical, /maxLength=\{4000\}/);
});

test('patient deactivation previews dependencies and explains preserved history', () => {
  const card = read('src/assets/components/Patients/PatientCard.jsx');
  assert.match(card, /deactivation-impact/);
  assert.match(card, /activeToCancel/);
  assert.match(card, /completedToPreserve/);
  assert.match(card, /clinicalRecordsToPreserve/);
  assert.match(card, /retain ledger history/);
});

test('API errors are rendered as human-readable text instead of raw objects or codes', () => {
  const api = read('src/assets/config/api.js');
  const clinics = read('src/assets/Pages/Clinics.jsx');
  const doctors = read('src/assets/Pages/Doctors.jsx');
  const signup = read('src/assets/Pages/Signup.jsx');
  const patientCard = read('src/assets/components/Patients/PatientCard.jsx');
  assert.match(api, /export const humanizeApiCode/);
  assert.match(api, /replace\(\/_\/g, ' '\)/);
  assert.match(api, /payload\?\.error\?\.message/);
  assert.match(api, /export const apiPayloadMessage/);
  assert.match(api, /export const apiRequestErrorMessage/);
  assert.match(clinics, /apiPayloadMessage\(payload/);
  assert.match(doctors, /apiPayloadMessage\(payload/);
  assert.match(signup, /apiRequestErrorMessage\(err/);
  assert.doesNotMatch(signup, /setError\(err\.response\?\.data\?\.error/);
  assert.match(patientCard, /result\?\.message \|\| 'Doctor unassigned successfully\.'/);
});

test('doctor and clinic deactivation require dependency-aware confirmation', () => {
  const doctors = read('src/assets/Pages/Doctors.jsx');
  const clinics = read('src/assets/Pages/Clinics.jsx');
  assert.match(doctors, /deactivation-impact/);
  assert.match(doctors, /replacementDoctorID/);
  assert.match(doctors, /No other active doctor remains/);
  assert.match(clinics, /deactivation-impact/);
  assert.match(clinics, /Deactivate clinic and cancel active items/);
  assert.match(clinics, /ledger history/);
});

test('lab results uses a full-width responsive page instead of the legacy twelve-column child grid', () => {
  const page = read('src/assets/Pages/LabResults.jsx');
  assert.match(page, /<main id="LabResults" className="mb-24 min-w-0 w-full">/);
  assert.match(page, /sm:grid-cols-2/);
  assert.match(page, /min-w-\[52rem\]/);
  assert.doesNotMatch(page, /<MainContainer/);
});

test('retryable web writes send stable idempotency keys', () => {
  const appointment = read('src/assets/components/Appointments/NewAppointmentDialog.jsx');
  const clinical = read('src/assets/components/Patient/ClinicalRecords.jsx');
  const radiographic = read('src/assets/components/Patient/RadiographicFiles.jsx');
  assert.match(appointment, /Idempotency-Key/);
  assert.match(clinical, /Idempotency-Key/);
  assert.match(radiographic, /Idempotency-Key/);
});
