'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const server = read('backend/server.js');
const blockchain = read('dental-backend/index.js');
const enrollment = read('dental-backend/fabricEnrollment.js');
const reconcile = read('dental-backend/reconcileFabricIdentities.js');
const chaincode = read('fabric-samples/dental-record-sharing/chaincode-javascript/lib/dentalRecordSharing.js');
const migration = read('database/migrations/2026-08-03-entity-lifecycle-hardening.sql');
const historyMigration = read('database/migrations/2026-08-04-preserve-clinical-history.sql');

test('cross-store lifecycle operations are durable and observable', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS Entity_Lifecycle_Operation/);
  assert.match(server, /beginLifecycleOperation/);
  assert.match(server, /FABRIC_COMMITTED/);
  assert.match(server, /app\.get\('\/lifecycle-operations'.*requireRoles\('system'\)/);
});

test('patient profile updates cannot mutate identity, tenant, assignments, or credentials', () => {
  const route = server.match(/app\.put\('\/patients\/:id'[\s\S]*?\n\}\);/)[0];
  for (const code of ['PATIENT_ID_MISMATCH', 'PATIENT_CLINIC_IMMUTABLE', 'PATIENT_PROTECTED_FIELD']) assert.match(route, new RegExp(code));
  assert.match(route, /mutablePatientProfile/);
  assert.doesNotMatch(route, /Clinic_ID=\?, Doctors=\?/);
});

test('patient creation derives clinic ownership from the authenticated admin', () => {
  const route = server.match(/app\.post\('\/patients'[\s\S]*?\n\}\);/)[0];
  assert.match(server, /app\.get\('\/clinic\/me'.*requireRoles\('admin'\)/);
  assert.match(route, /const clinicID = Number\(req\.user\.organizationId\)/);
  assert.match(route, /const createBody = \{ \.\.\.req\.body, clinicID \}/);
  assert.match(route, /Every assigned doctor must be active and belong to the patient clinic/);
  assert.doesNotMatch(route, /Number\(req\.body\.clinicID\)/);
});

test('actor retirement is coordinated and preserves ledger history', () => {
  assert.match(enrollment, /const retireIdentity/);
  assert.match(enrollment, /ca\.revoke/);
  assert.match(enrollment, /wallet\.remove/);
  assert.match(blockchain, /app\.delete\('\/internal\/identities'/);
  assert.match(chaincode, /async DeactivateDoctor/);
  assert.match(chaincode, /async DeactivatePatient/);
  assert.match(chaincode, /async DeleteDoctor[\s\S]*HARD_DELETE_FORBIDDEN:[\s\S]*must be deactivated/);
  assert.match(chaincode, /async DeletePatient[\s\S]*HARD_DELETE_FORBIDDEN:[\s\S]*must be deactivated/);
  assert.doesNotMatch(chaincode.slice(chaincode.indexOf('async DeleteDoctor'), chaincode.indexOf('// GetAllDoctors')), /deleteState/);
  assert.match(server, /DOCTOR_DEACTIVATE/);
  assert.match(server, /PATIENT_DEACTIVATE/);
});

test('reconciliation covers active clinic admins and missing doctor ledger actors', () => {
  assert.match(reconcile, /Admin\.Organization_ID AS clinicID/);
  assert.match(reconcile, /actorID: `AdminClinic\$\{row\.clinicID\}`/);
  assert.match(reconcile, /submitReconciliationTransaction\(\s*'addDoctor'/);
  assert.match(reconcile, /submitWithMvccRetry/);
  assert.match(reconcile, /User\.IsActive=1 AND Organization\.IsActive=1/);
});

test('certificates renew before expiry and expired identities fail closed', () => {
  assert.match(enrollment, /FABRIC_IDENTITY_RENEWAL_DAYS/);
  assert.match(enrollment, /ca\.reenroll/);
  assert.match(enrollment, /expired and requires registrar recovery/);
});

test('bounded validation rejects abusive profile, password, appointment, and clinical payloads', () => {
  for (const code of ['EMAIL_TOO_LONG', 'INVALID_CONTACT_NUMBER', 'INVALID_EMIRATES_ID', 'DOCTOR_LICENSE_TOO_LONG', 'PATIENT_LIST_ITEM_TOO_LONG', 'CLINICAL_PAYLOAD_TOO_LARGE', 'APPOINTMENT_REASON_TOO_LONG']) {
    assert.match(server, new RegExp(code));
  }
  assert.match(server, /Buffer\.byteLength\(password, 'utf8'\) <= 72/);
  assert.match(server, /validateBoundedJson\(normalized, 'Clinical payload'\)/);
});

test('database and ledger clinic lifecycle preserve clinical history while revoking active state', () => {
  assert.doesNotMatch(historyMigration, /ON DELETE CASCADE/);
  assert.match(historyMigration, /ON DELETE RESTRICT/g);
  assert.match(blockchain, /internal\/clinics\/:clinicID\/deactivate/);
  assert.match(chaincode, /async DeactivateClinicActors/);
  assert.match(chaincode, /CONSENT_REVOKED/);
});
