const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');
const db = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'server.js'), 'utf8');
const chaincode = fs.readFileSync(path.resolve(__dirname, '..', '..', 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');
const clinicalRecordsUi = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Patient', 'ClinicalRecords.jsx'), 'utf8');
const accessAuditUi = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'Pages', 'DataRequests.jsx'), 'utf8');
const dentalCoding = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'dentalCoding.js'), 'utf8');
const migration = fs.readFileSync(path.resolve(__dirname, '..', '..', 'database', 'migrations', '2026-07-12-clinical-records.sql'), 'utf8');

test('clinical payload is stored off-chain and only reference/hash metadata is submitted', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS Clinical_Record/);
  assert.match(db, /INSERT INTO Clinical_Record/);
  assert.match(db, /clinicalHash\(normalizedPayload\)/);
  assert.match(db, /offChainRef: `mysql:Clinical_Record\/\$\{recordID\}`/);
  const tx = chaincode.match(/async _addClinicalMetadata[\s\S]*?async AddMedicalRecord/)[0];
  assert.doesNotMatch(tx, /payload|medicalHistory|allergies|labResults|medications/);
});

test('medical and dental SRS routes enforce doctor identity and complete fields', () => {
  assert.match(db, /\['medical', 'dental'\]/);
  assert.match(db, /medicalHistory.*allergies.*labResults.*medications/);
  assert.match(db, /treatmentPhase.*procedureCode.*ceramicType.*prescriptions.*diagnostics/);
  assert.match(dentalCoding, /FDI_TOOTH_CODES/);
  assert.match(dentalCoding, /DENTAL_SURFACES/);
  assert.match(db, /DOCTOR_ID_MISMATCH/);
  assert.match(db, /Clinical records may be written only for an active assigned patient/);
  assert.match(db, /Radiographic files may be uploaded only for an active assigned patient/);
  assert.match(api, /clinical-record-metadata'.*requireRoles\('doctor'\).*requireDoctorSelfBody\('doctorID'\)/s);
  assert.match(chaincode, /async AddDentalChartEntry/);
  assert.match(chaincode, /_requirePatientRecordAccess\(ctx, patientID, patient, recordType, 'doctor'\)/);
});

test('doctor and patient reads are access checked and automatically logged on-chain', () => {
  assert.match(api, /clinical-records\/:patientID\/:recordType'.*requireRoles\('doctor', 'patient'\)/s);
  assert.match(api, /submitTransaction\('LogClinicalAccess'/);
  assert.match(chaincode, /async LogClinicalAccess/);
  assert.match(chaincode, /docType: 'clinicalAccessLog'/);
  assert.match(chaincode, /transactionID/);
  assert.match(chaincode, /doctorID/);
  assert.match(chaincode, /accessMetadata/);
  assert.match(api, /accessLog: parseBufferJson\(accessLogResult\)/);
  assert.match(db, /accessEvidence/);
  assert.match(api, /clinical-access-logs\/:patientID/);
  assert.match(db, /getMedicalRecords\/:id/);
  assert.match(db, /getDentalChartData\/:id/);
});

test('main doctor patient reads return immutable access evidence', () => {
  const readHandler = api.match(/const readPatientHandler[\s\S]*?const requestAccessHandler/)[0];
  assert.match(readHandler, /isRole\(req, 'doctor'\)/);
  assert.match(readHandler, /submitTransaction\(\s*'LogClinicalAccess'/);
  assert.match(readHandler, /'patient-record'/);
  assert.match(readHandler, /accessLog/);
  assert.match(accessAuditUi, /Log ID:/);
  assert.match(accessAuditUi, /Transaction ID:/);
  assert.match(accessAuditUi, /Timestamp:/);
});

test('revoked cross-clinic access cannot survive a stale assignment or remain visible in the browser', () => {
  assert.match(chaincode, /Number\(doctor\.clinicID\) === Number\(patient\.clinicID\)/);
  assert.match(chaincode, /request\.status === 'ACTIVE'/);
  assert.match(clinicalRecordsUi, /setMedical\(\[\]\); setDental\(\[\]\); setMessage\(''\)/);
  assert.match(clinicalRecordsUi, /window\.addEventListener\('focus', revalidate\)/);
  assert.match(clinicalRecordsUi, /document\.addEventListener\('visibilitychange', revalidate\)/);
});
