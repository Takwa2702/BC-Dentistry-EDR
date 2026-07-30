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
  assert.match(databaseApi, /WHERE Doctor\.Clinic_ID=\?/);
  assert.match(databaseApi, /DOCTOR_OWNER_MISMATCH/);
  assert.match(databaseApi, /requireAdminClinic\(req, rows\[0\]\.Clinic_ID\)/);
});
