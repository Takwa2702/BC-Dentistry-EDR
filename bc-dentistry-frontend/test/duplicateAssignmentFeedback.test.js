import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('duplicate assignment feedback survives the patient-list refresh', () => {
  const patients = read('src/assets/Pages/Patients.jsx');
  const patientCard = read('src/assets/components/Patients/PatientCard.jsx');

  assert.match(patientCard, /result\?\.message \|\| 'Doctor assigned successfully\.'/);
  assert.match(patientCard, /onChanged\?\.\(\{ \.\.\.result, message \}\)/);
  assert.match(patientCard, /already assigned/);
  assert.match(patients, /if \(result\?\.message\) setNotice\(result\.message\)/);
  assert.match(patients, /loading && patients\.length === 0/);
  assert.match(patients, /Refreshing patient assignments/);
  assert.match(patients, /role="status"[\s\S]*\{notice\}/);
});
