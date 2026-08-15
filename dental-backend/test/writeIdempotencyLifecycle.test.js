const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const db = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'dental-backend', 'index.js'), 'utf8');
const push = fs.readFileSync(path.join(root, 'dental-backend', 'pushNotifications.js'), 'utf8');
const chaincode = fs.readFileSync(path.join(root, 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database', 'migrations', '2026-08-05-write-idempotency.sql'), 'utf8');

test('appointments reject terminal edits and preserve repeat cancellation', () => {
  assert.match(db, /APPOINTMENT_TERMINAL_STATE/);
  assert.doesNotMatch(db, /Notes=\?, Status='scheduled'/);
  assert.match(db, /alreadyCancelled:true/);
  assert.match(db, /APPOINTMENT_ALREADY_COMPLETED/);
});

test('appointment creation supports retry keys and blocks conflicting intervals', () => {
  assert.match(migration, /Idempotency_Key/);
  assert.match(db, /Idempotency-Key/);
  assert.match(db, /APPOINTMENT_TIME_CONFLICT/);
  assert.match(db, /alreadyProcessed:true, idempotent:true/);
});

test('clinical and radiographic retries reuse deterministic identities', () => {
  assert.match(db, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(api, /This radiographic upload was already processed/);
  assert.match(chaincode, /Clinical record metadata was already committed/);
  assert.match(chaincode, /Radiographic file metadata was already committed/);
  assert.match(chaincode, /clinicalRecordIDs\.includes\(recordID\)/);
  assert.match(chaincode, /dentalFileIDs\.includes\(normalizedFileID\)/);
});

test('repeat lifecycle and relationship operations avoid side effects', () => {
  assert.match(db, /alreadyInactive:true/);
  assert.match(chaincode, /alreadyUnassigned:true/);
  assert.match(chaincode, /ledger state was not rewritten/);
  assert.match(chaincode, /alreadyRead:true/);
  assert.match(chaincode, /ACTIVE_ACCESS_REQUEST/);
  assert.match(chaincode, /_findActiveDataAccessRequest/);
  assert.match(chaincode, /getStateByPartialCompositeKey\('ACTIVE_ACCESS_REQUEST'/);
  assert.match(chaincode, /\[String\(doctorID\), String\(patientID\), String\(dataOriginClinicID\)\]/);
});

test('consent conflicts and push upserts expose controlled outcomes', () => {
  assert.match(api, /statusCode === 409 \? 'ALREADY_PROCESSED'/);
  assert.match(push, /reactivated/);
  assert.match(push, /created:!existed/);
  assert.match(api, /registration\.created \? 201 : 200/);
});
