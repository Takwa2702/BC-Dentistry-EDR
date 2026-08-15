const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

const expectedRoutes = [
    ["app.get(['/getPatientByID/:id', '/readPatient/:id']", "requireRoles('admin', 'doctor', 'patient', 'system')"],
    ["app.post('/addMedicalRecord'", "requireRoles('doctor')"],
    ["app.get('/getDentalChartData/:id'", "requireRoles('admin', 'doctor', 'patient', 'system')"],
    ["app.post(['/requestDataAccess', '/requestAccess']", "requireRoles('doctor')"],
    ["app.get('/referrals'", "requireRoles('doctor')"],
    ["app.post('/referrals/:requestID/complete'", "requireRoles('doctor')"],
    ["app.post('/grantConsent'", "requireRoles('patient')"],
    ["app.get('/getPendingRequests'", "requireRoles('patient')"],
    ["app.put('/patient/:id'", "requireRoles('admin')"],
    ["app.delete('/patient/:id'", "requireRoles('admin')"],
    ["app.get('/doctor/:id'", "requireRoles('admin', 'doctor', 'system')"],
    ["app.put('/doctor/:id'", "requireRoles('admin')"],
    ["app.delete('/doctor/:id'", "requireRoles('admin')"],
    ["app.post('/admin/rejectRequest'", "requireRoles('admin')"],
    ["app.post('/patient/rejectRequest'", "requireRoles('patient')"]
];

test('every canonical route is JWT protected and has its expected role gate', () => {
    for (const [route, roleGate] of expectedRoutes) {
        const start = source.indexOf(route);
        assert.notEqual(start, -1, `missing route ${route}`);
        const declaration = source.slice(start, source.indexOf('\n', start));
        assert.match(declaration, /authenticateToken/, `${route} must require JWT`);
        assert.ok(declaration.includes(roleGate), `${route} must include ${roleGate}`);
    }
});

test('identity-bound routes retain self and clinic checks', () => {
    assert.match(source, /\['\/requestDataAccess', '\/requestAccess'\].*requireDoctorSelfBody\('doctorID'\)/);
    assert.match(source, /\/grantConsent'.*requirePatientSelfBody\('patientID'\)/);
    assert.match(source, /\/patient\/rejectRequest'.*requirePatientSelfBody\('patientID'\)/);
    assert.match(source, /\/admin\/rejectRequest'.*requireAdminClinicBody\('adminClinicID'\)/);
    assert.match(source, /\/getPendingRequests'.*[\s\S]*req\.user\.blockchainID/);
});

test('canonical API responses use the normalized success/error envelopes', () => {
    assert.match(source, /success: true,[\s\S]*data/);
    assert.match(source, /success: false,[\s\S]*error: \{[\s\S]*code,[\s\S]*message/);
    assert.match(source, /access denied\|not authorized\|forbidden/,
        'Fabric authorization failures must map to HTTP 403');
});

test('blockchain API starts its HTTP listener', () => {
    assert.match(source, /const PORT = process\.env\.PORT \|\| 8081;/);
    assert.match(source, /app\.listen\(PORT, '0\.0\.0\.0'/);
});
