const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const db = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
const chaincode = fs.readFileSync(path.join(root, 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');
const blockchainApi = fs.readFileSync(path.join(root, 'dental-backend', 'index.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database', 'migrations', '2026-08-05-patient-clinic-transfer.sql'), 'utf8');
const card = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Patients', 'PatientCard.jsx'), 'utf8');
const appointment = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Appointments', 'NewAppointmentDialog.jsx'), 'utf8');

test('patient clinic association preserves historical directory membership', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS Patient_Clinic_Association/);
  assert.match(migration, /ENUM\('current','transferred'\)/);
  assert.match(db, /JOIN Patient_Clinic_Association PCA/);
  assert.match(db, /associationStatus/);
  assert.match(card, /Historical directory entry/);
  assert.match(card, /isAdmin && isOperational/);
});

test('FR-21 referral activation does not transfer operational ownership', () => {
  assert.match(db, /app\.post\('\/grantConsent'[\s\S]*relayBlockchainJson/);
  const consent = chaincode.match(/async ProvideConsent[\s\S]*?async GetPendingRequestsForPatient/)[0];
  assert.match(consent, /request\.status = 'ACTIVE'/);
  assert.doesNotMatch(consent, /patient\.sharedWith/);
  assert.match(consent, /operationalOwnerChanged: false/);
  assert.doesNotMatch(consent, /patient\.clinicID\s*=/);
  assert.doesNotMatch(consent, /patient\.doctors\s*=/);
  assert.doesNotMatch(consent, /destinationDoctor\.patients/);
  assert.doesNotMatch(db.match(/app\.post\('\/grantConsent'[\s\S]*?app\.post\('\/patient\/rejectRequest'/)[0], /UPDATE Patient|UPDATE Appointment|PATIENT_TRANSFER/);
  assert.match(blockchainApi, /app\.post\(\['\/requestDataAccess', '\/requestAccess'\]/);
});

test('former clinic cannot schedule or mutate a transferred patient', () => {
  assert.match(appointment, /patients\?operationalOnly=true/);
  assert.match(db, /APPOINTMENT_CLINIC_MISMATCH/);
  assert.match(db, /Patient and doctor must belong to the same current clinic/);
  assert.match(db, /requireAdminClinic\(req, current\.clinicID\)/);
});

test('cross-clinic requests require patient data at the holding clinic', () => {
  assert.match(chaincode, /patientClinicIDs\.includes\(originClinicID\)/);
  assert.match(chaincode, /does not have data in Clinic/);
  assert.match(chaincode, /cross-clinic access is not required/);
  assert.match(blockchainApi, /PATIENT_HAS_NO_DATA_IN_REQUESTED_CLINIC/);
  assert.match(blockchainApi, /patientHasNoDataAtClinic \? 409/);
});
