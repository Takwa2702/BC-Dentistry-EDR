const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const dbApi = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'server.js'), 'utf8');
const chaincode = fs.readFileSync(path.join(__dirname, '..', '..', 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');
const patientDialog = fs.readFileSync(path.join(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Patients', 'NewPatientDialog.jsx'), 'utf8');

test('Database API exposes admin patient CRUD and assignment routes', () => {
    for (const route of ["app.post('/patients'", "app.get('/patients'", "app.get('/patients/:id'", "app.put('/patients/:id'", "app.post('/patients/:id/assign'", "app.post('/patients/:id/unassign'", "app.delete('/patients/:id'"]) {
        assert.ok(dbApi.includes(route), `missing ${route}`);
    }
    assert.match(dbApi, /requireRoles\('admin'\)/);
    assert.match(dbApi, /crypto\.randomUUID\(\)/);
});

test('hybrid storage hashes PII and sends metadata-only transactions', () => {
    assert.match(dbApi, /createHash\('sha256'\)/);
    assert.match(api, /'AddPatientMetadata'/);
    assert.match(api, /'UpdatePatientMetadata'/);
    assert.match(chaincode, /storagePolicy: 'PII_OFF_CHAIN_MYSQL'/);
    const metadataMethod = chaincode.slice(chaincode.indexOf('async AddPatientMetadata'), chaincode.indexOf('async UpdatePatientMetadata'));
    for (const pii of ['firstName', 'emiratesID', 'contactNumber', 'medicalHistory', 'insuranceDetails']) {
        assert.equal(metadataMethod.includes(pii), false, `${pii} must not be written by AddPatientMetadata`);
    }
});

test('patient owner and admin clinic controls remain present', () => {
    assert.match(dbApi, /PATIENT_OWNER_MISMATCH/);
    assert.match(dbApi, /requireAdminClinic\(req,/);
    assert.match(api, /requireAdminClinicBody\('clinicID'\)/);
});

test('delete route deactivates the patient, preserves history, and retires its Fabric identity', () => {
    const route = dbApi.match(/app\.delete\('\/patients\/:id'[\s\S]*?\n\}\);/);
    assert.ok(route);
    assert.match(route[0], /UPDATE User SET IsActive=0/);
    assert.match(route[0], /retireFabricIdentity\(req, 'patient'/);
  assert.match(route[0], /UPDATE Patient SET Doctors=JSON_ARRAY\(\)/);
  assert.match(route[0], /UPDATE Appointment SET Status='cancelled'/);
  assert.match(route[0], /NOT IN \('cancelled','canceled','completed','complete','done','finished'\)/);
  assert.match(route[0], /clinicalRecordsPreserved/);
  assert.match(route[0], /labResultsPreserved/);
  assert.doesNotMatch(route[0], /DELETE FROM Patient|DELETE FROM User/);
});

test('patient deactivation impact is clinic scoped and reports preserved dependencies', () => {
    const route = dbApi.match(/app\.get\('\/patients\/:id\/deactivation-impact'[\s\S]*?\n\}\);/);
    assert.ok(route);
    assert.match(route[0], /requireRoles\('admin'\)/);
    assert.match(route[0], /requireAdminClinic\(req,/);
    assert.match(route[0], /activeToCancel/);
    assert.match(route[0], /clinicalRecordsToPreserve/);
    assert.match(route[0], /labResultsToPreserve/);
});

test('patient names preserve valid punctuation and reject values above 100 characters before persistence', () => {
    assert.match(dbApi, /PATIENT_NAME_TOO_LONG/);
    assert.match(dbApi, /requireTextLimit\(body\[field\].*100, code\)/);
    assert.match(api, /requireLegacyProfileBounds\(req\.body, 'patient'\)/);
    assert.match(api, /code: error\.code \|\|/);
    assert.ok(api.indexOf('requireValidPatientNames(req.body)') < api.indexOf("contract.submitTransaction(\n            'UpdatePatientInfo'"));
    assert.doesNotMatch(dbApi, /replace\([^\n]+['"]-['"]|replace\([^\n]+['"]\\'['"]/);
});

test('identity and profile validation is enforced before legacy Fabric updates', () => {
    assert.match(api, /requireLegacyProfileBounds\(req\.body, 'doctor'\)/);
    for (const code of ['INVALID_EMAIL', 'INVALID_CONTACT_NUMBER', 'INVALID_EMIRATES_ID']) assert.match(api, new RegExp(code));
});

test('duplicate patient assignment is explicitly idempotent across database and ledger', () => {
    const route = dbApi.match(/app\.post\('\/patients\/:id\/assign'[\s\S]*?\n\}\);/)[0];
    assert.match(route, /alreadyAssigned: true, idempotent: true/);
    assert.match(route, /no duplicate was created/);
    assert.ok(route.indexOf('alreadyAssigned: true') < route.indexOf("beginLifecycleOperation(req, 'PATIENT_ASSIGN'"));
    const assignment = chaincode.match(/async assignPatientToDoctor[\s\S]*?\n    \}/)[0];
    assert.match(assignment, /doctor\.patients\.includes\(patientID\) && patient\.doctors\.includes\(doctorID\)/);
    assert.match(assignment, /alreadyAssigned: true/);
    assert.match(assignment, /idempotent: true/);
});

test('multi-step patient form preserves one controlled state and submits the complete payload', () => {
    assert.match(patientDialog, /const \[form,setForm\] = useState/);
    assert.match(patientDialog, /const \[step,setStep\] = useState\(0\)/);
    assert.match(patientDialog, /Profile information.*Clinical information.*Insurance and review/);
    assert.match(patientDialog, /setStep\(value => Math\.min\(value\+1,steps\.length-1\)\)/);
    assert.match(patientDialog, /setStep\(value=>value-1\)/);
    assert.match(patientDialog, /data-patient-step/);
    assert.match(patientDialog, /const payload=\{\.\.\.form/);
    assert.match(patientDialog, /insuranceDetails:\{provider:form\.insuranceProvider,policyNumber:form\.policyNumber,coverageType:form\.coverageType\}/);
    assert.doesNotMatch(patientDialog, /setForm\(empty\)/);
});
