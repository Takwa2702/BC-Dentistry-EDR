const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'migrations', '2026-07-30-scoped-lab-results.sql'), 'utf8');

test('lab result schema is patient, clinic, doctor, and correction scoped', () => {
  for (const field of ['Patient_Blockchain_ID', 'Clinic_ID', 'Ordering_Doctor_ID', 'Result_Data', 'Data_Hash', 'Corrected_From_ID']) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /FOREIGN KEY \(Patient_Blockchain_ID\)/);
  assert.match(migration, /FOREIGN KEY \(Clinic_ID\)/);
});

test('lab reads derive patient identity and expose metadata-only admin projections', () => {
  assert.match(server, /req\.user\.blockchainID/);
  assert.match(server, /labOperationalMetadata/);
  assert.match(server, /role === 'admin' \? labOperationalMetadata : labClinicalResult/);
  assert.match(server, /clinical-records\/\$\{encodeURIComponent\(patientID\)\}/);
  assert.match(server, /app\.get\(\['\/lab-results', '\/Lab_Results'\]/);
  assert.match(server, /LAB_METADATA_VIEWED/);
});
