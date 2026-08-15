const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const api = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
const patientsPage = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'Pages', 'Patients.jsx'), 'utf8');
const patientCards = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'Sections', 'Patients', 'PatientsCards.jsx'), 'utf8');
const auditPage = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'Pages', 'DataRequests.jsx'), 'utf8');
const appointmentDialog = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Appointments', 'NewAppointmentDialog.jsx'), 'utf8');
const labResults = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'Pages', 'LabResults.jsx'), 'utf8');

test('doctor directory is sourced only from the assigned-patients self route', () => {
  assert.match(patientsPage, /role === 'doctor'.*\/doctor\/me\/assigned-patients/);
  assert.doesNotMatch(patientCards, /patients\/search|patients\/lookup/);
  assert.match(patientsPage, /RequestDataAccessDialog/);
});

test('application API does not expose cross-clinic patient discovery', () => {
  assert.doesNotMatch(api, /app\.get\('\/patients\/(?:search|lookup)/);
});

test('authorized patient selectors display clinical identifiers while keeping blockchain IDs hidden', () => {
  assert.match(auditPage, /Search clinic patients/);
  assert.match(auditPage, /patient\.emiratesID \|\| patient\.email \|\| patient\.contactNumber/);
  assert.doesNotMatch(auditPage, /Patient blockchain ID/);
  assert.match(appointmentDialog, /patient\.emiratesID \|\| patient\.email \|\| patient\.contactNumber/);
  assert.doesNotMatch(appointmentDialog, /\$\{patient\.patientID\}\)/);
  assert.match(labResults, /patient\.emiratesID \|\| patient\.email \|\| patient\.contactNumber/);
  assert.doesNotMatch(labResults, />\{result\.patientID\}</);
});

test('referral lookup uses an exact familiar identifier and returns no patient directory result', () => {
  const start = api.indexOf("app.post(['/requestDataAccess', '/requestAccess']");
  const source = api.slice(start, api.indexOf("app.get('/referrals'", start));
  assert.match(source, /\['email','phone','emiratesid'\]\.includes\(lookupType\)/);
  assert.match(source, /LOWER\(PatientUser\.Email\)=LOWER\(\?\)/);
  assert.match(source, /PatientUser\.Contact_Number=\?/);
  assert.match(source, /Patient\.Emirates_ID=\?/);
  assert.match(source, /patientID:rows\[0\]\.Blockchain_ID/);
  assert.match(source, /\? Number\(rows\[0\]\.Clinic_ID\) : Number\(req\.body\.dataOriginClinicID\)/);
  assert.doesNotMatch(source, /First_Name|Last_Name/);
});

test('canonical request API derives the normal clinic but permits explicit negative-test input for Fabric validation', () => {
  const start = api.indexOf("app.post(['/requestDataAccess', '/requestAccess']");
  const source = api.slice(start, api.indexOf("app.get('/getAllRequestsForPatient", start));
  assert.match(source, /const dataOriginClinicID = req\.body\.dataOriginClinicID/);
  assert.match(source, /INVALID_DATA_ORIGIN_CLINIC_ID/);
  assert.match(source, /dataOriginClinicID,/);
  assert.match(source, /doctorID:req\.user\.blockchainID/);
  assert.match(source, /DATA_ACCESS_NOT_REQUIRED/);
  assert.doesNotMatch(source, /DATA_ORIGIN_CLINIC_MISMATCH/);
  assert.match(source, /REQUEST_PURPOSE_TOO_LONG/);
});
