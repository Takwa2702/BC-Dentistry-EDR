const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('doctor management and appointment options share the clinic-safe legacy doctor scope', () => {
  assert.match(server, /const CLINIC_DOCTOR_SCOPE = `\(Doctor\.Clinic_ID=\? OR \(Doctor\.Clinic_ID IS NULL AND EXISTS/);
  assert.match(server, /Patient\.Clinic_ID=\? AND JSON_CONTAINS\(Patient\.Doctors, JSON_QUOTE\(Doctor\.Blockchain_ID\)\)/);

  const scopeUses = server.match(/WHERE \$\{CLINIC_DOCTOR_SCOPE\}/g) || [];
  assert.equal(scopeUses.length, 2, 'doctor list and appointment options must use the same clinic scope');
});
