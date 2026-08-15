'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { identityDefinition } = require('../fabricEnrollment');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('generated doctor and patient accounts map to actor-bound Fabric identities', () => {
    const doctorID = 'Doctor-11111111-1111-4111-8111-111111111111';
    const patientID = 'Patient-22222222-2222-4222-8222-222222222222';
    assert.deepEqual(identityDefinition({ role: 'doctor', actorID: doctorID, clinicID: 7 }), {
        label: `doctor-${doctorID}`, role: 'doctor', actorID: doctorID, clinicID: '7',
    });
    assert.deepEqual(identityDefinition({ role: 'patient', actorID: patientID, clinicID: 7 }), {
        label: `patient-${patientID}`, role: 'patient', actorID: patientID, clinicID: '7',
    });
    assert.throws(() => identityDefinition({ role: 'doctor', actorID: patientID, clinicID: 7 }), /prefix/);
    assert.equal(identityDefinition({ role: 'doctor', actorID: 'Doctor1', clinicID: 7 }).label, 'doctor-Doctor1');
    assert.deepEqual(identityDefinition({ role: 'admin', actorID: 'AdminClinic7', clinicID: 7 }), {
        label: 'admin-7', role: 'admin', actorID: 'AdminClinic7', clinicID: '7',
    });
    assert.throws(() => identityDefinition({ role: 'admin', actorID: 'AdminClinic2', clinicID: 7 }), /match its clinic/);
});

test('missing clinic admin identity is enrolled on first Fabric transaction', () => {
    const api = read('dental-backend/index.js');
    const withContract = api.match(/const withContract = async[\s\S]*?\n};/)[0];
    assert.match(withContract, /isRole\(req, 'admin'\)/);
    assert.match(withContract, /actorID: `AdminClinic\$\{req\.user\.organizationId\}`/);
    assert.match(withContract, /await enrollIdentity/);
});

test('container startup reconciles identities for accounts created before this fix', () => {
    const dockerfile = read('dental-backend/Dockerfile');
    const reconcile = read('dental-backend/reconcileFabricIdentities.js');
    assert.match(dockerfile, /node reconcileFabricIdentities\.js/);
    assert.match(reconcile, /FROM Doctor JOIN User ON User\.ID=Doctor\.ID/);
    assert.match(reconcile, /FROM Admin JOIN User ON User\.ID=Admin\.User_ID/);
    assert.match(reconcile, /FROM Patient[\s\S]*JOIN User ON User\.ID = Patient\.ID[\s\S]*WHERE Patient\.Blockchain_ID IS NOT NULL/);
    assert.match(reconcile, /enrollIdentity/);
    assert.match(reconcile, /submitReconciliationTransaction\(\s*'assignPatientToDoctor'/);
    assert.match(reconcile, /submitWithMvccRetry/);
    assert.match(reconcile, /doctorBlockchainIDByDatabaseID/);
    assert.match(reconcile, /skippedAssignments/);
    assert.match(reconcile, /unknown legacy relationship/);
    assert.match(reconcile, /failedAssignments/);
    assert.match(reconcile, /could not replay/);
    assert.match(reconcile, /'addDoctor'/);
});

test('account creation provisions Fabric identity before ledger actor creation', () => {
    const api = read('backend/server.js');
    const doctorRoute = api.match(/app\.post\('\/doctors'[\s\S]*?\n\}\);/)[0];
    const patientRoute = api.match(/app\.post\('\/patients'[\s\S]*?\n\}\);/)[0];
    assert.ok(doctorRoute.indexOf("provisionFabricIdentity(req, 'doctor'") < doctorRoute.indexOf("callBlockchain(req, '/addDoctor'"));
    assert.ok(patientRoute.indexOf("provisionFabricIdentity(req, 'patient'") < patientRoute.indexOf("callBlockchain(req, '/patient-metadata'"));
});

test('patient assignment validates clinic and updates both ledger relationship directions', () => {
    const api = read('backend/server.js');
    const chaincode = read('fabric-samples/dental-record-sharing/chaincode-javascript/lib/dentalRecordSharing.js');
    const assignment = api.match(/app\.post\('\/patients\/:id\/assign'[\s\S]*?\n\}\);/)[0];
    assert.match(assignment, /SELECT Doctor\.Blockchain_ID, Doctor\.Clinic_ID FROM Doctor/);
    assert.match(assignment, /Doctor and patient must belong to the same clinic/);
    assert.match(assignment, /callBlockchain\(req, '\/assignPatientToDoctor'/);
    assert.match(chaincode, /doctor\.patients\.push\(patientID\)/);
    assert.match(chaincode, /patient\.doctors\.push\(doctorID\)/);
    assert.match(chaincode, /patient\.dataHash = dataHash\.toLowerCase\(\)/);
    assert.match(assignment, /\/patient-metadata\/\$\{encodeURIComponent\(req\.params\.id\)\}/);
    assert.match(chaincode, /assignPatientToDoctor\(ctx, patientID, doctorID, dataHash, modifiedDate\)/);
    assert.match(api, /app\.post\('\/patients\/:id\/unassign'/);
    assert.match(chaincode, /unassignPatientFromDoctor\(ctx, patientID, doctorID, dataHash, modifiedDate\)/);
});
