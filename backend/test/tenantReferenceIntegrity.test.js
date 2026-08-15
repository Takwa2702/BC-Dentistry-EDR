'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('fresh database seed contains a complete two-clinic tenant graph', () => {
    const dump = read('database/dump.sql');

    assert.match(dump, /INSERT INTO `Organization`[\s\S]*\(1,'Dental Clinic A'[\s\S]*\(2,'Dental Clinic B'/);
    assert.match(dump, /\(15,'Dental Clinic A','Orthodontist','Doctor1'[\s\S]*,1,'2025-07-17/);
    assert.match(dump, /\(16,'Dental Clinic B','Endodontist','Doctor2'[\s\S]*,2,'2025-06-17/);
    assert.doesNotMatch(dump, /\(1,'Smile Dental Clinic'/);
    assert.match(dump, /'Patient1'[\s\S]*,2,JSON_ARRAY\('Doctor2'\)/);
    assert.match(dump, /'Patient2'[\s\S]*,2,JSON_ARRAY\('Doctor2'\)/);
    assert.match(dump, /'Patient3'[\s\S]*,1,JSON_ARRAY\('Doctor1'\)/);
});

test('canonical schema enforces user, clinic, request, and clinical references', () => {
    const dump = read('database/dump.sql');

    for (const constraint of [
        'fk_admin_organization',
        'fk_doctor_user',
        'fk_doctor_clinic',
        'fk_patient_user',
        'fk_clinical_patient_blockchain',
        'fk_clinical_doctor_blockchain',
        'fk_request_organization',
        'fk_request_data_access',
    ]) {
        assert.match(dump, new RegExp(`ADD CONSTRAINT \`${constraint}\``));
    }
    const mandatoryClinicColumns = dump.match(/`Clinic_ID` int NOT NULL/g) || [];
    assert.ok(mandatoryClinicColumns.length >= 3, 'doctor, patient, and lab-result clinic IDs must be mandatory');
});

test('existing-data migration repairs only known seeds and verifies unknown gaps', () => {
    const migration = read('database/migrations/2026-07-31-tenant-reference-integrity.sql');
    const verification = read('database/verify-tenant-reference-integrity.sql');
    const applyScript = read('scripts/apply-tenant-reference-integrity-migration.sh');

    assert.match(migration, /d\.ID IN \(1, 2, 3, 4, 5\)/);
    assert.match(migration, /d\.Blockchain_ID IS NULL/);
    assert.match(migration, /a\.Appointment_ID IS NULL/);
    assert.match(migration, /p\.ID = 20[\s\S]*Patient-a12b00da-ff7d-4e01-9b1d-386e5df4e087/);
    assert.match(migration, /WHERE ID = 17 AND Blockchain_ID = 'Patient1' AND Clinic_ID IS NULL/);
    assert.match(migration, /WHERE ID = 17 AND Blockchain_ID = 'Patient1' AND Clinic_ID = 2[\s\S]*Doctors IS NULL/);
    assert.match(migration, /CREATE TEMPORARY TABLE Valid_Patient_Doctors/);
    assert.match(migration, /CREATE TEMPORARY TABLE Invalid_Patient_Doctors/);
    assert.match(migration, /JOIN Invalid_Patient_Doctors invalid ON invalid\.Patient_ID = p\.ID/);
    assert.match(migration, /information_schema\.TABLE_CONSTRAINTS/);
    assert.match(migration, /ALTER TABLE Doctor MODIFY Clinic_ID int NOT NULL/);
    assert.match(migration, /2026-07-31-tenant-reference-integrity/);

    for (const issue of [
        'admin_missing_organization',
        'doctor_missing_user',
        'doctor_missing_clinic',
        'patient_missing_user',
        'patient_missing_clinic',
        'patient_invalid_doctor',
        'patient_cross_clinic_doctor',
        'appointment_cross_clinic',
        'clinical_record_missing_patient',
        'clinical_record_missing_doctor',
    ]) {
        assert.match(verification, new RegExp(issue));
    }
    assert.match(applyScript, /Tenant reference verification failed/);
});

test('MySQL, Fabric ledger, and enrollment defaults agree on seed clinic ownership', () => {
    const chaincode = read('fabric-samples/dental-record-sharing/chaincode-javascript/lib/dentalRecordSharing.js');
    const registration = read('dental-backend/registerRoleIdentities.js');
    const reconciliation = read('dental-backend/reconcileFabricIdentities.js');

    const patient1 = chaincode.slice(chaincode.indexOf("patientID: 'Patient1'"), chaincode.indexOf("patientID: 'Patient2'"));
    assert.match(patient1, /clinicID: 2/);
    assert.match(patient1, /clinicIDs: \[2\]/);
    assert.match(patient1, /doctors: \['Doctor2'\]/);
    assert.match(chaincode, /email: 'doctor1@example\.com'/);
    assert.match(chaincode, /licenseNumber: 'DHA-DOCTOR-0001'/);
    assert.match(registration, /FABRIC_DOCTOR_CLINICS', 'Doctor1:1,Doctor2:2'/);
    assert.match(registration, /FABRIC_PATIENT_CLINICS', 'Patient1:2,Patient2:2,Patient3:1'/);
    assert.match(reconciliation, /Refusing Fabric reconciliation[\s\S]*without a clinic assignment/);
    assert.match(reconciliation, /UpdatePatientMetadata/);
    assert.match(reconciliation, /UpdateDoctorInfo/);
    assert.match(reconciliation, /AddPatientMetadata/);
    assert.match(reconciliation, /patientHash\(patient\)/);
    assert.match(chaincode, /const patient = \{\s*\.\.\.existing,/);
});
