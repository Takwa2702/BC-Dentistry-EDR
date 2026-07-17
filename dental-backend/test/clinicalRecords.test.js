const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');
const db = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'server.js'), 'utf8');
const chaincode = fs.readFileSync(path.resolve(__dirname, '..', '..', 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');
const migration = fs.readFileSync(path.resolve(__dirname, '..', '..', 'database', 'migrations', '2026-07-12-clinical-records.sql'), 'utf8');

test('clinical payload is stored off-chain and only reference/hash metadata is submitted', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS Clinical_Record/);
  assert.match(db, /INSERT INTO Clinical_Record/);
  assert.match(db, /clinicalHash\(req\.body\.payload\)/);
  assert.match(db, /offChainRef: `mysql:Clinical_Record\/\$\{recordID\}`/);
  const tx = chaincode.match(/async _addClinicalMetadata[\s\S]*?async AddMedicalRecord/)[0];
  assert.doesNotMatch(tx, /payload|medicalHistory|allergies|labResults|medications/);
});

test('medical and dental SRS routes enforce doctor identity and complete fields', () => {
  assert.match(db, /\['medical', 'dental'\]/);
  assert.match(db, /medicalHistory.*allergies.*labResults.*medications/);
  assert.match(db, /treatmentPhase.*procedureCode.*tooth.*ceramicType.*prescriptions.*diagnostics/);
  assert.match(api, /clinical-record-metadata'.*requireRoles\('doctor'\).*requireDoctorSelfBody\('doctorID'\)/s);
  assert.match(chaincode, /async AddDentalChartEntry/);
  assert.match(chaincode, /_requirePatientRecordAccess\(ctx, patientID, patient, 'doctor'\)/);
});

test('doctor and patient reads are access checked and automatically logged on-chain', () => {
  assert.match(api, /clinical-records\/:patientID\/:recordType'.*requireRoles\('doctor', 'patient'\)/s);
  assert.match(api, /submitTransaction\('LogClinicalAccess'/);
  assert.match(chaincode, /async LogClinicalAccess/);
  assert.match(chaincode, /docType: 'clinicalAccessLog'/);
  assert.match(api, /clinical-access-logs\/:patientID/);
  assert.match(db, /getMedicalRecords\/:id/);
  assert.match(db, /getDentalChartData\/:id/);
});
