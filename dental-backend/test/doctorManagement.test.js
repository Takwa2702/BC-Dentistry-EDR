const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');
const databaseApi = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'server.js'), 'utf8');
const chaincode = fs.readFileSync(path.resolve(__dirname, '..', '..', 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');

test('doctor management payload includes license and coordinated database/Fabric CRUD', () => {
  assert.match(databaseApi, /app\.post\('\/doctors'/);
  assert.doesNotMatch(databaseApi, /registerDoctorLegacy|\/registerDoctor'/);
  assert.match(databaseApi, /License_Number/);
  assert.match(databaseApi, /callBlockchain\(req, '\/addDoctor'/);
  assert.match(databaseApi, /app\.put\('\/doctors\/:id'/);
  assert.match(databaseApi, /app\.delete\('\/doctors\/:id'/);
  assert.match(api, /'licenseNumber'/);
  assert.match(chaincode, /licenseNumber: licenseNumber/);
});

test('assigned-patient self route derives doctor identity only from verified JWT', () => {
  const selfRoute = api.match(/app\.get\('\/doctor\/me\/assigned-patients'[\s\S]*?\n\}\);/);
  assert.ok(selfRoute);
  assert.match(selfRoute[0], /req\.user\.blockchainID/);
  assert.doesNotMatch(selfRoute[0], /req\.params|req\.body/);
  assert.match(chaincode, /getPatientsAssignedToDoctor[\s\S]*?_requireActor\(ctx, doctorID, 'doctor'\)/);
});

test('database doctor reads and writes enforce clinic or self scope', () => {
  assert.match(databaseApi, /Doctor\.Clinic_ID=\?/);
  assert.match(databaseApi, /DOCTOR_OWNER_MISMATCH/);
  assert.match(databaseApi, /requireAdminClinic\(req, rows\[0\]\.Clinic_ID\)/);
});

test('doctor update rejects an immutable ID mismatch before changing either store', () => {
  const databaseRoute = databaseApi.match(/app\.put\('\/doctors\/:id'[\s\S]*?\n\}\);/)[0];
  const fabricRoute = api.match(/app\.put\('\/doctor\/:id'[\s\S]*?\n\}\);/)[0];
  for (const route of [databaseRoute, fabricRoute]) {
    assert.match(route, /req\.body\.doctorID !== undefined/);
    assert.match(route, /DOCTOR_ID_MISMATCH/);
    assert.match(route, /doctorID is immutable and must match the URL/);
  }
  assert.ok(databaseRoute.indexOf('DOCTOR_ID_MISMATCH') < databaseRoute.indexOf('beginTransaction'));
  assert.ok(fabricRoute.indexOf('DOCTOR_ID_MISMATCH') < fabricRoute.indexOf('UpdateDoctorInfo'));
});

test('blockchain API rejects an unknown doctor before submitting an update', () => {
  const route = api.match(/app\.put\('\/doctor\/:id'[\s\S]*?\n\}\);/)[0];
  assert.match(route, /evaluateTransaction\('ReadDoctor', String\(req\.params\.id\)\)/);
  assert.match(route, /DOCTOR_NOT_FOUND/);
  assert.match(route, /existingDoctor\.doctorID/);
  assert.match(route, /DOCTOR_CLINIC_MISMATCH/);
  assert.ok(route.indexOf("evaluateTransaction('ReadDoctor'") < route.indexOf("submitTransaction(\n                'UpdateDoctorInfo'"));
});

test('doctor profile update prevents mass assignment and tenant or relationship tampering', () => {
  const databaseRoute = databaseApi.match(/app\.put\('\/doctors\/:id'[\s\S]*?\n\}\);/)[0];
  const fabricRoute = api.match(/app\.put\('\/doctor\/:id'[\s\S]*?\n\}\);/)[0];
  assert.match(databaseApi, /const mutableDoctorProfile = \(body\) =>/);
  assert.match(databaseRoute, /DOCTOR_CLINIC_IMMUTABLE/);
  assert.match(databaseRoute, /DOCTOR_PROTECTED_FIELD/);
  assert.match(databaseRoute, /const update = mutableDoctorProfile\(req\.body\)/);
  assert.doesNotMatch(databaseRoute, /\{ \.\.\.req\.body, clinicID/);
  assert.match(fabricRoute, /req\.body\.patients !== undefined/);
  assert.match(fabricRoute, /DOCTOR_PROTECTED_FIELD/);
});

test('chaincode preserves doctor identity, tenant, creation metadata, and assignments', () => {
  const update = chaincode.match(/async UpdateDoctorInfo\([\s\S]*?\n    \}/)[0];
  assert.match(update, /existingDoctor = JSON\.parse/);
  assert.match(update, /_requireAdminClinic\(ctx, existingDoctor\.clinicID\)/);
  for (const field of ['doctorID', 'clinicID', 'role', 'createdDate', 'docType']) {
    assert.match(update, new RegExp(`${field}: existingDoctor\\.${field}`));
  }
  assert.match(update, /patients: Array\.isArray\(existingDoctor\.patients\) \? existingDoctor\.patients : \[\]/);
});

test('doctor deactivation requires same-clinic reassignment or cancels only when no replacement remains', () => {
  assert.match(databaseApi, /app\.get\('\/doctors\/:id\/deactivation-impact'/);
  const route = databaseApi.match(/app\.delete\('\/doctors\/:id'[\s\S]*?\n\}\);/)[0];
  assert.match(route, /DOCTOR_REASSIGNMENT_REQUIRED/);
  assert.match(route, /INVALID_REPLACEMENT_DOCTOR/);
  assert.match(route, /unassignPatientFromDoctor/);
  assert.match(route, /assignPatientToDoctor/);
  assert.match(route, /appointmentsAffected/);
  assert.match(route, /Push_Subscription SET Active=0/);
});
