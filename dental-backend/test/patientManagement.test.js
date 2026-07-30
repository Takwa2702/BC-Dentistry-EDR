const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const dbApi = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'server.js'), 'utf8');
const chaincode = fs.readFileSync(path.join(__dirname, '..', '..', 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');

test('Database API exposes admin patient CRUD and assignment routes', () => {
    for (const route of ["app.post('/patients'", "app.get('/patients'", "app.get('/patients/:id'", "app.put('/patients/:id'", "app.post('/patients/:id/assign'", "app.delete('/patients/:id'"]) {
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

test('delete removes both Patient subtype and User identity rows', () => {
    const route = dbApi.match(/app\.delete\('\/patients\/:id'[\s\S]*?\n\}\);/);
    assert.ok(route);
    assert.match(route[0], /DELETE FROM Patient WHERE ID=\?/);
    assert.match(route[0], /DELETE FROM User WHERE ID=\?/);
    assert.ok(route[0].indexOf('DELETE FROM Patient WHERE ID=?') < route[0].indexOf('DELETE FROM User WHERE ID=?'));
});
