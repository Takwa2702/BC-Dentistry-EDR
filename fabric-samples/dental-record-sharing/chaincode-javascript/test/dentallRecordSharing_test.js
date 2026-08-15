'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const DentalRecordSharing = require('../lib/dentalRecordSharing');

const identity = (role, actorID = `${role}1`, mspID = 'Org1MSP', clinicID = null) => ({
    getMSPID: sinon.stub().returns(mspID),
    getAttributeValue: sinon.stub().callsFake((name) => ({ role, actorID, clinicID }[name])),
});

const context = (role, actorID, mspID = 'Org1MSP', clinicID = null) => ({
    clientIdentity: identity(role, actorID, mspID, clinicID),
    stub: {
        getState: sinon.stub().resolves(Buffer.alloc(0)),
        putState: sinon.stub().resolves(),
        setEvent: sinon.stub().resolves(),
        deleteState: sinon.stub().resolves(),
        createCompositeKey: sinon.stub().callsFake((type, attributes) => `${type}:${attributes.join(':')}`),
        getTxID: sinon.stub().returns('tx-1'),
        getTxTimestamp: sinon.stub().returns({ seconds: { toString: () => '1783872000' }, nanos: 0 }),
        getStateByRange: sinon.stub().resolves({ next: sinon.stub().resolves({ done: true }), close: sinon.stub().resolves() }),
        getStateByRangeWithPagination: sinon.stub().resolves({ iterator: { next: sinon.stub().resolves({ done: true }), close: sinon.stub().resolves() }, metadata: { fetchedRecordsCount: 0, bookmark: '' } }),
        getStateByPartialCompositeKey: sinon.stub().resolves({ next: sinon.stub().resolves({ done: true }), close: sinon.stub().resolves() }),
        getStateByPartialCompositeKeyWithPagination: sinon.stub().resolves({ iterator: { next: sinon.stub().resolves({ done: true }), close: sinon.stub().resolves() }, metadata: { fetchedRecordsCount: 0, bookmark: '' } }),
    },
});

const expectReject = async (promise, message) => {
    try {
        await promise;
        expect.fail('Expected transaction to be rejected');
    } catch (error) {
        expect(error.message).to.include(message);
    }
};

describe('Phase 2 chaincode identity enforcement', () => {
    let contract;

    beforeEach(() => {
        contract = new DentalRecordSharing();
    });

    it('allows an admin certificate to add a doctor', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');
        const result = await contract.addDoctor(
            ctx, 'Doctor9', 'Ada', 'Lovelace', 'EID9', 'Dentist', 'Clinic A', '1',
            'ada@example.com', '0500000000', '2026-07-10', '[]'
        );
        expect(JSON.parse(result).doctorID).to.equal('Doctor9');
    });

    it('rejects duplicate doctor IDs before overwriting ledger state', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');
        ctx.stub.getState.callsFake(async (key) => key === 'Doctor9'
            ? Buffer.from(JSON.stringify({ doctorID: 'Doctor9', emiratesID: 'EID-OLD' }))
            : Buffer.alloc(0));
        await expectReject(contract.addDoctor(
            ctx, 'Doctor9', 'Ada', 'Lovelace', 'EID-NEW', 'Dentist', 'Clinic A', '1',
            'ada@example.com', '0500000000', 'LIC-9', '2026-07-10', '[]'
        ), 'The doctor Doctor9 already exists');
        expect(ctx.stub.putState.called).to.equal(false);
    });

    it('rejects duplicate patient IDs before overwriting ledger state', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');
        ctx.stub.getState.callsFake(async (key) => key === 'Patient9'
            ? Buffer.from(JSON.stringify({ patientID: 'Patient9', emiratesID: 'EID-OLD' }))
            : Buffer.alloc(0));
        await expectReject(contract.addPatient(
            ctx, 'Patient9', 'Pat', 'Nine', '1990-01-01', 'Other', 'EID-NEW',
            'pat9@example.com', '0500000001', 'Dubai', '2026-07-10', '1', '[]'
        ), 'The patient Patient9 already exists');
        expect(ctx.stub.putState.called).to.equal(false);
    });

    it('rejects an Emirates ID reserved by another actor', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');
        ctx.stub.getState.callsFake(async (key) => key === 'UNIQUE_EMIRATES_ID:EID-SHARED'
            ? Buffer.from(JSON.stringify({ actorID: 'PatientExisting' }))
            : Buffer.alloc(0));
        await expectReject(contract.addPatient(
            ctx, 'Patient10', 'Pat', 'Ten', '1990-01-01', 'Other', 'eid-shared',
            'pat10@example.com', '0500000010', 'Dubai', '2026-07-10', '1', '[]'
        ), 'The patient with eID eid-shared already exists');
        expect(ctx.stub.putState.called).to.equal(false);
    });

    it('rejects a doctor certificate on an admin patient-management path', async () => {
        const ctx = context('doctor', 'Doctor1');
        await expectReject(contract.addPatient(
            ctx, 'Patient9', 'Pat', 'Nine', '1990-01-01', 'Other', 'EID-P9',
            'pat9@example.com', '0500000001', 'Dubai', '2026-07-10', '1', '[]'
        ), 'Access denied: requires admin role.');
    });

    it('rejects an admin certificate for another clinic', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');
        await expectReject(contract.addDoctor(
            ctx, 'Doctor9', 'Ada', 'Lovelace', 'EID9', 'Dentist', 'Clinic B', '2',
            'ada@example.com', '0500000000', '2026-07-11', '[]'
        ), 'admin certificate is not authorized for clinic 2');
    });

    it('rejects an admin reading another clinic request queue', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');
        await expectReject(
            contract.GetRequestsForAdmin(ctx, '2'),
            'admin certificate is not authorized for clinic 2'
        );
    });

    it('declares and accepts all admin queue pagination arguments', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');

        expect(contract.GetRequestsForAdminPage.length).to.equal(4);
        const result = JSON.parse(await contract.GetRequestsForAdminPage(ctx, '1', '25', 'next-page'));

        expect(result).to.deep.equal({ records: [], bookmark: '', fetchedRecordsCount: 0 });
        expect(ctx.stub.getStateByPartialCompositeKeyWithPagination.calledOnce).to.equal(true);
        expect(ctx.stub.getStateByPartialCompositeKeyWithPagination.firstCall.args.slice(0, 4)).to.deep.equal([
            'EDR_ACCESS_ADMIN', ['1'], 25, 'next-page'
        ]);
    });

    it('declares every public paginated query with explicit Fabric arguments', () => {
        for (const transaction of [
            'GetPatientsByClinicPage', 'GetRequestsForAdminPage',
            'GetPendingRequestsForPatientPage', 'GetProcessedRequestsForPatientPage',
            'GetAllRequestsForPatientPage', 'GetRequestsForDoctorPage',
        ]) {
            expect(contract[transaction].length, transaction).to.equal(4);
        }
        for (const transaction of ['GetAllDoctorsPage', 'GetAllPatientsPage']) {
            expect(contract[transaction].length, transaction).to.equal(3);
        }
    });

    it('accepts all patient queue pagination arguments used by the mobile API', async () => {
        const ctx = context('patient', 'PatientMobile');
        const result = JSON.parse(await contract.GetAllRequestsForPatientPage(
            ctx, 'PatientMobile', '25', 'mobile-next-page'
        ));

        expect(result).to.deep.equal({ records: [], bookmark: '', fetchedRecordsCount: 0 });
        expect(ctx.stub.getStateByPartialCompositeKeyWithPagination.firstCall.args.slice(0, 4)).to.deep.equal([
            'EDR_ACCESS_PATIENT', ['PatientMobile'], 25, 'mobile-next-page'
        ]);
    });

    it('rejects a doctor enumerating all patients', async () => {
        const ctx = context('doctor', 'Doctor1');
        await expectReject(
            contract.GetAllPatients(ctx),
            'Access denied: requires admin or system role'
        );
    });

    it('rejects non-system ledger initialization', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');
        await expectReject(contract.InitLedger(ctx), 'requires system role');
    });

    it('rejects a doctor calling the public actor-existence helper', async () => {
        const ctx = context('doctor', 'Doctor1');
        await expectReject(contract.actorExists(ctx, 'Patient1'), 'requires admin or system role');
    });

    it('rejects a doctor certificate that requests data as another doctor', async () => {
        const ctx = context('doctor', 'Doctor1');
        await expectReject(
            contract.RequestDataAccess(ctx, 'Doctor2', 'Patient1', '1'),
            'certificate actorID does not match Doctor2'
        );
    });

    it('rejects a patient certificate that reads another patient request queue', async () => {
        const ctx = context('patient', 'Patient1');
        await expectReject(
            contract.GetAllRequestsForPatient(ctx, 'Patient2'),
            'certificate actorID does not match Patient2'
        );
    });

    it('creates a cross-clinic access request without changing patient ownership', async () => {
        const ctx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        const doctor = { doctorID: 'Doctor1', firstName: 'Alice', lastName: 'Wong', clinicID: 1, worksAt: 'Clinic 1' };
        const patient = { patientID: 'Patient1', clinicID: 2, clinicIDs: [2], doctors: ['Doctor2'], sharedWith: [] };
        ctx.stub.getState.callsFake(async (key) => {
            if (key === 'Doctor1') return Buffer.from(JSON.stringify(doctor));
            if (key === 'Patient1') return Buffer.from(JSON.stringify(patient));
            return Buffer.alloc(0);
        });
        const requestID = await contract.RequestDataAccess(ctx, 'Doctor1', 'Patient1', '2', 'Medical Records', 'Specialist review', '{}');
        expect(requestID).to.equal('tx-1');
        const requestWrite = ctx.stub.putState.getCalls().find((call) => call.args[0] === 'tx-1');
        const request = JSON.parse(requestWrite.args[1].toString());
        expect(request.status).to.equal('PENDING_ADMIN_APPROVAL');
        expect(request.workflowType).to.equal('REFERRAL');
        expect(request.dataOriginClinicID).to.equal(2);
        expect(request.requestingClinicID).to.equal(1);
        expect(patient.clinicID).to.equal(2);
        expect(ctx.stub.setEvent.calledWith('AccessRequestCreated')).to.equal(true);
    });

    it('rejects a request for a clinic where the patient has no data without writing ledger state', async () => {
        const ctx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        const doctor = { doctorID:'Doctor1', firstName:'Alice', lastName:'Wong', clinicID:1, worksAt:'Clinic 1' };
        const patient = { patientID:'Patient1', clinicID:2, clinicIDs:[2], doctors:['Doctor2'], sharedWith:[] };
        ctx.stub.getState.callsFake(async (key) => {
            if (key === 'Doctor1') return Buffer.from(JSON.stringify(doctor));
            if (key === 'Patient1') return Buffer.from(JSON.stringify(patient));
            return Buffer.alloc(0);
        });
        await expectReject(
            contract.RequestDataAccess(ctx, 'Doctor1', 'Patient1', '999', 'Medical Records', 'Negative test', '{}'),
            'Patient Patient1 does not have data in Clinic 999'
        );
        expect(ctx.stub.putState.called).to.equal(false);
        expect(ctx.stub.setEvent.called).to.equal(false);
    });

    it('reuses one active referral across record scopes for the same care relationship', async () => {
        const ctx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        const doctor = { doctorID: 'Doctor1', firstName: 'Alice', lastName: 'Wong', clinicID: 1, worksAt: 'Clinic 1' };
        const patient = { patientID: 'Patient1', clinicID: 2, clinicIDs: [2], doctors: ['Doctor2'], sharedWith: [] };
        const existing = { requestID: 'request-existing', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, dataType: 'Medical Records', status: 'PENDING_ADMIN_APPROVAL' };
        const indexValue = Buffer.from(existing.requestID);
        ctx.stub.getState.callsFake(async (key) => {
            if (key === 'Doctor1') return Buffer.from(JSON.stringify(doctor));
            if (key === 'Patient1') return Buffer.from(JSON.stringify(patient));
            if (key === 'request-existing') return Buffer.from(JSON.stringify(existing));
            if (key === 'ACTIVE_ACCESS_REQUEST:Doctor1:Patient1:2') return indexValue;
            return Buffer.alloc(0);
        });

        const requestID = await contract.RequestDataAccess(ctx, 'Doctor1', 'Patient1', '2', 'Dental Records', 'Specialist review', '{}');

        expect(requestID).to.equal('request-existing');
        expect(ctx.stub.putState.called).to.equal(false);
    });

    it('recognizes an active referral stored under the legacy scope-specific index', async () => {
        const ctx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        const existing = { requestID: 'request-legacy', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, dataType: 'Medical Records', status: 'PENDING_ADMIN_APPROVAL' };
        ctx.stub.getState.callsFake(async (key) => key === existing.requestID ? Buffer.from(JSON.stringify(existing)) : Buffer.alloc(0));
        ctx.stub.getStateByPartialCompositeKey.resolves({
            next: sinon.stub()
                .onFirstCall().resolves({ done: false, value: { value: Buffer.from(existing.requestID) } })
                .onSecondCall().resolves({ done: true }),
            close: sinon.stub().resolves(),
        });

        const result = JSON.parse(await contract.GetActiveDataAccessRequest(ctx, 'Doctor1', 'Patient1', '2', 'Dental Records'));

        expect(result.requestID).to.equal('request-legacy');
    });

    it('moves an authorized clinic request to the patient consent queue', async () => {
        const ctx = context('admin', 'Admin2', 'Org1MSP', '2');
        const request = { requestID: 'request-1', docType: 'accessRequest', workflowType: 'REFERRAL', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: '2', dataType: 'Medical Records', doctorName: 'Alice Wong', status: 'PENDING_ADMIN_APPROVAL' };
        ctx.stub.getState.callsFake(async (key) => key === request.requestID ? Buffer.from(JSON.stringify(request)) : Buffer.alloc(0));

        const result = await contract.ApproveRequest(ctx, 'Admin2', request.requestID, '2');

        expect(result.requestID).to.equal(request.requestID);
        expect(result.patientID).to.equal(request.patientID);
        expect(result.status).to.equal('PENDING_PATIENT_CONSENT');
        expect(result.adminApprovedAt).to.be.a('string');
        const requestWrite = ctx.stub.putState.getCalls().find((call) => call.args[0] === request.requestID);
        expect(JSON.parse(requestWrite.args[1].toString()).status).to.equal('PENDING_PATIENT_CONSENT');
        expect(result.notification.recipientActorID).to.equal(request.patientID);
        expect(result.notification.type).to.equal('ACCESS_REQUEST_PENDING_PATIENT');
        expect(ctx.stub.setEvent.calledWith('AccessRequestAdminApproved')).to.equal(true);
    });

    it('rejects a pending request without granting patient access', async () => {
        const ctx = context('admin', 'Admin2', 'Org1MSP', '2');
        const request = { requestID: 'request-1', docType: 'accessRequest', workflowType: 'REFERRAL', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, dataType: 'Medical Records', status: 'PENDING_ADMIN_APPROVAL' };
        ctx.stub.getState.callsFake(async (key) => key === request.requestID ? Buffer.from(JSON.stringify(request)) : Buffer.alloc(0));

        const result = await contract.RejectRequest(ctx, 'body-supplied-admin', request.requestID, '  Insufficient clinical justification  ');

        expect(result.status).to.equal('REJECTED');
        expect(result.accessGranted).to.equal(false);
        expect(result.rejectedBy).to.equal('Admin2');
        expect(result.rejectedRole).to.equal('admin');
        expect(result.rejectionReason).to.equal('Insufficient clinical justification');
        expect(result.decisionActorID).to.equal('Admin2');
        expect(result.decisionActorRole).to.equal('admin');
        expect(result.decisionTransactionID).to.equal('tx-1');
        expect(result.decisionTimestamp).to.equal(result.rejectedAt);
        const requestWrite = ctx.stub.putState.getCalls().find((call) => call.args[0] === request.requestID);
        const stored = JSON.parse(requestWrite.args[1].toString());
        expect(stored.status).to.equal('REJECTED');
        expect(stored.rejectedBy).to.equal('Admin2');
        expect(result.notification.recipientActorID).to.equal(request.doctorID);
        expect(result.notification.type).to.equal('ACCESS_REQUEST_REJECTED');
    });

    it('keeps an admin-rejected request terminal and prevents an identical new request', async () => {
        const ctx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        const doctor = { doctorID: 'Doctor1', firstName: 'Alice', lastName: 'Wong', clinicID: 1, worksAt: 'Clinic 1' };
        const patient = { patientID: 'Patient1', clinicID: 2, clinicIDs: [2], doctors: ['Doctor2'], sharedWith: [] };
        const rejected = { requestID: 'request-rejected', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, dataType: 'Medical Records', status: 'REJECTED', rejectedRole: 'admin' };
        ctx.stub.getState.callsFake(async (key) => {
            if (key === 'Doctor1') return Buffer.from(JSON.stringify(doctor));
            if (key === 'Patient1') return Buffer.from(JSON.stringify(patient));
            if (key === 'request-rejected') return Buffer.from(JSON.stringify(rejected));
            if (key === 'ACTIVE_ACCESS_REQUEST:Doctor1:Patient1:2') return Buffer.from(rejected.requestID);
            return Buffer.alloc(0);
        });

        await expectReject(
            contract.RequestDataAccess(ctx, 'Doctor1', 'Patient1', '2', 'Medical Records', 'Specialist review', '{}'),
            'was rejected and cannot be resubmitted'
        );
        expect(ctx.stub.putState.called).to.equal(false);
        expect(rejected.status).to.equal('REJECTED');
    });

    it('denies patient data after admin rejection and preserves the rejected request', async () => {
        const ctx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        const patient = { patientID: 'Patient1', doctors: ['Doctor2'], sharedWith: [] };
        const rejected = { requestID: 'request-rejected', docType: 'accessRequest', workflowType: 'REFERRAL', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, status: 'REJECTED' };
        ctx.stub.getState.callsFake(async (key) => key === 'Patient1' ? Buffer.from(JSON.stringify(patient)) : Buffer.alloc(0));
        let yielded = false;
        ctx.stub.getStateByRange.resolves({
            next: sinon.stub().callsFake(async () => yielded ? { done: true } : (yielded = true, { done: false, value: { value: Buffer.from(JSON.stringify(rejected)) } })),
            close: sinon.stub().resolves(),
        });

        await expectReject(contract.GetPatientData(ctx, 'Doctor1', 'Patient1'), 'has no active referral');
        expect(ctx.stub.putState.called).to.equal(false);
        expect(rejected.status).to.equal('REJECTED');
    });

    it('denies access and duplicate resubmission after patient rejection without changing sharedWith', async () => {
        const patient = { patientID: 'Patient1', clinicID: 2, clinicIDs: [2], doctors: ['Doctor2'], sharedWith: [] };
        const pending = { requestID: 'request-patient-rejected', docType: 'accessRequest', workflowType: 'REFERRAL', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, dataType: 'Medical Records', status: 'PENDING_PATIENT_CONSENT' };
        const patientCtx = context('patient', 'Patient1', 'Org1MSP', '2');
        patientCtx.stub.getState.callsFake(async (key) => key === pending.requestID ? Buffer.from(JSON.stringify(pending)) : Buffer.alloc(0));

        const rejection = await contract.RejectRequest(patientCtx, 'Patient1', pending.requestID, 'I do not consent to this disclosure');
        const rejectedWrite = patientCtx.stub.putState.getCalls().find((call) => call.args[0] === pending.requestID);
        const rejected = JSON.parse(rejectedWrite.args[1].toString());
        expect(rejection.status).to.equal('REJECTED');
        expect(rejection.accessGranted).to.equal(false);
        expect(rejection.rejectedRole).to.equal('patient');
        expect(patientCtx.stub.putState.getCalls().some((call) => call.args[0] === patient.patientID)).to.equal(false);
        expect(patient.sharedWith).to.deep.equal([]);

        const doctor = { doctorID: 'Doctor1', firstName: 'Alice', lastName: 'Wong', clinicID: 1, worksAt: 'Clinic 1' };
        const doctorCtx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        doctorCtx.stub.getState.callsFake(async (key) => {
            if (key === doctor.doctorID) return Buffer.from(JSON.stringify(doctor));
            if (key === patient.patientID) return Buffer.from(JSON.stringify(patient));
            if (key === rejected.requestID) return Buffer.from(JSON.stringify(rejected));
            if (key === 'ACTIVE_ACCESS_REQUEST:Doctor1:Patient1:2') return Buffer.from(rejected.requestID);
            return Buffer.alloc(0);
        });
        let yielded = false;
        doctorCtx.stub.getStateByRange.resolves({
            next: sinon.stub().callsFake(async () => yielded ? { done: true } : (yielded = true, { done: false, value: { value: Buffer.from(JSON.stringify(rejected)) } })),
            close: sinon.stub().resolves(),
        });

        await expectReject(contract.GetPatientData(doctorCtx, 'Doctor1', 'Patient1'), 'has no active referral');
        await expectReject(
            contract.RequestDataAccess(doctorCtx, 'Doctor1', 'Patient1', '2', 'Medical Records', 'Specialist review', '{}'),
            'was rejected and cannot be resubmitted'
        );
        expect(patient.sharedWith).to.deep.equal([]);
        expect(rejected.status).to.equal('REJECTED');
    });

    it('prevents an admin from another clinic rejecting the pending request', async () => {
        const ctx = context('admin', 'Admin1', 'Org1MSP', '1');
        const request = { requestID: 'request-1', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, status: 'PENDING_ADMIN_APPROVAL' };
        ctx.stub.getState.resolves(Buffer.from(JSON.stringify(request)));

        await expectReject(contract.RejectRequest(ctx, 'Admin1', request.requestID, 'Clinic policy'), 'not authorized for clinic 2');
        expect(ctx.stub.putState.called).to.equal(false);
    });

    it('prevents an active consent grant from being rejected through the pending decision path', async () => {
        const ctx = context('admin', 'Admin2', 'Org1MSP', '2');
        const request = { requestID: 'request-active', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, status: 'ACTIVE' };
        ctx.stub.getState.resolves(Buffer.from(JSON.stringify(request)));

        await expectReject(contract.RejectRequest(ctx, 'Admin2', request.requestID, 'Late rejection'), 'cannot be rejected at this stage');
        expect(ctx.stub.putState.called).to.equal(false);
    });

    it('revokes active consent only through the explicit patient revocation flow', async () => {
        const ctx = context('patient', 'Patient1', 'Org1MSP', '2');
        const request = { requestID: 'request-active', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, dataType: 'Medical Records', status: 'ACTIVE' };
        ctx.stub.getState.resolves(Buffer.from(JSON.stringify(request)));

        const result = await contract.RevokeConsent(ctx, 'Patient1', request.requestID, 'Care relationship ended');

        expect(result.status).to.equal('REVOKED');
        expect(result.accessGranted).to.equal(false);
        expect(result.revocationReason).to.equal('Care relationship ended');
        expect(result.decisionActorID).to.equal('Patient1');
        expect(result.decisionTransactionID).to.equal('tx-1');
        expect(result.decisionTimestamp).to.equal(result.revokedAt);
        const requestWrite = ctx.stub.putState.getCalls().find((call) => call.args[0] === request.requestID);
        expect(JSON.parse(requestWrite.args[1].toString()).status).to.equal('REVOKED');
        expect(ctx.stub.setEvent.calledWith('PatientConsentRevoked')).to.equal(true);
    });

    it('denies a cross-clinic doctor after revocation even if a legacy assignment remains', async () => {
        const ctx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        const patient = { patientID: 'Patient1', clinicID: 2, doctors: ['Doctor1'], sharedWith: ['Doctor1'] };
        const doctor = { doctorID: 'Doctor1', clinicID: 1, isActive: true };
        const revoked = { requestID: 'request-revoked', docType: 'accessRequest', workflowType: 'REFERRAL', doctorID: 'Doctor1', patientID: 'Patient1', dataOriginClinicID: 2, status: 'REVOKED' };
        ctx.stub.getState.callsFake(async (key) => {
            if (key === patient.patientID) return Buffer.from(JSON.stringify(patient));
            if (key === doctor.doctorID) return Buffer.from(JSON.stringify(doctor));
            return Buffer.alloc(0);
        });
        let yielded = false;
        ctx.stub.getStateByRange.resolves({
            next: sinon.stub().callsFake(async () => yielded ? { done: true } : (yielded = true, { done: false, value: { value: Buffer.from(JSON.stringify(revoked)) } })),
            close: sinon.stub().resolves(),
        });

        await expectReject(contract.GetPatientData(ctx, 'Doctor1', 'Patient1'), 'has no active referral');
        expect(ctx.stub.putState.called).to.equal(false);
        expect(revoked.status).to.equal('REVOKED');
    });

    it('grants scoped access without transferring the patient or replacing assigned doctors', async () => {
        const ctx = context('patient', 'Patient1', 'Org1MSP', '2');
        const request = { requestID: 'request-1', docType: 'accessRequest', workflowType: 'REFERRAL', doctorID: 'Doctor1', patientID: 'Patient1', dataType: 'Medical Records', status: 'PENDING_PATIENT_CONSENT' };
        const patient = { patientID: 'Patient1', clinicID: 2, clinicIDs: [2], doctors: ['Doctor2'], sharedWith: [] };
        ctx.stub.getState.callsFake(async (key) => Buffer.from(JSON.stringify(key === 'request-1' ? request : patient)));
        const result = await contract.ProvideConsent(ctx, 'Patient1', 'request-1');
        expect(result.status).to.equal('ACTIVE');
        expect(result.operationalOwnerChanged).to.equal(false);
        expect(result.decisionActorID).to.equal('Patient1');
        expect(result.decisionActorRole).to.equal('patient');
        expect(result.decisionTransactionID).to.equal('tx-1');
        expect(result.decisionTimestamp).to.equal('2026-07-12T16:00:00.000Z');
        expect(patient.clinicID).to.equal(2);
        expect(patient.doctors).to.deep.equal(['Doctor2']);
        expect(ctx.stub.putState.getCalls().some((call) => call.args[0] === 'Patient1')).to.equal(false);
        expect(ctx.stub.setEvent.calledWith('PatientConsentGranted')).to.equal(true);
    });

    it('denies a direct patient read by a doctor without assignment or active consent', async () => {
        const ctx = context('doctor', 'Doctor1', 'Org1MSP', '1');
        const patient = { patientID:'PatientX', clinicID:2, doctors:['Doctor2'], medicalRecords:[{ sensitive:true }], dentalChart:[{ sensitive:true }] };
        ctx.stub.getState.callsFake(async (key) => key === 'PatientX' ? Buffer.from(JSON.stringify(patient)) : Buffer.alloc(0));
        ctx.stub.getStateByRange.resolves({ next: sinon.stub().resolves({ done:true }), close: sinon.stub().resolves() });

        await expectReject(contract.ReadPatient(ctx, 'PatientX'), 'has no active referral');
    });

    it('rejects a patient certificate on a system audit-log path', async () => {
        const ctx = context('patient', 'Patient1');
        await expectReject(
            contract.LogAccess(ctx, 'Doctor1', 'Patient1'),
            'Access denied: requires system role.'
        );
    });

    it('stores a queryable deterministic access log with transaction evidence', async () => {
        const ctx = context('system', 'System1');

        const result = JSON.parse(await contract.LogAccess(ctx, 'Doctor1', 'Patient1', 'medical', JSON.stringify({ purpose:'treatment review', accessBasis:'assignment' })));

        expect(result.docType).to.equal('clinicalAccessLog');
        expect(result.logID).to.equal('ACCESS:tx-1');
        expect(result.transactionID).to.equal('tx-1');
        expect(result.doctorID).to.equal('Doctor1');
        expect(result.patientID).to.equal('Patient1');
        expect(result.recordType).to.equal('medical');
        expect(result.accessMetadata.purpose).to.equal('treatment review');
        expect(result.timestamp).to.equal('2026-07-12T16:00:00.000Z');
        expect(ctx.stub.putState.firstCall.args[0]).to.equal('ACCESS:tx-1');
        expect(ctx.stub.setEvent.calledWith('ClinicalAccessLogged')).to.equal(true);
    });

    it('automatically logs an authorized doctor clinical read with its access basis', async () => {
        const ctx = context('doctor', 'Doctor1');
        const patient = { patientID:'Patient1', clinicID:1, doctors:['Doctor1'] };
        const doctor = { doctorID:'Doctor1', clinicID:1, isActive:true };
        ctx.stub.getState.callsFake(async (key) => key === 'Patient1' ? Buffer.from(JSON.stringify(patient)) : key === 'Doctor1' ? Buffer.from(JSON.stringify(doctor)) : Buffer.alloc(0));

        const result = JSON.parse(await contract.LogClinicalAccess(ctx, 'Patient1', 'dental', 'treatment planning'));

        expect(result.transactionID).to.equal('tx-1');
        expect(result.doctorID).to.equal('Doctor1');
        expect(result.patientID).to.equal('Patient1');
        expect(result.accessBasis).to.equal('assignment');
        expect(result.accessMetadata.recordType).to.equal('dental');
        expect(ctx.stub.putState.firstCall.args[0]).to.equal('ACCESS:tx-1');
    });

    it('logs three sequential accesses with distinct IDs and timestamps', async () => {
        const ctx = context('doctor', 'Doctor1');
        const patient = { patientID:'Patient1', clinicID:1, doctors:['Doctor1'] };
        const doctor = { doctorID:'Doctor1', clinicID:1, isActive:true };
        ctx.stub.getState.callsFake(async (key) => key === 'Patient1'
            ? Buffer.from(JSON.stringify(patient))
            : key === 'Doctor1' ? Buffer.from(JSON.stringify(doctor)) : Buffer.alloc(0));
        ['tx-access-1', 'tx-access-2', 'tx-access-3'].forEach((txID, index) => {
            ctx.stub.getTxID.onCall(index).returns(txID);
        });
        let timestampCall = 0;
        ctx.stub.getTxTimestamp.callsFake(() => ({
            seconds: { toString: () => String(1783872000 + timestampCall++) }, nanos: 0
        }));

        const logs = [];
        for (let index = 0; index < 3; index += 1) {
            logs.push(JSON.parse(await contract.LogClinicalAccess(
                ctx, 'Patient1', 'patient-record', 'FTC-ACCESS-007 sequential access'
            )));
        }

        expect(new Set(logs.map((log) => log.logID)).size).to.equal(3);
        expect(new Set(logs.map((log) => log.transactionID)).size).to.equal(3);
        expect(new Set(logs.map((log) => log.timestamp)).size).to.equal(3);
        expect(ctx.stub.putState.getCalls().map((call) => call.args[0])).to.deep.equal(
            logs.map((log) => log.logID)
        );
    });

    it('rejects a doctor writing records for an unassigned patient', async () => {
        const ctx = context('doctor', 'Doctor1');
        ctx.stub.getState.resolves(Buffer.from(JSON.stringify({
            patientID: 'Patient2', doctors: ['Doctor2'], sharedWith: [], medicalRecords: [],
        })));
        await expectReject(
            contract.AddMedicalRecord(ctx, 'Record2', 'Patient2', 'mysql:Clinical_Record/Record2', 'a'.repeat(64), 'Doctor1', '2026-07-12T00:00:00Z'),
            'Doctor Doctor1 has no active referral for medical of patient Patient2'
        );
    });

    it('allows an assigned doctor to write a medical record', async () => {
        const ctx = context('doctor', 'Doctor1');
        ctx.stub.getState.callsFake(async key => key === 'Patient1' ? Buffer.from(JSON.stringify({
            patientID: 'Patient1', clinicID: 1, doctors: ['Doctor1'], sharedWith: [], medicalRecords: [],
        })) : key === 'Doctor1' ? Buffer.from(JSON.stringify({ doctorID:'Doctor1', clinicID:1, isActive:true })) : Buffer.alloc(0));
        const result = JSON.parse(await contract.AddMedicalRecord(ctx, 'Record1', 'Patient1', 'mysql:Clinical_Record/Record1', 'a'.repeat(64), 'Doctor1', '2026-07-12T00:00:00Z'));
        expect(result.recordType).to.equal('medical');
        expect(result).not.to.have.property('payload');
        expect(ctx.stub.putState.calledWith('CLINICAL:Record1')).to.equal(true);
    });

    it('allows a patient certificate to read its own medical records', async () => {
        const ctx = context('patient', 'Patient1');
        const patient = { patientID: 'Patient1', clinicalRecordIDs: ['Record1'] };
        const metadata = { recordID: 'Record1', recordType: 'medical', patientID: 'Patient1', offChainRef: 'mysql:Clinical_Record/Record1', dataHash: 'a'.repeat(64) };
        ctx.stub.getState.callsFake(async key => Buffer.from(JSON.stringify(key === 'Patient1' ? patient : metadata)));
        const records = JSON.parse(await contract.GetMedicalRecords(ctx, 'Patient1'));
        expect(records).to.deep.equal([metadata]);
    });

    it('rejects a patient certificate reading another patient medical records', async () => {
        const ctx = context('patient', 'Patient1');
        ctx.stub.getState.resolves(Buffer.from(JSON.stringify({
            patientID: 'Patient2', medicalRecords: [],
        })));
        await expectReject(
            contract.GetMedicalRecords(ctx, 'Patient2'),
            'patient certificate does not own Patient2'
        );
    });

    it('stores only radiographic metadata and SHA-256 for an assigned doctor', async () => {
        const ctx = context('doctor', 'Doctor1');
        ctx.stub.getState.callsFake(async key => key === 'Patient1'
            ? Buffer.from(JSON.stringify({ patientID: 'Patient1', clinicID:1, doctors: ['Doctor1'], sharedWith: [] }))
            : key === 'Doctor1' ? Buffer.from(JSON.stringify({ doctorID:'Doctor1', clinicID:1, isActive:true })) : Buffer.alloc(0));
        const result = JSON.parse(await contract.AddDentalFileMetadata(
            ctx, 'file-1', 'Patient1', 'filesystem:file-1', 'scan.dcm', 'application/dicom', '12', 'a'.repeat(64), 'Doctor1', '2026-07-12T00:00:00Z'
        ));
        expect(result.sha256).to.equal('a'.repeat(64));
        expect(result).not.to.have.property('content');
        expect(ctx.stub.putState.calledWith('RADFILE:file-1')).to.equal(true);
    });

    it('rejects radiographic metadata upload by an unauthorized doctor', async () => {
        const ctx = context('doctor', 'Doctor2');
        ctx.stub.getState.resolves(Buffer.from(JSON.stringify({ patientID: 'Patient1', doctors: ['Doctor1'], sharedWith: [] })));
        await expectReject(contract.AddDentalFileMetadata(
            ctx, 'file-2', 'Patient1', 'filesystem:file-2', 'scan.dcm', 'application/dicom', '12', 'b'.repeat(64), 'Doctor2', '2026-07-12T00:00:00Z'
        ), 'Doctor Doctor2 has no active referral for dicom of patient Patient1');
    });

    it('rejects incomplete radiographic metadata before creating ledger state', async () => {
        const ctx = context('doctor', 'Doctor1');
        ctx.stub.getState.callsFake(async key => key === 'Patient1'
            ? Buffer.from(JSON.stringify({ patientID:'Patient1', clinicID:1, doctors:['Doctor1'], sharedWith:[] }))
            : key === 'Doctor1' ? Buffer.from(JSON.stringify({ doctorID:'Doctor1', clinicID:1, isActive:true })) : Buffer.alloc(0));
        await expectReject(contract.AddDentalFileMetadata(
            ctx, 'file-empty-ref', 'Patient1', '', 'scan.dcm', 'application/dicom', '12', 'a'.repeat(64), 'Doctor1', '2026-07-12T00:00:00Z'
        ), 'CONTENT_REFERENCE_REQUIRED');
        await expectReject(contract.AddDentalFileMetadata(
            ctx, 'file-empty-hash', 'Patient1', 'filesystem:file-empty-hash', 'scan.dcm', 'application/dicom', '12', '', 'Doctor1', '2026-07-12T00:00:00Z'
        ), 'SHA-256 hash must contain exactly 64');
        await expectReject(contract.AddDentalFileMetadata(
            ctx, 'file-bad-ref', 'Patient1', 'filesystem:other-file', 'scan.dcm', 'application/dicom', '12', 'a'.repeat(64), 'Doctor1', '2026-07-12T00:00:00Z'
        ), 'INVALID_CONTENT_REFERENCE');
        expect(ctx.stub.putState.called).to.equal(false);
    });

    it('closes an active referral and records the completion summary', async () => {
        const ctx = context('doctor', 'Doctor1');
        const request = { requestID:'request-1', docType:'accessRequest', workflowType:'REFERRAL', doctorID:'Doctor1', patientID:'Patient1', dataOriginClinicID:2, status:'ACTIVE' };
        ctx.stub.getState.callsFake(async key => key === 'request-1' ? Buffer.from(JSON.stringify(request)) : Buffer.alloc(0));
        const result = await contract.CompleteReferral(ctx, 'Doctor1', 'request-1', 'Specialist treatment completed; return to referring doctor.');
        expect(result.status).to.equal('COMPLETED');
        expect(result.accessClosed).to.equal(true);
        const write = ctx.stub.putState.getCalls().find(call => call.args[0] === 'request-1');
        expect(JSON.parse(write.args[1].toString()).completionSummary).to.include('Specialist treatment completed');
        expect(ctx.stub.setEvent.calledWith('ReferralCompleted')).to.equal(true);
    });

    it('returns only the record categories approved by an active referral', async () => {
        const ctx = context('doctor', 'Doctor1');
        const patient = { patientID:'Patient1', doctors:['Doctor2'], medicalRecords:[{ id:'m1' }], dentalChart:[{ id:'d1' }] };
        const referral = { requestID:'request-1', docType:'accessRequest', workflowType:'REFERRAL', doctorID:'Doctor1', patientID:'Patient1', status:'ACTIVE', requestedRecordTypes:['Medical Records'], expiresAt:'2027-01-01T00:00:00.000Z' };
        ctx.stub.getState.callsFake(async key => {
            if (key === 'Patient1') return Buffer.from(JSON.stringify(patient));
            if (key === 'EDR_ACTIVE_ACCESS_RELATION:Patient1:Doctor1') return Buffer.from('request-1');
            if (key === 'request-1') return Buffer.from(JSON.stringify(referral));
            return Buffer.alloc(0);
        });
        const result = JSON.parse(await contract.GetPatientData(ctx, 'Doctor1', 'Patient1'));
        expect(result.medicalRecords).to.deep.equal([{ id:'m1' }]);
        expect(result).not.to.have.property('dentalChart');
        expect(result.referralID).to.equal('request-1');
    });

    it('uses a bounded composite-key page and returns the Fabric bookmark', async () => {
        const ctx = context('system', 'System1');
        const doctor = { docType:'doctor', doctorID:'Doctor1', clinicID:1 };
        ctx.stub.getState.callsFake(async key => key === 'Doctor1' ? Buffer.from(JSON.stringify(doctor)) : Buffer.alloc(0));
        let yielded = false;
        ctx.stub.getStateByPartialCompositeKeyWithPagination.resolves({
            iterator: {
                next: sinon.stub().callsFake(async () => yielded ? { done:true } : (yielded = true, { done:false, value:{ value:Buffer.from('Doctor1') } })),
                close: sinon.stub().resolves(),
            },
            metadata: { fetchedRecordsCount:1, bookmark:'doctor-next' },
        });

        const page = JSON.parse(await contract.GetAllDoctorsPage(ctx, '1000', 'doctor-start'));

        expect(page.records).to.deep.equal([doctor]);
        expect(page.bookmark).to.equal('doctor-next');
        expect(ctx.stub.getStateByPartialCompositeKeyWithPagination.calledWith('EDR_DOC_TYPE', ['doctor'], 100, 'doctor-start')).to.equal(true);
        expect(ctx.stub.getStateByRange.called).to.equal(false);
    });

    it('backfills query indexes one bounded world-state page at a time', async () => {
        const ctx = context('system', 'System1');
        const entries = [
            { key:'Doctor1', value:{ docType:'doctor', doctorID:'Doctor1', clinicID:1 } },
            { key:'Patient1', value:{ docType:'patient', patientID:'Patient1', clinicID:1, clinicIDs:[1] } },
            { key:'request-1', value:{ docType:'accessRequest', requestID:'request-1', patientID:'Patient1', doctorID:'Doctor1', dataOriginClinicID:2, requestingClinicID:1, status:'ACTIVE' } },
        ];
        let index = 0;
        ctx.stub.getStateByRangeWithPagination.resolves({
            iterator: {
                next: sinon.stub().callsFake(async () => index < entries.length
                    ? { done:false, value:{ key:entries[index].key, value:Buffer.from(JSON.stringify(entries[index++].value)) } }
                    : { done:true }),
                close: sinon.stub().resolves(),
            },
            metadata: { fetchedRecordsCount:3, bookmark:'backfill-next' },
        });

        const result = JSON.parse(await contract.BackfillQueryIndexes(ctx, '500', 'backfill-start'));

        expect(result.indexedRecords).to.equal(3);
        expect(result.bookmark).to.equal('backfill-next');
        expect(result.complete).to.equal(false);
        expect(ctx.stub.getStateByRangeWithPagination.calledWith('\u0001', '\uffff', 100, 'backfill-start')).to.equal(true);
        expect(ctx.stub.putState.calledWith('EDR_DOC_TYPE:doctor:Doctor1', Buffer.from('Doctor1'))).to.equal(true);
        expect(ctx.stub.putState.calledWith('EDR_ACCESS_PATIENT:Patient1:request-1', Buffer.from('request-1'))).to.equal(true);
        expect(ctx.stub.putState.calledWith('EDR_ACTIVE_ACCESS_RELATION:Patient1:Doctor1', Buffer.from('request-1'))).to.equal(true);
    });

    it('rejects invalid page sizes before invoking a ledger query', async () => {
        const ctx = context('system', 'System1');
        await expectReject(contract.GetAllPatientsPage(ctx, '0'), 'Page size must be a positive integer');
        expect(ctx.stub.getStateByPartialCompositeKeyWithPagination.called).to.equal(false);
    });

    it('rejects an identity that is not associated with an MSP', async () => {
        const ctx = context('admin', 'Admin1');
        ctx.clientIdentity.getMSPID.returns('');
        await expectReject(contract.DeletePatient(ctx, 'Patient1'), 'not associated with an MSP');
    });

    it('rejects a certificate from an untrusted MSP', async () => {
        const ctx = context('admin', 'Admin1', 'UnknownMSP');
        await expectReject(contract.DeletePatient(ctx, 'Patient1'), 'MSP UnknownMSP is not authorized');
    });
});
