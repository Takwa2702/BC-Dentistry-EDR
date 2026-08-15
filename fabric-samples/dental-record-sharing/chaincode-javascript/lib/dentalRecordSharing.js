/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify  = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

const parseArrayArgument = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
        return [value];
    }
};

class DentalRecordSharing extends Contract {

    _requireMsp(ctx, ...allowedMsps) {
        const clientIdentity = ctx.clientIdentity;
        const mspID = clientIdentity && clientIdentity.getMSPID && clientIdentity.getMSPID();
        const accepted = allowedMsps.length > 0 ? allowedMsps : ['Org1MSP', 'Org2MSP'];

        if (!mspID) {
            throw new Error('The invoking certificate is not associated with an MSP.');
        }

        if (!accepted.includes(mspID)) {
            throw new Error(`Access denied: MSP ${mspID} is not authorized for this contract.`);
        }

        return mspID;
    }

    _requireRole(ctx, ...allowedRoles) {
        const clientIdentity = ctx.clientIdentity;
        const mspID = this._requireMsp(ctx);
        const role = clientIdentity && clientIdentity.getAttributeValue && clientIdentity.getAttributeValue('role');

        if (!role || !allowedRoles.map((value) => value.toLowerCase()).includes(role.toLowerCase())) {
            throw new Error(`Access denied: requires ${allowedRoles.join(' or ')} role.`);
        }

        return { mspID, role: role.toLowerCase() };
    }

    _requireActor(ctx, expectedActorID, ...allowedRoles) {
        const identity = this._requireRole(ctx, ...allowedRoles);
        const actorID = ctx.clientIdentity.getAttributeValue('actorID');

        if (!actorID || actorID !== expectedActorID) {
            throw new Error(`Access denied: certificate actorID does not match ${expectedActorID}.`);
        }

        return { ...identity, actorID };
    }

    _requireAdminClinic(ctx, expectedClinicID) {
        const identity = this._requireRole(ctx, 'admin');
        const clinicID = ctx.clientIdentity.getAttributeValue('clinicID');

        if (!clinicID || String(clinicID) !== String(expectedClinicID)) {
            throw new Error(`Access denied: admin certificate is not authorized for clinic ${expectedClinicID}.`);
        }

        return { ...identity, clinicID };
    }

    async _requirePatientRecordAccess(ctx, patientID, patient, recordType, ...allowedRoles) {
        const identity = this._requireRole(ctx, ...allowedRoles);
        if (identity.role === 'admin' || identity.role === 'system') {
            return identity;
        }

        const actorID = ctx.clientIdentity.getAttributeValue('actorID');
        if (!actorID) {
            throw new Error('Access denied: invoking certificate is missing actorID.');
        }
        if (identity.role === 'patient' && actorID !== patientID) {
            throw new Error(`Access denied: patient certificate does not own ${patientID}.`);
        }
        if (identity.role === 'doctor') {
            const assignedDoctors = Array.isArray(patient.doctors) ? patient.doctors : [];
            let hasCurrentAssignment = false;
            if (assignedDoctors.includes(actorID)) {
                const doctorBytes = await ctx.stub.getState(actorID);
                if (doctorBytes && doctorBytes.length) {
                    const doctor = JSON.parse(doctorBytes.toString());
                    hasCurrentAssignment = doctor.isActive !== false
                        && patient.isActive !== false
                        && Number(doctor.clinicID) === Number(patient.clinicID);
                }
            }
            if (!hasCurrentAssignment) {
                const referral = await this._findActiveReferralRequest(ctx, patientID, actorID, recordType);
                if (!referral) {
                    throw new Error(`Access denied: Doctor ${actorID} has no active referral for ${recordType || 'the requested records'} of patient ${patientID}.`);
                }
                return { ...identity, actorID, accessBasis: 'referral', requestID: referral.requestID, referral };
            }
            return { ...identity, actorID, accessBasis: 'assignment' };
        }
        return { ...identity, actorID };
    }

    _txTimestamp(ctx) {
        const txTimestamp = ctx.stub.getTxTimestamp();
        return new Date((Number(txTimestamp.seconds.toString()) * 1000) + Math.floor(txTimestamp.nanos / 1000000)).toISOString();
    }

    _parseDetailsJson(value) {
        if (!value) {
            return {};
        }

        if (typeof value === 'object') {
            return value;
        }

        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    async _putNotification(ctx, notification) {
        const timestamp = notification.createdAt || this._txTimestamp(ctx);
        const notificationID = notification.notificationID
            || `NOTIFICATION:${ctx.stub.getTxID()}:${notification.recipientRole}:${notification.recipientActorID || notification.recipientClinicID}:${notification.type}`;
        const entry = {
            docType: 'notification',
            ...notification,
            notificationID,
            status: notification.status || 'UNREAD',
            createdAt: timestamp,
            readAt: notification.readAt || null,
        };
        await ctx.stub.putState(notificationID, Buffer.from(JSON.stringify(entry)));
        return entry;
    }

    async _emitPrivacySafeEvent(ctx, eventName, payload) {
        const event = {
            eventName,
            txID: ctx.stub.getTxID(),
            occurredAt: this._txTimestamp(ctx),
            ...payload,
        };
        await ctx.stub.setEvent(eventName, Buffer.from(stringify(sortKeysRecursive(event))));
        return event;
    }

    _boundedPageSize(pageSize) {
        const parsed = Number.parseInt(pageSize || '100', 10);
        if (!Number.isFinite(parsed) || parsed < 1) throw new Error('Page size must be a positive integer');
        return Math.min(parsed, 100);
    }

    async _putQueryIndex(ctx, objectType, attributes, recordID) {
        const key = ctx.stub.createCompositeKey(objectType, [...attributes.map(String), String(recordID)]);
        await ctx.stub.putState(key, Buffer.from(String(recordID)));
    }

    async _indexRecord(ctx, recordID, record) {
        if (!record || typeof record !== 'object') return;
        if (record.docType === 'doctor') {
            await this._putQueryIndex(ctx, 'EDR_DOC_TYPE', ['doctor'], recordID);
            await this._putQueryIndex(ctx, 'EDR_CLINIC_ACTOR', [record.clinicID, 'doctor'], recordID);
        } else if (record.docType === 'patient') {
            await this._putQueryIndex(ctx, 'EDR_DOC_TYPE', ['patient'], recordID);
            const clinics = [...new Set([record.clinicID, ...(record.clinicIDs || [])].filter((value) => value !== undefined && value !== null))];
            for (const clinicID of clinics) await this._putQueryIndex(ctx, 'EDR_CLINIC_ACTOR', [clinicID, 'patient'], recordID);
        } else if (record.docType === 'accessRequest') {
            await this._putQueryIndex(ctx, 'EDR_ACCESS_PATIENT', [record.patientID], recordID);
            await this._putQueryIndex(ctx, 'EDR_ACCESS_DOCTOR', [record.doctorID], recordID);
            await this._putQueryIndex(ctx, 'EDR_ACCESS_ADMIN', [record.dataOriginClinicID], recordID);
            await this._putQueryIndex(ctx, 'EDR_ACCESS_REQUESTING_CLINIC', [record.requestingClinicID], recordID);
            if (record.status === 'ACTIVE') {
                const activeKey = ctx.stub.createCompositeKey('EDR_ACTIVE_ACCESS_RELATION', [String(record.patientID), String(record.doctorID)]);
                await ctx.stub.putState(activeKey, Buffer.from(String(recordID)));
            }
        }
    }

    async _deleteActiveRelationIndex(ctx, record) {
        const key = ctx.stub.createCompositeKey('EDR_ACTIVE_ACCESS_RELATION', [String(record.patientID), String(record.doctorID)]);
        await ctx.stub.deleteState(key);
    }

    async _queryIndexPage(ctx, objectType, attributes, pageSize = '100', bookmark = '') {
        if (typeof ctx.stub.getStateByPartialCompositeKeyWithPagination !== 'function') {
            throw new Error('INDEXED_PAGINATION_UNAVAILABLE: Fabric pagination API is required');
        }
        const size = this._boundedPageSize(pageSize);
        const response = await ctx.stub.getStateByPartialCompositeKeyWithPagination(objectType, attributes.map(String), size, String(bookmark || ''));
        const iterator = response.iterator || response;
        const records = [];
        try {
            for (;;) {
                const item = await iterator.next();
                if (item.value?.value) {
                    const recordID = item.value.value.toString();
                    const bytes = await ctx.stub.getState(recordID);
                    if (bytes && bytes.length) records.push(JSON.parse(bytes.toString()));
                }
                if (item.done) break;
            }
        } finally {
            if (iterator.close) await iterator.close();
        }
        const metadata = response.metadata || {};
        return { records, fetchedRecordsCount: records.length, bookmark: metadata.bookmark || '' };
    }

    async BackfillQueryIndexes(ctx, pageSize = '100', bookmark = '') {
        this._requireRole(ctx, 'system');
        if (typeof ctx.stub.getStateByRangeWithPagination !== 'function') {
            throw new Error('INDEX_BACKFILL_PAGINATION_UNAVAILABLE: Fabric pagination API is required');
        }
        const size = this._boundedPageSize(pageSize);
        // Composite keys begin with a null byte. Starting at U+0001 keeps the
        // resumable migration focused on primary world-state records and avoids
        // re-reading index entries created by earlier backfill pages.
        const response = await ctx.stub.getStateByRangeWithPagination('\u0001', '\uffff', size, String(bookmark || ''));
        const iterator = response.iterator || response;
        let indexedRecords = 0;
        try {
            for (;;) {
                const item = await iterator.next();
                if (item.value?.value) {
                    try {
                        const record = JSON.parse(item.value.value.toString());
                        await this._indexRecord(ctx, item.value.key, record);
                        if (['doctor', 'patient', 'accessRequest'].includes(record.docType)) indexedRecords += 1;
                    } catch (error) {
                        // Ignore non-JSON state and index records while rebuilding indexes.
                    }
                }
                if (item.done) break;
            }
        } finally {
            if (iterator.close) await iterator.close();
        }
        const nextBookmark = response.metadata?.bookmark || '';
        return JSON.stringify({ indexedRecords, fetchedRecordsCount: response.metadata?.fetchedRecordsCount || indexedRecords, bookmark: nextBookmark, complete: !nextBookmark });
    }

    _requireNotificationOwner(ctx, notification) {
        if (notification.recipientRole === 'admin') {
            return this._requireAdminClinic(ctx, notification.recipientClinicID);
        }

        if (notification.recipientRole === 'patient') {
            return this._requireActor(ctx, notification.recipientActorID, 'patient');
        }

        if (notification.recipientRole === 'doctor') {
            return this._requireActor(ctx, notification.recipientActorID, 'doctor');
        }

        return this._requireRole(ctx, 'system');
    }

    async _findGrantedConsentRequest(ctx, patientID, doctorID, excludeRequestID = '') {
        const key = ctx.stub.createCompositeKey('EDR_ACTIVE_ACCESS_RELATION', [String(patientID), String(doctorID)]);
        const requestID = await ctx.stub.getState(key);
        if (!requestID || !requestID.length || requestID.toString() === excludeRequestID) return null;
        const bytes = await ctx.stub.getState(requestID.toString());
        if (!bytes || !bytes.length) return null;
        const record = JSON.parse(bytes.toString());
        return record.docType === 'accessRequest' && record.status === 'ACTIVE' ? record : null;
    }

    _referralAllowsRecordType(request, recordType) {
        if (!recordType) return true;
        const normalized = String(recordType).toLowerCase();
        const requested = Array.isArray(request.requestedRecordTypes) ? request.requestedRecordTypes : [request.dataType];
        return requested.some((value) => {
            const scope = String(value || '').toLowerCase();
            return scope.includes('medical and dental')
                || scope.includes('dental and medical')
                || scope.includes(normalized);
        });
    }

    async _findActiveReferralRequest(ctx, patientID, doctorID, recordType) {
        const now = Date.parse(this._txTimestamp(ctx));
        const request = await this._findGrantedConsentRequest(ctx, patientID, doctorID);
        if (!request) return null;
        const notExpired = !request.expiresAt || Date.parse(request.expiresAt) > now;
        return request.workflowType === 'REFERRAL' && notExpired && this._referralAllowsRecordType(request, recordType) ? request : null;
    }

    async InitLedger(ctx) {
        this._requireRole(ctx, 'system');
        
        await this.InitDoctors(ctx);
        
        await this.InitPatients(ctx);
    }


    async InitDoctors(ctx) {
        this._requireRole(ctx, 'system');
        // Sample doctors to initialize in the ledger
        const doctors = [
            {
                doctorID: 'Doctor1',
                firstName: 'Alice',
                lastName: 'Wong',
                emiratesID: '784-1985-0000001-1',
                speciality: 'Orthodontist',
                worksAt: 'Dental Clinic A',
                clinicID: 1,
                email: 'doctor1@example.com',
                contactNumber: '0509876543',
                licenseNumber: 'DHA-DOCTOR-0001',
                role: 'doctor',
                createdDate: "2025-02-03T00:00:00.000Z",
                patients: ['Patient3']  // Pre-assigned patients
            },
            {
                doctorID: 'Doctor2',
                firstName: 'Bob',
                lastName: 'Smith',
                emiratesID: '784-1986-0000002-2',
                speciality: 'Endodontist',
                worksAt: 'Dental Clinic B',
                clinicID: 2,
                email: 'doctor2@example.com',
                contactNumber: '0509871234',
                licenseNumber: 'DHA-DOCTOR-0002',
                role: 'doctor',
                createdDate: "2025-02-03T00:00:00.000Z",
                patients: ['Patient1', 'Patient2']
            }
        ];
            
         // Store each doctor in the ledger
         for (const doctor of doctors) {
            doctor.docType = 'doctor';
            // example of how to write to world state deterministically
            // use convetion of alphabetic order
            // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
            // when retrieving data, in any lang, the order of data will be the same and consequently also the corresonding hash
            await ctx.stub.putState(doctor.doctorID, Buffer.from(stringify(sortKeysRecursive(doctor))));
            await this._indexRecord(ctx, doctor.doctorID, doctor);
            console.info(`Storing doctor: ${doctor.doctorID}`);
        }
      
        console.info('Ledger initialized with doctors');
    }

    async InitPatients(ctx) {
        this._requireRole(ctx, 'system');
        // Store each patient in the ledger
        const patients = [
            {
                patientID: 'Patient1',
                firstName: 'John',
                lastName: 'Doe',
                dateOfBirth: '1980-01-01',
                gender: 'Male',
                emiratesID: '1234567890',
                email: 'john.doe@example.com',
                contactNumber: '0501234567',
                address: '123 Main Street, Dubai',
                role: 'patient',
                createdDate: "2025-03-26T00:00:00.000Z",
                clinicID: 2,
                clinicIDs: [2],
                doctors: ['Doctor2'],  // Pre-assigned doctor
                dentalChart: [
                    {
                      "ID": 1,
                      "Category": "Restorative",
                      "Sub_Category": "Filling",
                      "Code": "R123",
                      "Site": "1",
                      "Suf": "MODBL",
                      "Status": "E",
                      "Pre_Auth": "approved",
                      "Phase": "1",
                      "Discipline": "General Dentistry",
                      "Diagnoses": "Cavity",
                      "Notes": "Small cavity on molar 1, requires filling.",
                      "Estimate": 200.00,
                      "Doctor_ID": 101,
                      "Audit_Date": "2024-10-04",
                      "Created_Date": "2024-10-01"
                    }, 
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "2",
                        "Suf": "MODBL",
                        "Status": "E",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 2, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "3",
                        "Suf": "MODBL",
                        "Status": "E",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 3, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "4",
                        "Suf": "MODBL",
                        "Status": "E",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 4, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "5",
                        "Suf": "MODBL",
                        "Status": "E",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 5, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "6",
                        "Suf": "MODBL",
                        "Status": "E",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 6, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "7",
                        "Suf": "MODBL",
                        "Status": "C",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 7, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "8",
                        "Suf": "MODBL",
                        "Status": "C",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 8, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "9",
                        "Suf": "MODBL",
                        "Status": "C",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 9, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "9",
                        "Suf": "MODBL",
                        "Status": "C",
                        "Pre_Auth": "approved",
                        "Phase": "10",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 10, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "11",
                        "Suf": "MODBL",
                        "Status": "C",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 11, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "12",
                        "Suf": "MODBL",
                        "Status": "C",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 12, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "13",
                        "Suf": "MODBL",
                        "Status": "C",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 13, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                    { 
                        "ID": 1,
                        "Category": "Restorative",
                        "Sub_Category": "Filling",
                        "Code": "R123",
                        "Site": "14",
                        "Suf": "MODBL",
                        "Status": "C",
                        "Pre_Auth": "approved",
                        "Phase": "1",
                        "Discipline": "General Dentistry",
                        "Diagnoses": "Cavity",
                        "Notes": "Small cavity on molar 14, requires filling.",
                        "Estimate": 200.00,
                        "Doctor_ID": 101,
                        "Audit_Date": "2024-10-04",
                        "Created_Date": "2024-10-01"
                    },
                  ],
                  medicalRecords:[ {
                    allergies: [
                        {
                            allergyId: 'A001',
                            name: 'Peanuts',
                            description: 'Allergic reaction to peanuts, causing potential anaphylaxis.'
                        }
                    ],
                    medications: [
                        {
                            medicationId: '11111113',
                            drugName: 'Aspirin',
                            type: 'Antiplatelet',
                            doses: '81 mg daily',
                            strength: '81',
                            intakeTime: 'Morning',
                            frequency: 5
                        }
                    ]
                }]   , 
                sharedWith: ['Doctor2'],  // Track which hospitals/doctors the data is shared with
                dentalFiles: [],   
            },
            {
                patientID: 'Patient2',
                firstName: 'Jane',
                lastName: 'Doe',
                dateOfBirth: '1990-02-02',
                gender: 'Female',
                emiratesID: '9876543210',
                email: 'jane.doe@example.com',
                contactNumber: '0507654321',
                address: '456 Elm Street, Dubai',
                role: 'patient',
                createdDate: "2025-03-26T00:00:00.000Z",
                clinicID: 2,
                clinicIDs: [2],
                doctors: ['Doctor2'],
                dentalChart: [
                    {
                      "ID": 1,
                      "Category": "Restorative",
                      "Sub_Category": "Filling",
                      "Code": "R123",
                      "Site": "12",
                      "Suf": "MODBL",
                      "Status": "E",
                      "Pre_Auth": "approved",
                      "Phase": "1",
                      "Discipline": "General Dentistry",
                      "Diagnoses": "Cavity",
                      "Notes": "Small cavity on molar 12, requires filling.",
                      "Estimate": 200.00,
                      "Doctor_ID": 101,
                      "Audit_Date": "2024-10-04",
                      "Created_Date": "2024-10-01"
                    }
                  ],
                  medicalRecords:[], 
                  sharedWith: ['Doctor2'], 
                  dentalFiles: [],

            },
            {
                patientID: 'Patient3',
                firstName: 'Mark',
                lastName: 'Lee',
                dateOfBirth: '1985-03-03',
                gender: 'Male',
                emiratesID: '1357924680',
                email: 'mark.lee@example.com',
                contactNumber: '0502468135',
                address: '789 Pine Street, Dubai',
                role: 'patient',
                createdDate: "2025-03-26T00:00:00.000Z",
                clinicID: 1,
                doctors: ['Doctor1'],
                clinicIDs: [1],
                dentalChart: [],
                medicalRecords:[ {
                    allergies: [
                        {
                            allergyId: 'A001',
                            name: 'Peanuts',
                            description: 'Allergic reaction to peanuts, causing potential anaphylaxis.'
                        }
                    ],
                    medications: [
                        {
                            medicationId: '11111113',
                            drugName: 'Aspirin',
                            type: 'Antiplatelet',
                            doses: '81 mg daily',
                            strength: '81',
                            intakeTime: 'Morning',
                            frequency: 5
                        }
                    ]
                }]   , 
                sharedWith: ['Doctor1'], 
            }
        ];

        // Store each patient in the ledger
        for (const patient of patients) {
            patient.docType = 'patient';
            // example of how to write to world state deterministically
            // use convetion of alphabetic order
            // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
            // when retrieving data, in any lang, the order of data will be the same and consequently also the corresonding hash
            await ctx.stub.putState(patient.patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
            await this._indexRecord(ctx, patient.patientID, patient);
            console.info(`Storing patient: ${patient.patientID}`);
        }
    }
 

    async addDoctor(ctx, doctorID, firstName, lastName, emiratesID, speciality, worksAt, clinicID, email, contactNumber, licenseNumber, createdDate, patients) {
            this._requireAdminClinic(ctx, clinicID);
        // try {
            // // Get the creator's identity
            // const creator = ctx.clientIdentity.getIDBytes().toString();
            // const attributes = JSON.parse(Buffer.from(creator, 'base64').toString());
            
            // // Check the role of the user
            // const roleAttr = attributes.attributes.find(attr => attr.name === 'role');
            // if (!roleAttr || roleAttr.value !== 'admin') {
            //     throw new Error('Only admins can add doctors.');
            // }
  
            if (await this._actorExists(ctx, doctorID)) {
                throw new Error(`The doctor ${doctorID} already exists`);
            }
            const emiratesIDIndexKey = this._emiratesIDIndexKey(ctx, emiratesID);
            if (await this._actorExists(ctx, emiratesIDIndexKey)) {
                throw new Error(`The doctor with eID ${emiratesID} already exists`);
            }
    
            const doctor = {
                doctorID: doctorID,
                firstName: firstName,
                lastName: lastName,
                emiratesID: emiratesID,
                speciality: speciality,
                worksAt: worksAt,
                clinicID: parseInt(clinicID),
                email: email,
                contactNumber: contactNumber,
                licenseNumber: licenseNumber,
                role: 'doctor',
                isActive: true,
                createdDate: createdDate,
                patients: parseArrayArgument(patients)
            };
    
            doctor.docType = 'doctor';
            await ctx.stub.putState(doctorID, Buffer.from(JSON.stringify(doctor)));
            await this._indexRecord(ctx, doctorID, doctor);
            await ctx.stub.putState(emiratesIDIndexKey, Buffer.from(JSON.stringify({
                docType: 'uniqueActorIdentifier', actorType: 'doctor', actorID: doctorID, emiratesID,
            })));
    
            return JSON.stringify(doctor);
        // } catch (error) {
        //     throw new Error(`Failed to add doctor: ${error.message}`);
        // }
    }
    
    

    // AddPatient issues a new patient to the world state with given details.
    async addPatient(ctx, patientID, firstName, lastName, dateOfBirth, gender, emiratesID,  email, contactNumber, address, createdDate, clinicID,  doctors) {
            this._requireAdminClinic(ctx, clinicID);
        // try {
        //     //only admin can add patients 
        //     const isAdmin = ctx.clientIdentity.assertAttributeValue('role', 'admin');
        //     if (!isAdmin) {
        //         throw new Error('Only admins can add patients.');
        //     }
            // Check if patient already exists
            if (await this._actorExists(ctx, patientID)) {
                throw new Error(`The patient ${patientID} already exists`);
            }
            const emiratesIDIndexKey = this._emiratesIDIndexKey(ctx, emiratesID);
            if (await this._actorExists(ctx, emiratesIDIndexKey)) {
                throw new Error(`The patient with eID ${emiratesID} already exists`);
            }

            // Create a new patient object
            const patient = {
                patientID: patientID,
                firstName: firstName,
                lastName: lastName,
                dateOfBirth: dateOfBirth,
                gender: gender,
                emiratesID: emiratesID,
                email: email,
                contactNumber: contactNumber,
                address: address,
                role: 'patient',
                isActive: true,
                createdDate: createdDate,
                clinicIDs: Array.isArray(clinicID) ? clinicID : [parseInt(clinicID)],
                doctors: parseArrayArgument(doctors),  // Pre-assigned doctors
                dentalChart: [],    // Initialize an empty dental chart for new patients
                medicalRecords:[], 
                sharedWith: [],
                dentalFiles: [] 
            };

            patient.docType = 'patient';
            
            // Store the patient object in the world state
            await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
            await this._indexRecord(ctx, patientID, patient);
            await ctx.stub.putState(emiratesIDIndexKey, Buffer.from(JSON.stringify({
                docType: 'uniqueActorIdentifier', actorType: 'patient', actorID: patientID, emiratesID,
            })));
            
            return JSON.stringify(patient);
        // } catch (error) {
        //     throw new Error(`Failed to add doctor: ${error.message}`);
        // }
    }

    // Phase 4 SEC-03 path: Fabric stores no patient PII, only an opaque off-chain reference and integrity hash.
    async AddPatientMetadata(ctx, patientID, clinicID, offChainRef, dataHash, doctors, createdDate) {
        this._requireAdminClinic(ctx, clinicID);
        if (await this._actorExists(ctx, patientID)) {
            throw new Error(`The patient ${patientID} already exists`);
        }
        if (!/^[a-f0-9]{64}$/i.test(dataHash)) {
            throw new Error('Patient dataHash must be a SHA-256 hex digest');
        }
        const patient = {
            docType: 'patient', patientID, role: 'patient',
            clinicID: parseInt(clinicID), clinicIDs: [parseInt(clinicID)],
            offChainRef, dataHash: dataHash.toLowerCase(), doctors: parseArrayArgument(doctors),
            sharedWith: [], isActive: true, createdDate, modifiedDate: createdDate,
            storagePolicy: 'PII_OFF_CHAIN_MYSQL'
        };
        await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
        await this._indexRecord(ctx, patientID, patient);
        return JSON.stringify(patient);
    }

    async UpdatePatientMetadata(ctx, patientID, clinicID, offChainRef, dataHash, doctors, modifiedDate) {
        this._requireAdminClinic(ctx, clinicID);
        const patientJSON = await ctx.stub.getState(patientID);
        if (!patientJSON || patientJSON.length === 0) throw new Error(`The patient ${patientID} does not exist`);
        const existing = JSON.parse(patientJSON.toString());
        this._requireAdminClinic(ctx, existing.clinicID || (existing.clinicIDs || [])[0]);
        if (!/^[a-f0-9]{64}$/i.test(dataHash)) throw new Error('Patient dataHash must be a SHA-256 hex digest');
        const patient = {
            ...existing,
            docType: 'patient', patientID, role: 'patient', clinicID: parseInt(clinicID), clinicIDs: [parseInt(clinicID)],
            offChainRef, dataHash: dataHash.toLowerCase(), doctors: parseArrayArgument(doctors),
            sharedWith: existing.sharedWith || [], createdDate: existing.createdDate || modifiedDate, modifiedDate,
            storagePolicy: 'PII_OFF_CHAIN_MYSQL'
        };
        await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
        await this._indexRecord(ctx, patientID, patient);
        return JSON.stringify(patient);
    }


    // actorExists returns true when doctor or patient with given ID exists in world state.
    async _actorExists(ctx, actorID) {
        const actorJSON = await ctx.stub.getState(actorID);
        return actorJSON && actorJSON.length > 0;
    }

    _emiratesIDIndexKey(ctx, emiratesID) {
        const normalized = String(emiratesID || '').trim().toUpperCase();
        if (!normalized) throw new Error('Emirates ID is required');
        return ctx.stub.createCompositeKey('UNIQUE_EMIRATES_ID', [normalized]);
    }

    async actorExists(ctx, actorID) {
        this._requireRole(ctx, 'admin', 'system');
        return this._actorExists(ctx, actorID);
    }
 

    // ReadDoctor returns the doctor stored in the world state with given id.
    async ReadDoctor(ctx, id) {
        const identity = this._requireRole(ctx, 'admin', 'doctor', 'system');
        if (identity.role === 'doctor') {
            this._requireActor(ctx, id, 'doctor');
        }
        const doctorJSON = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!doctorJSON || doctorJSON.length === 0) {
            throw new Error(`The doctor ${id} does not exist`);
        }
        return doctorJSON.toString();
    }

    // ReadDoctor returns the doctor stored in the world state with given id.
    async ReadPatient(ctx, id) {
        const patientJSON = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`The patient ${id} does not exist`);
        }
        const patient = JSON.parse(patientJSON.toString());
        await this._requirePatientRecordAccess(ctx, id, patient, null, 'admin', 'doctor', 'patient', 'system');
        return patientJSON.toString();
    }


    async GetPatientsByClinicPage(ctx, clinicID, pageSize, bookmark) {
        const identity = this._requireRole(ctx, 'admin', 'system');
        if (identity.role === 'admin') {
            this._requireAdminClinic(ctx, clinicID);
        }
        pageSize = pageSize || '100';
        bookmark = bookmark || '';
        return JSON.stringify(await this._queryIndexPage(ctx, 'EDR_CLINIC_ACTOR', [clinicID, 'patient'], pageSize, bookmark));
    }

    async GetPatientsByClinic(ctx, clinicID) {
        const page = JSON.parse(await this.GetPatientsByClinicPage(ctx, clinicID));
        return JSON.stringify(page.records);
    }
    
    // UpdateDoctor updates an existing doctor in the world state with provided parameters.
    async UpdateDoctorInfo(ctx, doctorID, firstName, lastName, emiratesID, speciality, worksAt, clinicID, email, contactNumber, licenseNumber, createdDate, patients) {
        this._requireAdminClinic(ctx, clinicID);
        const exists = await this._actorExists(ctx, doctorID);
        if (!exists) {
            throw new Error(`The doctor ${doctorID} does not exist`);
        }
        const existingDoctor = JSON.parse((await ctx.stub.getState(doctorID)).toString());
        this._requireAdminClinic(ctx, existingDoctor.clinicID);

        // Profile updates must not move tenants, rewrite identity metadata, or alter assignments.
        const updatedDoctor = {
            doctorID: existingDoctor.doctorID,
            firstName: firstName,
            lastName: lastName,
            emiratesID: emiratesID,
            speciality: speciality,
            clinicID: existingDoctor.clinicID,
            worksAt: worksAt,
            email: email,
            contactNumber: contactNumber,
            licenseNumber: licenseNumber,
            role: existingDoctor.role,
            createdDate: existingDoctor.createdDate,
            patients: Array.isArray(existingDoctor.patients) ? existingDoctor.patients : [],
            docType: existingDoctor.docType
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        return ctx.stub.putState(doctorID, Buffer.from(stringify(sortKeysRecursive(updatedDoctor))));
    }

    // UpdatePatient updates an existing patient in the world state with provided parameters.
    async UpdatePatientInfo(ctx, patientID, firstName, lastName, dateOfBirth, gender, emiratesID, email, contactNumber, address, createdDate, doctors, clinicID,
        dentalChart) {
        this._requireAdminClinic(ctx, clinicID);
        const exists = await this._actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        // Create the updated patient object
        const updatedPatient = {
            patientID: patientID,
            firstName: firstName,
            lastName: lastName,
            dateOfBirth: dateOfBirth,
            gender: gender,
            emiratesID: emiratesID,
            email: email,
            contactNumber: contactNumber,
            address: address,
            role: 'patient', 
            createdDate: createdDate, 
            clinicID:clinicID,
            doctors: doctors,  
            dentalChart: dentalChart  
        };

        // Store the updated patient information in the world state
        await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(updatedPatient))));
        
        return JSON.stringify(updatedPatient);  // Return the updated patient details
    }

    async DeactivateDoctor(ctx, id) {
        this._requireRole(ctx, 'admin');
        const doctorJSON = await ctx.stub.getState(id);
        if (!doctorJSON || doctorJSON.length === 0) throw new Error(`The doctor ${id} does not exist`);
        const doctor = JSON.parse(doctorJSON.toString());
        this._requireAdminClinic(ctx, doctor.clinicID);
        if (doctor.isActive === false) return JSON.stringify(doctor);
        if ((doctor.patients || []).length) throw new Error('Doctor must be unassigned from all patients before deactivation');
        doctor.isActive = false;
        doctor.deactivatedAt = this._txTimestamp(ctx);
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(doctor))));
        return JSON.stringify(doctor);
    }

    async DeactivatePatient(ctx, id) {
        this._requireRole(ctx, 'admin');
        const patientJSON = await ctx.stub.getState(id);
        if (!patientJSON || patientJSON.length === 0) throw new Error(`The patient ${id} does not exist`);
        const patient = JSON.parse(patientJSON.toString());
        this._requireAdminClinic(ctx, patient.clinicID || (patient.clinicIDs || [])[0]);
        if (patient.isActive === false) return JSON.stringify(patient);
        for (const doctorID of Array.isArray(patient.doctors) ? patient.doctors : []) {
            const doctorJSON = await ctx.stub.getState(String(doctorID));
            if (!doctorJSON || doctorJSON.length === 0) continue;
            const doctor = JSON.parse(doctorJSON.toString());
            doctor.patients = (Array.isArray(doctor.patients) ? doctor.patients : [])
                .filter((patientID) => String(patientID) !== String(id));
            await ctx.stub.putState(String(doctorID), Buffer.from(stringify(sortKeysRecursive(doctor))));
        }
        patient.doctors = [];
        patient.isActive = false;
        patient.deactivatedAt = this._txTimestamp(ctx);
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(patient))));
        return JSON.stringify(patient);
    }

    async DeactivateClinicActors(ctx, clinicID, pageSize = '100', doctorBookmark = '', patientBookmark = '', originRequestBookmark = '', requestingRequestBookmark = '') {
        this._requireRole(ctx, 'system');
        const clinic = String(clinicID);
        const doctorPage = await this._queryIndexPage(ctx, 'EDR_CLINIC_ACTOR', [clinic, 'doctor'], pageSize, doctorBookmark);
        const patientPage = await this._queryIndexPage(ctx, 'EDR_CLINIC_ACTOR', [clinic, 'patient'], pageSize, patientBookmark);
        const originRequestPage = await this._queryIndexPage(ctx, 'EDR_ACCESS_ADMIN', [clinic], pageSize, originRequestBookmark);
        const requestingRequestPage = await this._queryIndexPage(ctx, 'EDR_ACCESS_REQUESTING_CLINIC', [clinic], pageSize, requestingRequestBookmark);
        const actors = [...doctorPage.records, ...patientPage.records];
        const requestMap = new Map([...originRequestPage.records, ...requestingRequestPage.records].map((request) => [request.requestID, request]));
        let actorsDeactivated = 0; let requestsCancelled = 0;
        const deactivatedAt = this._txTimestamp(ctx);
        for (const actor of actors) {
            // A completed bookmark stream may be revisited while another stream
            // still has pages. Keep the batch operation idempotent in that case.
            if (actor.isActive === false) continue;
            actor.isActive = false; actor.deactivatedAt = deactivatedAt;
            if (actor.docType === 'doctor') actor.patients = [];
            if (actor.docType === 'patient') actor.doctors = [];
            await ctx.stub.putState(String(actor.doctorID || actor.patientID), Buffer.from(stringify(sortKeysRecursive(actor)))); actorsDeactivated += 1;
        }
        for (const request of requestMap.values()) {
            if (!['PENDING_ADMIN_APPROVAL','PENDING_PATIENT_CONSENT','ACTIVE'].includes(request.status)) continue;
            request.status = request.status === 'ACTIVE' ? 'REVOKED' : 'CANCELLED';
            request.revocationReason = 'Clinic deactivated'; request.modifiedDate = deactivatedAt;
            await ctx.stub.putState(request.requestID, Buffer.from(stringify(sortKeysRecursive(request))));
            await this._deleteActiveRelationIndex(ctx, request);
            requestsCancelled += 1;
        }
        const bookmarks = {
            doctor: doctorPage.bookmark, patient: patientPage.bookmark,
            originRequest: originRequestPage.bookmark, requestingRequest: requestingRequestPage.bookmark,
        };
        return JSON.stringify({ clinicID: clinic, actorsDeactivated, requestsCancelled, historyPreserved: true, bookmarks, complete: !Object.values(bookmarks).some(Boolean) });
    }

    // Retained as an explicit compatibility guard: ledger actors are never hard deleted.
    async DeleteDoctor(ctx, id) {
        this._requireRole(ctx, 'admin');
        throw new Error(`HARD_DELETE_FORBIDDEN: Doctor ${id} must be deactivated; ledger history is permanent`);
    }

    // Retained as an explicit compatibility guard: ledger actors are never hard deleted.
    async DeletePatient(ctx, id) {
        this._requireRole(ctx, 'admin');
        throw new Error(`HARD_DELETE_FORBIDDEN: Patient ${id} must be deactivated; ledger history is permanent`);
    }
   

    // GetAllDoctors returns all doctors found in the world state.
    async GetAllDoctorsPage(ctx, pageSize, bookmark) {
        this._requireRole(ctx, 'admin', 'system');
        pageSize = pageSize || '100';
        bookmark = bookmark || '';
        return JSON.stringify(await this._queryIndexPage(ctx, 'EDR_DOC_TYPE', ['doctor'], pageSize, bookmark));
    }

    async GetAllDoctors(ctx) {
        const page = JSON.parse(await this.GetAllDoctorsPage(ctx));
        return JSON.stringify(page.records);
    }

    // GetAllPatients returns all patients found in the world state.
    async GetAllPatientsPage(ctx, pageSize, bookmark) {
        this._requireRole(ctx, 'admin', 'system');
        pageSize = pageSize || '100';
        bookmark = bookmark || '';
        return JSON.stringify(await this._queryIndexPage(ctx, 'EDR_DOC_TYPE', ['patient'], pageSize, bookmark));
    }

    async GetAllPatients(ctx) {
        const page = JSON.parse(await this.GetAllPatientsPage(ctx));
        return JSON.stringify(page.records);
    }


// Doctor: AddDentalChart adds a dental chart to an existing patient
    // Add or update a dental chart entry for a specific patient
    async legacyAddDentalChartEntry(ctx, patientID, site, surface, category, subCategory, code, status, preAuth, phase, discipline, diagnoses, notes, estimate, doctorID, auditDate, createdDate) {
        this._requireActor(ctx, doctorID, 'doctor');
        const exists = await this._actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`The patient ${patientID} does not exist`);
        }
    
        // Retrieve the patient's current data
        const patientAsBytes = await ctx.stub.getState(patientID);
        const patient = JSON.parse(patientAsBytes.toString());
    
        // If dentalChart does not exist, initialize it as an empty array
        if (!patient.dentalChart) {
            patient.dentalChart = [];
        }
    
        // Generate a new ID: If dentalChart is empty, ID starts from 1, otherwise increment based on the length
        const newID = patient.dentalChart.length ? patient.dentalChart.length + 1 : 1;
    
        // Find existing entry by site and surface
        let existingEntryIndex = patient.dentalChart.findIndex(entry => entry.Site === site && entry.Suf === surface);
    
        const newEntry = {
            ID: newID,
            Category: category,
            Sub_Category: subCategory,
            Code: code,
            Site: site,
            Suf: surface,
            Status: status,
            Pre_Auth: preAuth,
            Phase: phase,
            Discipline: discipline,
            Diagnoses: diagnoses,
            Notes: notes,
            Estimate: estimate,
            Doctor_ID: doctorID,
            Audit_Date: auditDate,
            Created_Date: createdDate
        };
    
        if (existingEntryIndex !== -1) {
            // Update the existing entry
            patient.dentalChart[existingEntryIndex] = newEntry;
        } else {
            // Add new entry
            patient.dentalChart.push(newEntry);
        }
    
        await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
    
        return JSON.stringify(newEntry);
    }
        

    // Get a specific dental chart entry by site and surface
    async getDentalChartEntry(ctx, patientID, site, surface) {
        const patientJSON = await ctx.stub.getState(patientID);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        const patient = JSON.parse(patientJSON.toString());
        await this._requirePatientRecordAccess(ctx, patientID, patient, null, 'admin', 'doctor', 'patient', 'system');
        const dentalChartEntry = patient.dentalChart.find(entry => entry.Site === site && entry.Suf === surface);

        if (!dentalChartEntry) {
            throw new Error(`No dental chart entry found for site ${site} and surface ${surface}`);
        }

        return JSON.stringify(dentalChartEntry);
    }

    // Get all dental chart data for a specific patient
    async legacyGetAllDentalChartData(ctx, patientID) {
        const patientJSON = await ctx.stub.getState(patientID);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        const patient = JSON.parse(patientJSON.toString());
        await this._requirePatientRecordAccess(ctx, patientID, patient, null, 'admin', 'doctor', 'patient', 'system');

        return JSON.stringify(patient.dentalChart);
    }


    // Add a medical record for a patient
    async LegacyAddMedicalRecord(ctx, patientID, medicalRecord) {
        this._requireRole(ctx, 'doctor');
        // Check if the patient existsaddDentalChartEntry
        const exists = await this._actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        // Retrieve the patient's current data
        const patientAsBytes = await ctx.stub.getState(patientID);
        const patient = JSON.parse(patientAsBytes.toString());
        await this._requirePatientRecordAccess(ctx, patientID, patient, 'medical', 'doctor');

        // If medicalRecords does not exist, initialize it as an empty array
        if (!patient.medicalRecords) {
            patient.medicalRecords = [];
        }

        // Add the new medical record to the patient's records
        patient.medicalRecords.push(medicalRecord); // Change this to push the new record

        // Save the updated patient record
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient))); // Ensure patient is saved correctly

        return JSON.stringify(patient); // Return the updated patient record
    }


    // Get all medical records for a patient
    async LegacyGetMedicalRecords(ctx, patientID) {
        // Check if the patient exists
        const exists = await this._actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`Patient ${patientID} does not exist`);
        }

        // Retrieve the patient's current data
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`Patient ${patientID} does not exist`);
        }

        const patient = JSON.parse(patientAsBytes.toString());
        await this._requirePatientRecordAccess(ctx, patientID, patient, 'dental', 'doctor', 'patient');
        return patient.medicalRecords || []; // Return the medical records or an empty array
    }

    // register patient in clinic 
    async registerPatientInClinic(ctx, patientID, clinicID) {
        this._requireAdminClinic(ctx, clinicID);
        const patientJSON = await ctx.stub.getState(patientID);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientID} does not exist`);
        }
    
        const patient = JSON.parse(patientJSON.toString());
    
        // ✅ Ensure `clinicIDs` is an array and store as numbers
        patient.clinicIDs = typeof patient.clinicIDs === "string" ? JSON.parse(patient.clinicIDs) : patient.clinicIDs || [];
        
        clinicID = parseInt(clinicID);  // Convert clinicID to number
    
        // ✅ Prevent duplicate registration
        if (patient.clinicIDs.includes(clinicID)) {
            throw new Error(`Patient ${patientID} is already registered in Clinic ${clinicID}`);
        }
    
        // ✅ Add new clinic as a number
        patient.clinicIDs.push(clinicID);
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
    
        return { success: true, message: `Patient ${patientID} registered in Clinic ${clinicID}` };
    }
    
    


    // Admin: Assign a Patient to a Doctor
    async assignPatientToDoctor(ctx, patientID, doctorID, dataHash, modifiedDate) {
        this._requireRole(ctx, 'admin');
        const patientJSON = await ctx.stub.getState(patientID);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`Patient ${patientID} does not exist`);
        }
    
        const doctorJSON = await ctx.stub.getState(doctorID);
        if (!doctorJSON || doctorJSON.length === 0) {
            throw new Error(`Doctor ${doctorID} does not exist`);
        }
    
        const patient = JSON.parse(patientJSON.toString());
        const doctor = JSON.parse(doctorJSON.toString());
        if (patient.isActive === false || doctor.isActive === false) {
            throw new Error('Inactive doctors and patients cannot be assigned');
        }
        doctor.patients = Array.isArray(doctor.patients) ? doctor.patients : [];
        patient.doctors = Array.isArray(patient.doctors) ? patient.doctors : [];
    
        // ✅ Ensure at least one shared clinic between the doctor and patient
        const doctorClinicID = parseInt(doctor.clinicID);
        const sharedClinics = patient.clinicIDs.map(Number).filter(clinic => clinic === doctorClinicID);
        if (sharedClinics.length === 0) {
            throw new Error(`Doctor ${doctorID} and Patient ${patientID} do not belong to the same clinic`);
        }

        const alreadyAssigned = doctor.patients.includes(patientID) && patient.doctors.includes(doctorID);
        if (alreadyAssigned) {
            return {
                success: true,
                alreadyAssigned: true,
                idempotent: true,
                message: `Patient ${patientID} is already assigned to Doctor ${doctorID}; no duplicate was created`,
            };
        }
    
        // ✅ Prevent duplicate assignment
        if (!doctor.patients.includes(patientID)) {
            doctor.patients.push(patientID);
            await ctx.stub.putState(doctorID, Buffer.from(JSON.stringify(doctor)));
        }
    
        if (!patient.doctors.includes(doctorID)) {
            patient.doctors.push(doctorID);
        }

        if (dataHash) {
            if (!/^[a-f0-9]{64}$/i.test(dataHash)) {
                throw new Error('Patient dataHash must be a SHA-256 hex digest');
            }
            patient.dataHash = dataHash.toLowerCase();
        }
        patient.modifiedDate = modifiedDate || patient.modifiedDate || patient.createdDate || '';
        await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
    
        return { success: true, alreadyAssigned: false, idempotent: false, message: `Patient ${patientID} assigned to Doctor ${doctorID}` };
    }

    async unassignPatientFromDoctor(ctx, patientID, doctorID, dataHash, modifiedDate) {
        this._requireRole(ctx, 'admin');
        const patientJSON = await ctx.stub.getState(patientID);
        const doctorJSON = await ctx.stub.getState(doctorID);
        if (!patientJSON || patientJSON.length === 0) throw new Error(`Patient ${patientID} does not exist`);
        if (!doctorJSON || doctorJSON.length === 0) throw new Error(`Doctor ${doctorID} does not exist`);
        const patient = JSON.parse(patientJSON.toString());
        const doctor = JSON.parse(doctorJSON.toString());
        const clinicID = patient.clinicID || (patient.clinicIDs || [])[0];
        this._requireAdminClinic(ctx, clinicID);
        this._requireAdminClinic(ctx, doctor.clinicID);
        if (String(clinicID) !== String(doctor.clinicID)) throw new Error('Doctor and patient clinic mismatch');
        const patientAssigned = (Array.isArray(patient.doctors) ? patient.doctors : []).some((id) => String(id) === String(doctorID));
        const doctorAssigned = (Array.isArray(doctor.patients) ? doctor.patients : []).some((id) => String(id) === String(patientID));
        if (!patientAssigned && !doctorAssigned) return JSON.stringify({ patientID, doctorID, unassigned:true, alreadyUnassigned:true, idempotent:true, message:'Patient was already unassigned; ledger state was not rewritten' });
        patient.doctors = (Array.isArray(patient.doctors) ? patient.doctors : []).filter((id) => String(id) !== String(doctorID));
        doctor.patients = (Array.isArray(doctor.patients) ? doctor.patients : []).filter((id) => String(id) !== String(patientID));
        if (dataHash) {
            if (!/^[a-f0-9]{64}$/i.test(dataHash)) throw new Error('Patient dataHash must be a SHA-256 hex digest');
            patient.dataHash = dataHash.toLowerCase();
        }
        patient.modifiedDate = modifiedDate || patient.modifiedDate || patient.createdDate || '';
        await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
        await ctx.stub.putState(doctorID, Buffer.from(stringify(sortKeysRecursive(doctor))));
        return JSON.stringify({ patientID, doctorID, unassigned:true, alreadyUnassigned:false, idempotent:false, message:'Patient unassigned from doctor' });
    }
    
    // Doctor: Get all Patients assigned to the doctor
    async getPatientsAssignedToDoctor(ctx, doctorID) {
        const identity = this._requireRole(ctx, 'admin', 'doctor');
        if (identity.role === 'doctor') this._requireActor(ctx, doctorID, 'doctor');
        const role = this._requireRole(ctx, 'admin', 'doctor').role;
        if (role === 'doctor') {
            this._requireActor(ctx, doctorID, 'doctor');
        }
        const doctorJSON = await ctx.stub.getState(doctorID);
        if (!doctorJSON || doctorJSON.length === 0) {
            throw new Error(`The doctor ${doctorID} does not exist`);
        }

        const doctor = JSON.parse(doctorJSON.toString());

        // Retrieve patients assigned to the doctor
        const patients = [];
        for (const patientID of doctor.patients) {
            const patientJSON = await ctx.stub.getState(patientID);
            if (patientJSON && patientJSON.length > 0) {
                patients.push(JSON.parse(patientJSON.toString()));
            }
        }

        return patients;  // Return the array of assigned patients
    }

  // Doctor: request data Patient assigned to the doctor
    // async RequestDataAccess(ctx, doctorID, patientID) {
    //     const doctorAsBytes = await ctx.stub.getState(doctorID);
    //     if (!doctorAsBytes || doctorAsBytes.length === 0) {
    //         throw new Error(`Doctor ${doctorID} not found`);
    //     }

    //     const patientAsBytes = await ctx.stub.getState(patientID);
    //     if (!patientAsBytes || patientAsBytes.length === 0) {
    //         throw new Error(`Patient ${patientID} not found`);
    //     }

    //     const request = {
    //         requestID: ctx.stub.getTxID(),
    //         doctorID,
    //         patientID,
    //         status: 'PENDING_ADMIN_APPROVAL',
    //     };

    //     await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));

    //     return request.requestID;
    // }
    async _findActiveDataAccessRequest(ctx, doctorID, patientID, dataOriginClinicID) {
        const attributes = [String(doctorID), String(patientID), String(dataOriginClinicID)];
        const canonicalKey = ctx.stub.createCompositeKey('ACTIVE_ACCESS_REQUEST', attributes);
        const canonicalID = await ctx.stub.getState(canonicalKey);
        const candidateIDs = canonicalID && canonicalID.length ? [canonicalID.toString()] : [];

        // Read legacy scope-specific index entries as well. Earlier versions included
        // dataType in this key, which allowed parallel active referrals for one care
        // relationship when the scope label changed.
        if (typeof ctx.stub.getStateByPartialCompositeKey === 'function') {
            const iterator = await ctx.stub.getStateByPartialCompositeKey('ACTIVE_ACCESS_REQUEST', attributes);
            try {
                let done = false;
                while (!done) {
                    const item = await iterator.next();
                    done = item.done;
                    if (!done) {
                        const requestID = item.value?.value?.toString();
                        if (requestID && !candidateIDs.includes(requestID)) candidateIDs.push(requestID);
                    }
                }
            } finally {
                await iterator.close();
            }
        }

        for (const requestID of candidateIDs) {
            const requestBytes = await ctx.stub.getState(requestID);
            if (!requestBytes || !requestBytes.length) continue;
            const request = JSON.parse(requestBytes.toString());
            if (['PENDING_ADMIN_APPROVAL','PENDING_PATIENT_CONSENT','ACTIVE'].includes(request.status)) return request;
        }
        return null;
    }

    async GetActiveDataAccessRequest(ctx, doctorID, patientID, dataOriginClinicID, dataType) {
        this._requireActor(ctx, doctorID, 'doctor');
        return JSON.stringify(await this._findActiveDataAccessRequest(ctx, doctorID, patientID, dataOriginClinicID));
    }

    async RequestDataAccess(ctx, doctorID, patientID, dataOriginClinicID, dataType, purpose, detailsJson) {
        this._requireActor(ctx, doctorID, 'doctor');
        const doctorAsBytes = await ctx.stub.getState(doctorID);
        if (!doctorAsBytes || doctorAsBytes.length === 0) {
            throw new Error(`Doctor ${doctorID} not found`);
        }

        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`Patient ${patientID} not found`);
        }

        const doctor = JSON.parse(doctorAsBytes.toString());
        const patient = JSON.parse(patientAsBytes.toString());
        dataType = dataType || 'Dental and Medical Records';
        purpose = purpose || 'clinical consultation';
        detailsJson = detailsJson || '{}';
        const details = this._parseDetailsJson(detailsJson);
        const requestedAt = this._txTimestamp(ctx);
        const activeRequestKey = ctx.stub.createCompositeKey('ACTIVE_ACCESS_REQUEST', [String(doctorID), String(patientID), String(dataOriginClinicID)]);
        const existing = await this._findActiveDataAccessRequest(ctx, doctorID, patientID, dataOriginClinicID);
        if (existing) return existing.requestID;

        // A rejection is a terminal decision for this care relationship. Keep the
        // relationship index pointing at the rejected ledger record so an ordinary
        // create call cannot erase the decision by starting the same workflow again.
        // Any future reconsideration must use an explicit, separately audited flow.
        const indexedRequestID = await ctx.stub.getState(activeRequestKey);
        if (indexedRequestID && indexedRequestID.length) {
            const indexedRequestBytes = await ctx.stub.getState(indexedRequestID.toString());
            if (indexedRequestBytes && indexedRequestBytes.length) {
                const indexedRequest = JSON.parse(indexedRequestBytes.toString());
                if (indexedRequest.status === 'REJECTED') {
                    throw new Error(`Access request ${indexedRequest.requestID} was rejected and cannot be resubmitted as a new request`);
                }
            }
        }

        const patientClinicIDs = [...new Set([
            ...(Array.isArray(patient.clinicIDs) ? patient.clinicIDs : []),
            patient.clinicID,
        ].filter((clinicID) => clinicID !== undefined && clinicID !== null).map(Number))];
        const originClinicID = Number(dataOriginClinicID);
        if (!patientClinicIDs.includes(originClinicID)) {
            throw new Error(`Patient ${patientID} does not have data in Clinic ${dataOriginClinicID}`);
        }
        if (Number(doctor.clinicID) === originClinicID) {
            throw new Error(`Doctor ${doctorID} already belongs to Clinic ${dataOriginClinicID}; cross-clinic access is not required`);
        }

        const request = {
            docType: 'accessRequest',
            workflowType: 'REFERRAL',
            requestID: ctx.stub.getTxID(),
            doctorID,
            doctorName: `${doctor.firstName} ${doctor.lastName}`,
            doctorClinicName: doctor.worksAt,
            requestingClinicID: doctor.clinicID,
            requestingClinicName: doctor.worksAt,
            patientID,
            clinicID: patient.clinicIDs,  // Clinics the patient is registered in
            dataOriginClinicID: parseInt(dataOriginClinicID), // Where the data exists
            holdingClinicID: parseInt(dataOriginClinicID),
            dataType: String(dataType || 'Dental and Medical Records'),
            requestedRecordTypes: Array.isArray(details.requestedRecordTypes) && details.requestedRecordTypes.length
                ? details.requestedRecordTypes.map(String)
                : [String(dataType || 'Dental and Medical Records')],
            purpose: String(purpose || 'clinical consultation'),
            reason: String(details.reason || purpose || 'clinical consultation'),
            requestedAt,
            requestedBy: doctorID,
            adminApprovedAt: null,
            patientConsentedAt: null,
            activatedAt: null,
            expiresAt: details.expiresAt || null,
            completedAt: null,
            completionSummary: null,
            revokedAt: null,
            details,
            status: 'PENDING_ADMIN_APPROVAL',
        };

        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
        await ctx.stub.putState(activeRequestKey, Buffer.from(request.requestID));
        await this._indexRecord(ctx, request.requestID, request);
        await this._emitPrivacySafeEvent(ctx, 'AccessRequestCreated', {
            requestID: request.requestID, patientID: request.patientID,
            doctorID: request.doctorID, status: request.status,
        });
        await this._putNotification(ctx, {
            notificationID: `NOTIFICATION:${request.requestID}:ADMIN_REVIEW`,
            recipientRole: 'admin',
            recipientClinicID: request.dataOriginClinicID,
            type: 'ACCESS_REQUEST_PENDING_ADMIN',
            relatedRequestID: request.requestID,
            message: `Dr. ${request.doctorName} requested ${request.dataType} for patient ${patientID}.`,
            payload: {
                requestID: request.requestID,
                doctorID,
                patientID,
                dataType: request.dataType,
                purpose: request.purpose,
                dataOriginClinicID: request.dataOriginClinicID,
            },
            createdAt: requestedAt,
        });

        return request.requestID;
    }

    // Admin of Hospital will review the data access request and approve or deny it.

    async ApproveRequest(ctx, adminID, requestID, adminClinicID) {
        this._requireAdminClinic(ctx, adminClinicID);
        adminClinicID = parseInt(adminClinicID);
    
        const requestAsBytes = await ctx.stub.getState(requestID);
        if (!requestAsBytes || requestAsBytes.length === 0) {
            throw new Error(`Request ${requestID} not found`);
        }
    
        const request = JSON.parse(requestAsBytes.toString());
    
        // ✅ Ensure the admin is approving a request for their clinic's data
        if (Number(request.dataOriginClinicID) !== adminClinicID) {
            throw new Error(`Admin from Clinic ${adminClinicID} is not authorized to approve this request.`);
        }
    
        if (request.status !== 'PENDING_ADMIN_APPROVAL') {
            throw new Error(`Request ${requestID} cannot be approved at this stage`);
        }
    
        const approvedAt = this._txTimestamp(ctx);
        request.status = 'PENDING_PATIENT_CONSENT';
        request.adminID = adminID;
        request.adminClinicID = adminClinicID;
        request.adminApprovedAt = approvedAt;
    
        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
        await this._emitPrivacySafeEvent(ctx, 'AccessRequestAdminApproved', {
            requestID: request.requestID, patientID: request.patientID,
            doctorID: request.doctorID, status: request.status,
        });
        const notification = await this._putNotification(ctx, {
            notificationID: `NOTIFICATION:${request.requestID}:PATIENT_CONSENT`,
            recipientRole: 'patient',
            recipientActorID: request.patientID,
            type: 'ACCESS_REQUEST_PENDING_PATIENT',
            relatedRequestID: request.requestID,
            message: `Clinic ${adminClinicID} approved Dr. ${request.doctorName}'s request. Your consent is required.`,
            payload: {
                requestID: request.requestID,
                doctorID: request.doctorID,
                patientID: request.patientID,
                dataType: request.dataType,
                purpose: request.purpose,
                adminClinicID,
            },
            createdAt: approvedAt,
        });
    
        return {
            success: true,
            requestID: request.requestID,
            patientID: request.patientID,
            doctorID: request.doctorID,
            dataOriginClinicID: request.dataOriginClinicID,
            status: request.status,
            adminID: request.adminID,
            adminApprovedAt: request.adminApprovedAt,
            message: `Request ${requestID} approved by Admin from Clinic ${adminClinicID}.`,
            notification,
        };
    }

    //Admin gets all request related to clinic
    async GetRequestsForAdminPage(ctx, adminClinicID, pageSize, bookmark) {
        this._requireAdminClinic(ctx, adminClinicID);
        pageSize = pageSize || '100';
        bookmark = bookmark || '';
        return JSON.stringify(await this._queryIndexPage(ctx, 'EDR_ACCESS_ADMIN', [adminClinicID], pageSize, bookmark));
    }

    async GetRequestsForAdmin(ctx, adminClinicID) {
        const page = JSON.parse(await this.GetRequestsForAdminPage(ctx, adminClinicID));
        return JSON.stringify(page.records);
    }
    

    // Patient provides consent for the doctor to access their data
       async ProvideConsent(ctx, patientID, requestID) {
        this._requireActor(ctx, patientID, 'patient');
        const requestAsBytes = await ctx.stub.getState(requestID);
        if (!requestAsBytes || requestAsBytes.length === 0) {
            throw new Error(`Request ${requestID} not found`);
        }

        const request = JSON.parse(requestAsBytes.toString());

        if (request.status !== 'PENDING_PATIENT_CONSENT') {
            throw new Error(`Request ${requestID} is not waiting for patient consent`);
        }

        // Retrieve patient details
        const patientAsBytes = await ctx.stub.getState(request.patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`Patient ${request.patientID} not found`);
        }

        const patient = JSON.parse(patientAsBytes.toString());

        // Ensure the patient is the owner of the request
        if (patient.patientID !== patientID) {
            throw new Error(`Patient ${patientID} is not authorized to approve this request.`);
        }

        const consentedAt = this._txTimestamp(ctx);
        const identity = this._requireActor(ctx, patientID, 'patient');
        request.status = 'ACTIVE';
        request.patientConsentedAt = consentedAt;
        request.activatedAt = consentedAt;
        request.consentActorID = identity.actorID;
        request.consentMSPID = identity.mspID;
        request.consentTxID = ctx.stub.getTxID();
        request.decisionActorID = identity.actorID;
        request.decisionActorRole = 'patient';
        request.decisionTransactionID = request.consentTxID;
        request.decisionTimestamp = consentedAt;

        // Store the updated request and patient data on the ledger
        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
        await this._indexRecord(ctx, request.requestID, request);
        await this._emitPrivacySafeEvent(ctx, 'PatientConsentGranted', {
            requestID: request.requestID, patientID,
            doctorID: request.doctorID, status: request.status,
        });
        const notification = await this._putNotification(ctx, {
            notificationID: `NOTIFICATION:${request.requestID}:DOCTOR_CONSENT_GRANTED`,
            recipientRole: 'doctor',
            recipientActorID: request.doctorID,
            type: 'ACCESS_REQUEST_CONSENT_GRANTED',
            relatedRequestID: request.requestID,
            message: `Patient ${patientID} granted consent for ${request.dataType}.`,
            payload: {
                requestID: request.requestID,
                patientID,
                dataType: request.dataType,
                purpose: request.purpose,
            },
            createdAt: consentedAt,
        });

        return {
            success: true,
            patientID,
            doctorID: request.doctorID,
            requestID,
            status: request.status,
            accessGranted: true,
            decisionActorID: request.decisionActorID,
            decisionActorRole: request.decisionActorRole,
            decisionTransactionID: request.decisionTransactionID,
            decisionTimestamp: request.decisionTimestamp,
            operationalOwnerChanged: false,
            message: `Patient ${patientID} granted data access to Doctor ${request.doctorID}.`,
            notification,
        };
    }

    async GetPendingRequestsForPatientPage(ctx, patientID, pageSize, bookmark) {
        this._requireActor(ctx, patientID, 'patient');
        pageSize = pageSize || '100';
        bookmark = bookmark || '';
        const page = await this._queryIndexPage(ctx, 'EDR_ACCESS_PATIENT', [patientID], pageSize, bookmark);
        page.records = page.records.filter((record) => record.status === 'PENDING_PATIENT_CONSENT');
        page.fetchedRecordsCount = page.records.length;
        return JSON.stringify(page);
    }

    async GetPendingRequestsForPatient(ctx, patientID) {
        const page = JSON.parse(await this.GetPendingRequestsForPatientPage(ctx, patientID));
        return JSON.stringify(page.records);
    }
    // The function retrieves all requests fro the patientID from the ledger.
    async GetProcessedRequestsForPatientPage(ctx, patientID, pageSize, bookmark) {
        this._requireActor(ctx, patientID, 'patient');
        pageSize = pageSize || '100';
        bookmark = bookmark || '';
        const page = await this._queryIndexPage(ctx, 'EDR_ACCESS_PATIENT', [patientID], pageSize, bookmark);
        page.records = page.records.filter((record) => ['ACTIVE', 'COMPLETED', 'REVOKED', 'EXPIRED', 'REJECTED'].includes(record.status));
        page.fetchedRecordsCount = page.records.length;
        return JSON.stringify(page);
    }

    async GetProcessedRequestsForPatient(ctx, patientID) {
        const page = JSON.parse(await this.GetProcessedRequestsForPatientPage(ctx, patientID));
        return JSON.stringify(page.records);
    }
    async GetAllRequestsForPatientPage(ctx, patientID, pageSize, bookmark) {
        this._requireActor(ctx, patientID, 'patient');
        pageSize = pageSize || '100';
        bookmark = bookmark || '';
        const page = await this._queryIndexPage(ctx, 'EDR_ACCESS_PATIENT', [patientID], pageSize, bookmark);
        page.records = page.records.map((record) => record.status === 'ACTIVE'
            ? { ...record, status:'CONSENT_GRANTED', lifecycleStatus:'ACTIVE' }
            : { ...record, lifecycleStatus:record.status });
        return JSON.stringify(page);
    }

    async GetAllRequestsForPatient(ctx, patientID) {
        const page = JSON.parse(await this.GetAllRequestsForPatientPage(ctx, patientID));
        return JSON.stringify(page.records);
    }

    async GetRequestsForDoctorPage(ctx, doctorID, pageSize, bookmark) {
        this._requireActor(ctx, doctorID, 'doctor');
        pageSize = pageSize || '100';
        bookmark = bookmark || '';
        return JSON.stringify(await this._queryIndexPage(ctx, 'EDR_ACCESS_DOCTOR', [doctorID], pageSize, bookmark));
    }

    async GetRequestsForDoctor(ctx, doctorID) {
        const page = JSON.parse(await this.GetRequestsForDoctorPage(ctx, doctorID));
        return JSON.stringify(page.records);
    }

    async ReadDataAccessRequest(ctx, patientID, requestID) {
        this._requireActor(ctx, patientID, 'patient');
        const requestAsBytes = await ctx.stub.getState(requestID);
        if (!requestAsBytes || requestAsBytes.length === 0) {
            throw new Error(`Request ${requestID} not found`);
        }
        const request = JSON.parse(requestAsBytes.toString());
        if (request.docType !== 'accessRequest' || String(request.patientID) !== String(patientID)) {
            throw new Error(`Patient ${patientID} is not authorized to read request ${requestID}`);
        }
        return JSON.stringify(request);
    }

    async ReadTransferRequest(ctx, patientID, requestID) {
        return this.ReadDataAccessRequest(ctx, patientID, requestID);
    }
    
    
    async GetPatientData(ctx, doctorID, patientID) {
        this._requireActor(ctx, doctorID, 'doctor');
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`Patient ${patientID} not found`);
        }

        const patient = JSON.parse(patientAsBytes.toString());

        // ✅ Check if the doctor has been granted access
        const access = await this._requirePatientRecordAccess(ctx, patientID, patient, null, 'doctor');

        if (access.accessBasis === 'referral') {
            return JSON.stringify({
                medicalRecords: this._referralAllowsRecordType(access.referral, 'medical') ? patient.medicalRecords : undefined,
                dentalChart: this._referralAllowsRecordType(access.referral, 'dental') ? patient.dentalChart : undefined,
                referralID: access.requestID,
            });
        }

        return JSON.stringify({
            medicalRecords: patient.medicalRecords,
            dentalChart: patient.dentalChart,
        });
    }

    async RejectRequest(ctx, actorID, requestID, rejectionReason) {
        rejectionReason = String(rejectionReason || '').trim();
        if (!rejectionReason) throw new Error('A rejection reason is required.');
        if (Array.from(rejectionReason).length > 1000) throw new Error('Rejection reason must be 1000 characters or fewer.');
        const requestAsBytes = await ctx.stub.getState(requestID);
        if (!requestAsBytes || requestAsBytes.length === 0) {
            throw new Error(`Request ${requestID} not found`);
        }
    
        const request = JSON.parse(requestAsBytes.toString());

        let rejectedRole;
        if (request.status === 'PENDING_ADMIN_APPROVAL') {
            this._requireAdminClinic(ctx, request.dataOriginClinicID);
            actorID = ctx.clientIdentity.getAttributeValue('actorID') || actorID;
            rejectedRole = 'admin';
        } else if (request.status === 'PENDING_PATIENT_CONSENT') {
            this._requireActor(ctx, actorID, 'patient');
            if (actorID !== request.patientID) {
                throw new Error(`Patient ${actorID} is not authorized to reject this request.`);
            }
            rejectedRole = 'patient';
        }
    
        if (request.status === 'PENDING_ADMIN_APPROVAL' || request.status === 'PENDING_PATIENT_CONSENT') {
            const rejectedAt = this._txTimestamp(ctx);
            request.status = 'REJECTED';
            request.rejectionReason = rejectionReason;
            request.rejectedBy = actorID;
            request.rejectedRole = rejectedRole;
            request.rejectedAt = rejectedAt;
            request.rejectionTxID = ctx.stub.getTxID();
            request.decisionActorID = actorID;
            request.decisionActorRole = rejectedRole;
            request.decisionTransactionID = request.rejectionTxID;
            request.decisionTimestamp = rejectedAt;
    
            await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
            await this._deleteActiveRelationIndex(ctx, request);
            await this._emitPrivacySafeEvent(ctx, 'AccessRequestRejected', {
                requestID: request.requestID, patientID: request.patientID,
                doctorID: request.doctorID, status: request.status, rejectedRole,
            });
            const notification = await this._putNotification(ctx, {
                notificationID: `NOTIFICATION:${request.requestID}:DOCTOR_REJECTED`,
                recipientRole: 'doctor',
                recipientActorID: request.doctorID,
                type: 'ACCESS_REQUEST_REJECTED',
                relatedRequestID: request.requestID,
                message: `Access request ${requestID} was rejected by ${rejectedRole}.`,
                payload: {
                    requestID: request.requestID,
                    patientID: request.patientID,
                    dataType: request.dataType,
                    rejectionReason,
                    rejectedRole,
                },
                createdAt: rejectedAt,
            });
            return {
                success: true,
                requestID: request.requestID,
                patientID: request.patientID,
                doctorID: request.doctorID,
                dataOriginClinicID: request.dataOriginClinicID,
                status: request.status,
                accessGranted: false,
                rejectedBy: request.rejectedBy,
                rejectedRole: request.rejectedRole,
                rejectionReason: request.rejectionReason,
                rejectedAt: request.rejectedAt,
                decisionActorID: request.decisionActorID,
                decisionActorRole: request.decisionActorRole,
                decisionTransactionID: request.decisionTransactionID,
                decisionTimestamp: request.decisionTimestamp,
                message: `Request ${requestID} was rejected by ${actorID}.`,
                notification,
            };
        } else {
            throw new Error(`Request ${requestID} cannot be rejected at this stage.`);
        }
    }

    async RevokeConsent(ctx, patientID, requestID, revocationReason) {
        this._requireActor(ctx, patientID, 'patient');
        revocationReason = revocationReason || 'Patient revoked consent';
        const requestAsBytes = await ctx.stub.getState(requestID);
        if (!requestAsBytes || requestAsBytes.length === 0) {
            throw new Error(`Request ${requestID} not found`);
        }
        const request = JSON.parse(requestAsBytes.toString());
        if (request.patientID !== patientID) {
            throw new Error(`Patient ${patientID} is not authorized to revoke this request.`);
        }
        if (request.status !== 'ACTIVE') {
            throw new Error(`Request ${requestID} is not an active referral.`);
        }
        const revokedAt = this._txTimestamp(ctx);
        request.status = 'REVOKED';
        request.revokedAt = revokedAt;
        request.revocationReason = revocationReason;
        request.revocationTxID = ctx.stub.getTxID();
        request.decisionActorID = patientID;
        request.decisionActorRole = 'patient';
        request.decisionTransactionID = request.revocationTxID;
        request.decisionTimestamp = revokedAt;

        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
        await this._deleteActiveRelationIndex(ctx, request);
        await this._emitPrivacySafeEvent(ctx, 'PatientConsentRevoked', {
            requestID: request.requestID, patientID,
            doctorID: request.doctorID, status: request.status,
        });
        const notification = await this._putNotification(ctx, {
            notificationID: `NOTIFICATION:${request.requestID}:DOCTOR_CONSENT_REVOKED`,
            recipientRole: 'doctor',
            recipientActorID: request.doctorID,
            type: 'ACCESS_REQUEST_CONSENT_REVOKED',
            relatedRequestID: request.requestID,
            message: `Patient ${patientID} revoked consent for ${request.dataType}.`,
            payload: {
                requestID: request.requestID,
                patientID,
                dataType: request.dataType,
                revocationReason,
            },
            createdAt: revokedAt,
        });

        return {
            success: true,
            requestID: request.requestID,
            patientID: request.patientID,
            doctorID: request.doctorID,
            status: request.status,
            accessGranted: false,
            revokedAt: request.revokedAt,
            revocationReason: request.revocationReason,
            decisionActorID: request.decisionActorID,
            decisionActorRole: request.decisionActorRole,
            decisionTransactionID: request.decisionTransactionID,
            decisionTimestamp: request.decisionTimestamp,
            message: `Patient ${patientID} revoked consent for Doctor ${request.doctorID}.`,
            notification,
        };
    }

    async CompleteReferral(ctx, doctorID, requestID, completionSummary) {
        this._requireActor(ctx, doctorID, 'doctor');
        const requestBytes = await ctx.stub.getState(requestID);
        if (!requestBytes || !requestBytes.length) throw new Error(`Request ${requestID} not found`);
        const request = JSON.parse(requestBytes.toString());
        if (request.workflowType !== 'REFERRAL' || request.doctorID !== doctorID) {
            throw new Error(`Doctor ${doctorID} is not authorized to complete referral ${requestID}`);
        }
        if (request.status !== 'ACTIVE') throw new Error(`Referral ${requestID} is not active`);
        if (!String(completionSummary || '').trim()) throw new Error('A referral completion summary is required');
        request.status = 'COMPLETED';
        request.completedAt = this._txTimestamp(ctx);
        request.completedBy = doctorID;
        request.completionSummary = String(completionSummary).trim();
        request.completionTxID = ctx.stub.getTxID();
        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
        await this._deleteActiveRelationIndex(ctx, request);
        await this._emitPrivacySafeEvent(ctx, 'ReferralCompleted', {
            requestID: request.requestID, patientID: request.patientID,
            doctorID, status: request.status,
        });
        const notification = await this._putNotification(ctx, {
            notificationID: `NOTIFICATION:${request.requestID}:REFERRAL_COMPLETED`,
            recipientRole: 'admin', recipientClinicID: request.dataOriginClinicID,
            type: 'REFERRAL_COMPLETED', relatedRequestID: request.requestID,
            message: `Referral ${request.requestID} was completed by Doctor ${doctorID}.`,
            payload: { requestID: request.requestID, patientID: request.patientID, doctorID },
            createdAt: request.completedAt,
        });
        return { success:true, requestID, status:request.status, completedAt:request.completedAt, accessClosed:true, notification };
    }
    
    async LogAccess(ctx, doctorID, patientID, docType, accessMetadataJson) {
        this._requireRole(ctx, 'system');
        docType = String(docType || 'clinicalAccessLog');
        const accessMetadata = this._parseDetailsJson(accessMetadataJson || '{}');
        const transactionID = ctx.stub.getTxID();
        const logEntry = {
            docType: 'clinicalAccessLog',
            logID: `ACCESS:${transactionID}`,
            transactionID,
            actorID: doctorID,
            actorRole: 'doctor',
            doctorID,
            patientID,
            recordType: accessMetadata.recordType || docType,
            purpose: accessMetadata.purpose || 'authorized clinical access',
            requestID: accessMetadata.requestID || null,
            accessBasis: accessMetadata.accessBasis || 'system-verified',
            accessMetadata,
            timestamp: this._txTimestamp(ctx),
        };
    
        await ctx.stub.putState(logEntry.logID, Buffer.from(JSON.stringify(logEntry)));
        await this._emitPrivacySafeEvent(ctx, 'ClinicalAccessLogged', {
            logID: logEntry.logID, patientID, actorID: doctorID,
            actorRole: 'doctor', recordType: logEntry.recordType,
        });
    
        return JSON.stringify({ ...logEntry, success: true, message: `Access logged for Doctor ${doctorID} and Patient ${patientID}` });
    }

    async GetNotificationsForActor(ctx, recipientRole, recipientID, statusFilter) {
        statusFilter = statusFilter || 'ALL';
        const role = String(recipientRole || '').toLowerCase();
        if (role === 'admin') {
            this._requireAdminClinic(ctx, recipientID);
        } else if (role === 'patient') {
            this._requireActor(ctx, recipientID, 'patient');
        } else if (role === 'doctor') {
            this._requireActor(ctx, recipientID, 'doctor');
        } else {
            throw new Error('Unsupported notification recipient role.');
        }

        const normalizedStatus = String(statusFilter || 'ALL').toUpperCase();
        const iterator = await ctx.stub.getStateByRange('NOTIFICATION:', 'NOTIFICATION;');
        const notifications = [];
        try {
            for (;;) {
                const item = await iterator.next();
                if (item.value && item.value.value) {
                    const notification = JSON.parse(item.value.value.toString());
                    const roleMatches = notification.recipientRole === role;
                    const actorMatches = role === 'admin'
                        ? String(notification.recipientClinicID) === String(recipientID)
                        : String(notification.recipientActorID) === String(recipientID);
                    const statusMatches = normalizedStatus === 'ALL' || notification.status === normalizedStatus;
                    if (notification.docType === 'notification' && roleMatches && actorMatches && statusMatches) {
                        notifications.push(notification);
                    }
                }
                if (item.done) break;
            }
        } finally {
            if (iterator.close) await iterator.close();
        }
        return JSON.stringify(notifications.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    }

    async MarkNotificationRead(ctx, notificationID) {
        const notificationBytes = await ctx.stub.getState(notificationID);
        if (!notificationBytes || notificationBytes.length === 0) {
            throw new Error(`Notification ${notificationID} not found`);
        }
        const notification = JSON.parse(notificationBytes.toString());
        this._requireNotificationOwner(ctx, notification);
        if (notification.status === 'READ') return JSON.stringify({ ...notification, alreadyRead:true, idempotent:true, message:'Notification was already marked as read' });
        notification.status = 'READ';
        notification.readAt = this._txTimestamp(ctx);
        await ctx.stub.putState(notification.notificationID, Buffer.from(JSON.stringify(notification)));
        return JSON.stringify({ ...notification, alreadyRead:false, idempotent:false });
    }

    async _addClinicalMetadata(ctx, recordType, recordID, patientID, offChainRef, dataHash, doctorID, createdAt) {
        this._requireActor(ctx, doctorID, 'doctor');
        const patientBytes = await ctx.stub.getState(patientID);
        if (!patientBytes || patientBytes.length === 0) throw new Error(`Patient ${patientID} does not exist`);
        const patient = JSON.parse(patientBytes.toString());
        const access = await this._requirePatientRecordAccess(ctx, patientID, patient, recordType, 'doctor');
        if (!/^[a-f0-9]{64}$/i.test(dataHash)) throw new Error('Clinical record SHA-256 hash must contain 64 hexadecimal characters');
        const existingBytes = await ctx.stub.getState(`CLINICAL:${recordID}`);
        if (existingBytes && existingBytes.length) {
            const existing = JSON.parse(existingBytes.toString());
            if (existing.patientID !== patientID || existing.recordType !== recordType || existing.dataHash !== dataHash.toLowerCase()) throw new Error(`IDEMPOTENCY_KEY_REUSED: Clinical record ${recordID} already exists with different content`);
            return JSON.stringify({ ...existing, alreadyProcessed:true, idempotent:true, message:'Clinical record metadata was already committed' });
        }
        const doctorBytes = await ctx.stub.getState(doctorID);
        const doctor = doctorBytes && doctorBytes.length ? JSON.parse(doctorBytes.toString()) : {};
        const metadata = { docType: 'clinicalRecordMetadata', recordType, recordID, patientID, offChainRef, dataHash: dataHash.toLowerCase(), doctorID, originClinicID:doctor.clinicID || null, referralID:access.requestID || null, createdAt };
        await ctx.stub.putState(`CLINICAL:${recordID}`, Buffer.from(JSON.stringify(metadata)));
        patient.clinicalRecordIDs = Array.isArray(patient.clinicalRecordIDs) ? patient.clinicalRecordIDs : [];
        if (!patient.clinicalRecordIDs.includes(recordID)) patient.clinicalRecordIDs.push(recordID);
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(metadata);
    }

    async AddMedicalRecord(ctx, recordID, patientID, offChainRef, dataHash, doctorID, createdAt) {
        return this._addClinicalMetadata(ctx, 'medical', recordID, patientID, offChainRef, dataHash, doctorID, createdAt);
    }

    async AddDentalChartEntry(ctx, recordID, patientID, offChainRef, dataHash, doctorID, createdAt) {
        return this._addClinicalMetadata(ctx, 'dental', recordID, patientID, offChainRef, dataHash, doctorID, createdAt);
    }

    async addDentalChartEntry(ctx, ...args) { return this.AddDentalChartEntry(ctx, ...args); }

    async _getClinicalMetadata(ctx, patientID, recordType) {
        const patientBytes = await ctx.stub.getState(patientID);
        if (!patientBytes || patientBytes.length === 0) throw new Error(`Patient ${patientID} does not exist`);
        const patient = JSON.parse(patientBytes.toString());
        await this._requirePatientRecordAccess(ctx, patientID, patient, recordType, 'doctor', 'patient');
        const records = [];
        for (const id of patient.clinicalRecordIDs || []) {
            const bytes = await ctx.stub.getState(`CLINICAL:${id}`);
            if (bytes && bytes.length) { const item = JSON.parse(bytes.toString()); if (!recordType || item.recordType === recordType) records.push(item); }
        }
        return JSON.stringify(records);
    }

    async GetMedicalRecords(ctx, patientID) { return this._getClinicalMetadata(ctx, patientID, 'medical'); }
    async GetAllDentalChartData(ctx, patientID) { return this._getClinicalMetadata(ctx, patientID, 'dental'); }
    async getAllDentalChartData(ctx, patientID) { return this.GetAllDentalChartData(ctx, patientID); }

    async LogClinicalAccess(ctx, patientID, recordType, purpose) {
        const patientBytes = await ctx.stub.getState(patientID);
        if (!patientBytes || patientBytes.length === 0) throw new Error(`Patient ${patientID} does not exist`);
        const patient = JSON.parse(patientBytes.toString());
        const identity = await this._requirePatientRecordAccess(ctx, patientID, patient, recordType, 'doctor', 'patient');
        const actorID = identity.actorID;
        let accessBasis = identity.role === 'patient' ? 'owner' : identity.role;
        let requestID = null;
        if (identity.role === 'doctor') {
            if (identity.accessBasis === 'assignment') {
                accessBasis = 'assignment';
            } else if (identity.accessBasis === 'referral') {
                accessBasis = 'referral';
                requestID = identity.requestID;
            }
        }
        const timestamp = this._txTimestamp(ctx);
        const transactionID = ctx.stub.getTxID();
        const doctorID = identity.role === 'doctor' ? actorID : null;
        const accessMetadata = { recordType, purpose, requestID, accessBasis };
        const logEntry = { docType: 'clinicalAccessLog', logID: `ACCESS:${transactionID}`, transactionID, actorID, actorRole: identity.role, doctorID, patientID, recordType, purpose, requestID, accessBasis, accessMetadata, timestamp };
        await ctx.stub.putState(logEntry.logID, Buffer.from(JSON.stringify(logEntry)));
        await this._emitPrivacySafeEvent(ctx, 'ClinicalAccessLogged', {
            logID: logEntry.logID, patientID, actorID,
            actorRole: identity.role, recordType,
        });
        return JSON.stringify(logEntry);
    }

    async GetClinicalAccessLogs(ctx, patientID) {
        const identity = this._requireRole(ctx, 'admin', 'patient', 'system');
        if (identity.role === 'patient') this._requireActor(ctx, patientID, 'patient');
        if (identity.role === 'admin') {
            const patientBytes = await ctx.stub.getState(patientID);
            if (!patientBytes || patientBytes.length === 0) throw new Error(`Patient ${patientID} does not exist`);
            const patient = JSON.parse(patientBytes.toString());
            this._requireAdminClinic(ctx, patient.clinicID || (Array.isArray(patient.clinicIDs) ? patient.clinicIDs[0] : undefined));
        }
        const iterator = await ctx.stub.getStateByRange('ACCESS:', 'ACCESS;');
        const logs = [];
        for (;;) { const item = await iterator.next(); if (item.value?.value) { const log = JSON.parse(item.value.value.toString()); if (log.patientID === patientID) logs.push(log); } if (item.done) break; }
        await iterator.close();
        return JSON.stringify(logs);
    }

    // Store only immutable radiographic file metadata on-chain. File bytes remain off-chain.
    async AddDentalFileMetadata(ctx, fileID, patientID, storageReference, fileName, mediaType, fileSize, sha256, uploaderID, uploadedAt) {
        this._requireActor(ctx, uploaderID, 'doctor');
        const normalizedFileID = String(fileID || '').trim();
        const normalizedReference = String(storageReference || '').trim();
        const normalizedFileName = String(fileName || '').trim();
        const normalizedMediaType = String(mediaType || '').trim().toLowerCase();
        const normalizedFileSize = Number(fileSize);
        if (!normalizedFileID) throw new Error('FILE_ID_REQUIRED: Radiographic file ID is required');
        if (!normalizedReference) throw new Error('CONTENT_REFERENCE_REQUIRED: Off-chain storage reference/file path is required');
        if (normalizedReference !== `filesystem:${normalizedFileID}`) throw new Error('INVALID_CONTENT_REFERENCE: Off-chain storage reference must match the radiographic file ID');
        if (!normalizedFileName || normalizedFileName.length > 255) throw new Error('INVALID_FILE_NAME: File name is required and must not exceed 255 characters');
        if (!['application/dicom','image/jpeg','image/png'].includes(normalizedMediaType)) throw new Error('INVALID_MEDIA_TYPE: Radiographic media type must be DICOM, JPEG, or PNG');
        if (!Number.isSafeInteger(normalizedFileSize) || normalizedFileSize <= 0) throw new Error('INVALID_FILE_SIZE: Radiographic file size must be a positive integer');
        const exists = await this._actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        const patientAsBytes = await ctx.stub.getState(patientID);
        const patient = JSON.parse(patientAsBytes.toString());
        await this._requirePatientRecordAccess(ctx, patientID, patient, 'dicom', 'doctor');

        if (!/^[a-f0-9]{64}$/i.test(sha256)) {
            throw new Error('SHA-256 hash must contain exactly 64 hexadecimal characters');
        }
        const existingBytes = await ctx.stub.getState(`RADFILE:${normalizedFileID}`);
        if (existingBytes && existingBytes.length) {
            const existing = JSON.parse(existingBytes.toString());
            if (existing.patientID !== patientID || existing.sha256 !== sha256.toLowerCase()) throw new Error(`IDEMPOTENCY_KEY_REUSED: Radiographic file ${normalizedFileID} already exists with different content`);
            return JSON.stringify({ ...existing, alreadyProcessed:true, idempotent:true, message:'Radiographic file metadata was already committed' });
        }
        const fileEntry = {
            docType: 'radiographicFileMetadata',
            fileID: normalizedFileID,
            patientID,
            storageReference: normalizedReference,
            fileName: normalizedFileName,
            mediaType: normalizedMediaType,
            fileSize: normalizedFileSize,
            sha256: sha256.toLowerCase(),
            uploaderID,
            uploadedAt
        };
        await ctx.stub.putState(`RADFILE:${normalizedFileID}`, Buffer.from(JSON.stringify(fileEntry)));
        patient.dentalFileIDs = Array.isArray(patient.dentalFileIDs) ? patient.dentalFileIDs : [];
        if (!patient.dentalFileIDs.includes(normalizedFileID)) patient.dentalFileIDs.push(normalizedFileID);
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(fileEntry);
    }

    async addDentalFile(ctx, patientID, cid, fileName, fileType, uploaderID, uploadDate) {
        throw new Error('Legacy CID upload is disabled; use AddDentalFileMetadata with an off-chain reference and SHA-256 hash');
    }

    // Get all dental files stored for a patient
    async getDentalFiles(ctx, patientID) {
        const patientJSON = await ctx.stub.getState(patientID);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        const patient = JSON.parse(patientJSON.toString());
        await this._requirePatientRecordAccess(ctx, patientID, patient, 'dicom', 'admin', 'doctor', 'patient', 'system');
        const files = [];
        for (const fileID of patient.dentalFileIDs || []) {
            const bytes = await ctx.stub.getState(`RADFILE:${fileID}`);
            if (bytes && bytes.length) files.push(JSON.parse(bytes.toString()));
        }
        return JSON.stringify(files);
    }

    async GetDentalFile(ctx, fileID) {
        const bytes = await ctx.stub.getState(`RADFILE:${fileID}`);
        if (!bytes || bytes.length === 0) throw new Error(`Dental file ${fileID} does not exist`);
        const file = JSON.parse(bytes.toString());
        const patientBytes = await ctx.stub.getState(file.patientID);
        if (!patientBytes || patientBytes.length === 0) throw new Error(`The patient ${file.patientID} does not exist`);
        const patient = JSON.parse(patientBytes.toString());
        await this._requirePatientRecordAccess(ctx, file.patientID, patient, 'dicom', 'admin', 'doctor', 'patient', 'system');
        return JSON.stringify(file);
    }


    
}

module.exports = DentalRecordSharing;
