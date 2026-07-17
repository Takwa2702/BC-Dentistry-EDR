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

    _requirePatientRecordAccess(ctx, patientID, patient, ...allowedRoles) {
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
            const sharedDoctors = Array.isArray(patient.sharedWith) ? patient.sharedWith : [];
            if (!assignedDoctors.includes(actorID) && !sharedDoctors.includes(actorID)) {
                throw new Error(`Access denied: Doctor ${actorID} is not assigned or consented for patient ${patientID}.`);
            }
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
        const iterator = await ctx.stub.getStateByRange('', '');
        try {
            for (;;) {
                const result = await iterator.next();
                if (result.value && result.value.value) {
                    try {
                        const record = JSON.parse(result.value.value.toString());
                        if (
                            record.docType === 'accessRequest'
                            && record.patientID === patientID
                            && record.doctorID === doctorID
                            && record.requestID !== excludeRequestID
                            && record.status === 'CONSENT_GRANTED'
                        ) {
                            return record;
                        }
                    } catch (error) {
                        // Ignore non-JSON world-state entries from sample data.
                    }
                }

                if (result.done) {
                    break;
                }
            }
        } finally {
            if (iterator.close) {
                await iterator.close();
            }
        }
        return null;
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
                speciality: 'Orthodontist',
                worksAt: 'Dental Clinic A',
                clinicID: 1,
                email: 'alice.wong@example.com',
                contactNumber: '0509876543',
                role: 'doctor',
                createdDate: "2025-06-13T00:00:00.000Z",// new Date().toISOString(),
                patients: ['Patient1', 'Patient3']  // Pre-assigned patients
            },
            {
                doctorID: 'Doctor2',
                firstName: 'Bob',
                lastName: 'Smith',
                speciality: 'Endodontist',
                worksAt: 'Dental Clinic B',
                clinicID: 2,
                email: 'bob.smith@example.com',
                contactNumber: '0509871234',
                role: 'doctor',
                createdDate: "2025-06-13T00:00:00.000Z",
                patients: ['Patient2']
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
                createdDate: "2025-06-13T00:00:00.000Z",
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
                createdDate: "2025-06-13T00:00:00.000Z",
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
                createdDate: "2025-06-13T00:00:00.000Z",
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
  
            const exists = await this._actorExists(ctx, emiratesID);
            if (exists) {
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
                createdDate: createdDate,
                patients: parseArrayArgument(patients)
            };
    
            doctor.docType = 'doctor';
            await ctx.stub.putState(doctorID, Buffer.from(JSON.stringify(doctor)));
    
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
            const exists = await this._actorExists(ctx, emiratesID);
            if (exists) {
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
            sharedWith: [], createdDate, modifiedDate: createdDate,
            storagePolicy: 'PII_OFF_CHAIN_MYSQL'
        };
        await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
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
            docType: 'patient', patientID, role: 'patient', clinicID: parseInt(clinicID), clinicIDs: [parseInt(clinicID)],
            offChainRef, dataHash: dataHash.toLowerCase(), doctors: parseArrayArgument(doctors),
            sharedWith: existing.sharedWith || [], createdDate: existing.createdDate || modifiedDate, modifiedDate,
            storagePolicy: 'PII_OFF_CHAIN_MYSQL'
        };
        await ctx.stub.putState(patientID, Buffer.from(stringify(sortKeysRecursive(patient))));
        return JSON.stringify(patient);
    }


    // actorExists returns true when doctor or patient with given ID exists in world state.
    async _actorExists(ctx, actorID) {
        const actorJSON = await ctx.stub.getState(actorID);
        return actorJSON && actorJSON.length > 0;
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
        this._requirePatientRecordAccess(ctx, id, patient, 'admin', 'doctor', 'patient', 'system');
        return patientJSON.toString();
    }


    async GetPatientsByClinic(ctx, clinicID) {
        const identity = this._requireRole(ctx, 'admin', 'system');
        if (identity.role === 'admin') {
            this._requireAdminClinic(ctx, clinicID);
        }
        clinicID = parseInt(clinicID); // Ensure the clinicID is a number
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
    
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
    
            if (record.docType === 'patient' && record.clinicIDs.includes(clinicID)) {
                allResults.push(record);
            }
            result = await iterator.next();
        }
    
        return JSON.stringify(allResults);
    }
    
    // UpdateDoctor updates an existing doctor in the world state with provided parameters.
    async UpdateDoctorInfo(ctx, doctorID, firstName, lastName, emiratesID, speciality, worksAt, clinicID, email, contactNumber, licenseNumber, createdDate, patients) {
        this._requireAdminClinic(ctx, clinicID);
        const exists = await this._actorExists(ctx, doctorID);
        if (!exists) {
            throw new Error(`The doctor ${doctorID} does not exist`);
        }

        // overwriting original doctor with new doctor
        const updatedDoctor = {
            doctorID: doctorID,
            firstName: firstName,
            lastName: lastName,
            emiratesID: emiratesID,
            speciality: speciality,
            clinicID:clinicID,
            worksAt: worksAt,
            email: email,
            contactNumber: contactNumber,
            licenseNumber: licenseNumber,
            role: 'doctor',
            createdDate: createdDate,
            patients: parseArrayArgument(patients),
            docType: 'doctor'
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

    // DeleteDoctor deletes an given doctor from the world state.
    async DeleteDoctor(ctx, id) {
        this._requireRole(ctx, 'admin');
        const exists = await this._actorExists(ctx, id);
        if (!exists) {
            throw new Error(`The doctor ${id} does not exist`);
        }
        const doctor = JSON.parse((await ctx.stub.getState(id)).toString());
        this._requireAdminClinic(ctx, doctor.clinicID);
        return ctx.stub.deleteState(id);
    }

    // DeletePatient deletes an given patient from the world state.
    async DeletePatient(ctx, id) {
        this._requireRole(ctx, 'admin');
        const exists = await this._actorExists(ctx, id);
        if (!exists) {
            throw new Error(`The patient ${id} does not exist`);
        }
        const patient = JSON.parse((await ctx.stub.getState(id)).toString());
        this._requireAdminClinic(ctx, patient.clinicID || (patient.clinicIDs || [])[0]);
        return ctx.stub.deleteState(id);
    }
   

    // GetAllDoctors returns all doctors found in the world state.
    async GetAllDoctors(ctx) {
        this._requireRole(ctx, 'admin', 'system');
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
    
        // Iterate through all records in the ledger
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
    
            // Filter only the doctor records
            if (record.docType === 'doctor') {
                allResults.push(record);
            }
            result = await iterator.next();
        }
    
        // Return all doctor records in JSON format
        return JSON.stringify(allResults);
    }

    // GetAllPatients returns all patients found in the world state.
    async GetAllPatients(ctx) {
        this._requireRole(ctx, 'admin', 'system');
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
    
        // Iterate through all records in the ledger
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
    
            // Filter only the doctor records
            if (record.docType === 'patient') {
                allResults.push(record);
            }
            result = await iterator.next();
        }
    
        // Return all patient records in JSON format
        return JSON.stringify(allResults);
    }


// Doctor: AddDentalChart adds a dental chart to an existing patient
    // Add or update a dental chart entry for a specific patient
    async addDentalChartEntry(ctx, patientID, site, surface, category, subCategory, code, status, preAuth, phase, discipline, diagnoses, notes, estimate, doctorID, auditDate, createdDate) {
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
        this._requirePatientRecordAccess(ctx, patientID, patient, 'admin', 'doctor', 'patient', 'system');
        const dentalChartEntry = patient.dentalChart.find(entry => entry.Site === site && entry.Suf === surface);

        if (!dentalChartEntry) {
            throw new Error(`No dental chart entry found for site ${site} and surface ${surface}`);
        }

        return JSON.stringify(dentalChartEntry);
    }

    // Get all dental chart data for a specific patient
    async getAllDentalChartData(ctx, patientID) {
        const patientJSON = await ctx.stub.getState(patientID);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        const patient = JSON.parse(patientJSON.toString());
        this._requirePatientRecordAccess(ctx, patientID, patient, 'admin', 'doctor', 'patient', 'system');

        return JSON.stringify(patient.dentalChart);
    }


    // Add a medical record for a patient
    async AddMedicalRecord(ctx, patientID, medicalRecord) {
        this._requireRole(ctx, 'doctor');
        // Check if the patient existsaddDentalChartEntry
        const exists = await this._actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        // Retrieve the patient's current data
        const patientAsBytes = await ctx.stub.getState(patientID);
        const patient = JSON.parse(patientAsBytes.toString());
        this._requirePatientRecordAccess(ctx, patientID, patient, 'doctor');

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
    async GetMedicalRecords(ctx, patientID) {
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
        this._requirePatientRecordAccess(ctx, patientID, patient, 'doctor', 'patient');
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
    async assignPatientToDoctor(ctx, patientID, doctorID) {
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
    
        // ✅ Ensure at least one shared clinic between the doctor and patient
        const doctorClinicID = parseInt(doctor.clinicID);
        const sharedClinics = patient.clinicIDs.map(Number).filter(clinic => clinic === doctorClinicID);
        if (sharedClinics.length === 0) {
            throw new Error(`Doctor ${doctorID} and Patient ${patientID} do not belong to the same clinic`);
        }
    
        // ✅ Prevent duplicate assignment
        if (!doctor.patients.includes(patientID)) {
            doctor.patients.push(patientID);
            await ctx.stub.putState(doctorID, Buffer.from(JSON.stringify(doctor)));
        }
    
        if (!patient.doctors.includes(doctorID)) {
            patient.doctors.push(doctorID);
            await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        }
    
        return { success: true, message: `Patient ${patientID} assigned to Doctor ${doctorID}` };
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

        // Ensure the patient has data at the requested clinic
        if (!patient.clinicIDs.includes(parseInt(dataOriginClinicID))) {
            throw new Error(`Patient ${patientID} does not have data in Clinic ${dataOriginClinicID}`);
        }

        const request = {
            docType: 'accessRequest',
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
            purpose: String(purpose || 'clinical consultation'),
            reason: String(details.reason || purpose || 'clinical consultation'),
            requestedAt,
            requestedBy: doctorID,
            adminApprovedAt: null,
            patientConsentedAt: null,
            revokedAt: null,
            details,
            status: 'PENDING_ADMIN_APPROVAL',
        };

        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
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
        if (request.dataOriginClinicID !== adminClinicID) {
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
        await this._putNotification(ctx, {
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
    
        return { success: true, message: `Request ${requestID} approved by Admin from Clinic ${adminClinicID}.` };
    }

    //Admin gets all request related to clinic
    async GetRequestsForAdmin(ctx, adminClinicID) {
        this._requireAdminClinic(ctx, adminClinicID);
        adminClinicID = parseInt(adminClinicID);
    
        const allRequests = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
    
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
    
            // Filter only requests where `dataOriginClinicID` matches admin's clinic && record.status !== 'CONSENT_GRANTED'
            if (record.dataOriginClinicID === adminClinicID ) {
                allRequests.push(record);
            }
            result = await iterator.next();
        }
    
        return JSON.stringify(allRequests);
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
        request.status = 'CONSENT_GRANTED';
        request.patientConsentedAt = consentedAt;
        request.consentActorID = identity.actorID;
        request.consentMSPID = identity.mspID;
        request.consentTxID = ctx.stub.getTxID();

        // Ensure `sharedWith` is initialized
        if (!patient.sharedWith) {
            patient.sharedWith = [];
        }

        // Prevent duplicate sharing
        if (!patient.sharedWith.includes(request.doctorID)) {
            patient.sharedWith.push(request.doctorID);
        }

        // Store the updated request and patient data on the ledger
        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
        await ctx.stub.putState(patient.patientID, Buffer.from(JSON.stringify(patient)));
        await this._putNotification(ctx, {
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

        return { success: true, message: `Patient ${patientID} granted consent for Doctor ${request.doctorID}.` };
    }

// Get Patient Data for the doctor if authorized
    // async GetPatientData(ctx, doctorID, patientID) {
    //     const patientAsBytes = await ctx.stub.getState(patientID);
    //     if (!patientAsBytes || patientAsBytes.length === 0) {
    //         throw new Error(`Patient ${patientID} not found`);
    //     }

    //     const patient = JSON.parse(patientAsBytes.toString());

    //     // Check if the doctor has access
    //     if (!patient.sharedWith || !patient.sharedWith.includes(doctorID)) {
    //         throw new Error(`Doctor ${doctorID} is not authorized to access patient ${patientID}'s data`);
    //     }

    //     return JSON.stringify({
    //         medicalHistory: patient.medicalHistory,
    //         dentalHistory: patient.dentalHistory,
    //     });
    // }
    async GetPendingRequestsForPatient(ctx, patientID) {
        this._requireActor(ctx, patientID, 'patient');
        const allRequests = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
    
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
    
            // ✅ Filter requests waiting for patient consent
            if (record.patientID === patientID && record.status === 'PENDING_PATIENT_CONSENT') {
                allRequests.push(record);
            }
            result = await iterator.next();
        }
    
        return JSON.stringify(allRequests);
    }
    // The function retrieves all requests fro the patientID from the ledger.
    async GetProcessedRequestsForPatient(ctx, patientID) {
        this._requireActor(ctx, patientID, 'patient');
        const allRequests = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
    
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
    
            // ✅ Filter only requests where the patientID matches and status is "APPROVED" or "REJECTED"
            if (record.patientID === patientID && ['CONSENT_GRANTED', 'REJECTED'].includes(record.status)) {
                allRequests.push(record);
            }
            result = await iterator.next();
        }
    
        return JSON.stringify(allRequests);
    }
    async GetAllRequestsForPatient(ctx, patientID) {
        this._requireActor(ctx, patientID, 'patient');
        const allRequests = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
    
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
    
            // ✅ Retrieve all requests related to the given patient
            if (record.docType === 'accessRequest' && record.patientID === patientID) {
                allRequests.push(record);
            }
            result = await iterator.next();
        }
    
        return JSON.stringify(allRequests);
    }
    
    
    async GetPatientData(ctx, doctorID, patientID) {
        this._requireActor(ctx, doctorID, 'doctor');
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`Patient ${patientID} not found`);
        }

        const patient = JSON.parse(patientAsBytes.toString());

        // ✅ Check if the doctor has been granted access
        if (!patient.sharedWith || !patient.sharedWith.includes(doctorID)) {
            throw new Error(`Doctor ${doctorID} is not authorized to access patient ${patientID}'s data.`);
        }

        return JSON.stringify({
            medicalRecords: patient.medicalRecords,
            dentalChart: patient.dentalChart,
        });
    }

    async RejectRequest(ctx, actorID, requestID, rejectionReason) {
        const requestAsBytes = await ctx.stub.getState(requestID);
        if (!requestAsBytes || requestAsBytes.length === 0) {
            throw new Error(`Request ${requestID} not found`);
        }
    
        const request = JSON.parse(requestAsBytes.toString());

        let rejectedRole;
        if (request.status === 'PENDING_ADMIN_APPROVAL') {
            this._requireAdminClinic(ctx, request.dataOriginClinicID);
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
    
            await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
            await this._putNotification(ctx, {
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
            return { success: true, message: `Request ${requestID} was rejected by ${actorID}.` };
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
        if (request.status !== 'CONSENT_GRANTED') {
            throw new Error(`Request ${requestID} does not have active consent.`);
        }

        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`Patient ${patientID} not found`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        const revokedAt = this._txTimestamp(ctx);
        request.status = 'CONSENT_REVOKED';
        request.revokedAt = revokedAt;
        request.revocationReason = revocationReason;
        request.revocationTxID = ctx.stub.getTxID();

        const otherConsent = await this._findGrantedConsentRequest(ctx, patientID, request.doctorID, requestID);
        if (!otherConsent && Array.isArray(patient.sharedWith)) {
            patient.sharedWith = patient.sharedWith.filter((doctorID) => doctorID !== request.doctorID);
        }

        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
        await ctx.stub.putState(patient.patientID, Buffer.from(JSON.stringify(patient)));
        await this._putNotification(ctx, {
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

        return { success: true, message: `Patient ${patientID} revoked consent for Doctor ${request.doctorID}.` };
    }
    
    async LogAccess(ctx, doctorID, patientID) {
        this._requireRole(ctx, 'system');
        const logEntry = {
            logID: ctx.stub.getTxID(),
            doctorID: doctorID,
            patientID: patientID,
            timestamp: new Date().toISOString(),
        };
    
        await ctx.stub.putState(logEntry.logID, Buffer.from(JSON.stringify(logEntry)));
    
        return { success: true, message: `Access logged for Doctor ${doctorID} and Patient ${patientID}` };
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
        notification.status = 'READ';
        notification.readAt = this._txTimestamp(ctx);
        await ctx.stub.putState(notification.notificationID, Buffer.from(JSON.stringify(notification)));
        return JSON.stringify(notification);
    }

    async _addClinicalMetadata(ctx, recordType, recordID, patientID, offChainRef, dataHash, doctorID, createdAt) {
        this._requireActor(ctx, doctorID, 'doctor');
        const patientBytes = await ctx.stub.getState(patientID);
        if (!patientBytes || patientBytes.length === 0) throw new Error(`Patient ${patientID} does not exist`);
        const patient = JSON.parse(patientBytes.toString());
        this._requirePatientRecordAccess(ctx, patientID, patient, 'doctor');
        if (!/^[a-f0-9]{64}$/i.test(dataHash)) throw new Error('Clinical record SHA-256 hash must contain 64 hexadecimal characters');
        const metadata = { docType: 'clinicalRecordMetadata', recordType, recordID, patientID, offChainRef, dataHash: dataHash.toLowerCase(), doctorID, createdAt };
        await ctx.stub.putState(`CLINICAL:${recordID}`, Buffer.from(JSON.stringify(metadata)));
        patient.clinicalRecordIDs = Array.isArray(patient.clinicalRecordIDs) ? patient.clinicalRecordIDs : [];
        patient.clinicalRecordIDs.push(recordID);
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
        this._requirePatientRecordAccess(ctx, patientID, patient, 'doctor', 'patient');
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
        const identity = this._requirePatientRecordAccess(ctx, patientID, patient, 'doctor', 'patient');
        const actorID = identity.actorID;
        const assignedDoctors = Array.isArray(patient.doctors) ? patient.doctors : [];
        const sharedDoctors = Array.isArray(patient.sharedWith) ? patient.sharedWith : [];
        let accessBasis = identity.role === 'patient' ? 'owner' : identity.role;
        let requestID = null;
        if (identity.role === 'doctor') {
            if (assignedDoctors.includes(actorID)) {
                accessBasis = 'assignment';
            } else if (sharedDoctors.includes(actorID)) {
                accessBasis = 'consent';
                const consentRequest = await this._findGrantedConsentRequest(ctx, patientID, actorID);
                requestID = consentRequest ? consentRequest.requestID : null;
            }
        }
        const timestamp = this._txTimestamp(ctx);
        const logEntry = { docType: 'clinicalAccessLog', logID: `ACCESS:${ctx.stub.getTxID()}`, actorID, actorRole: identity.role, patientID, recordType, purpose, requestID, accessBasis, timestamp };
        await ctx.stub.putState(logEntry.logID, Buffer.from(JSON.stringify(logEntry)));
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
        const exists = await this._actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        const patientAsBytes = await ctx.stub.getState(patientID);
        const patient = JSON.parse(patientAsBytes.toString());
        this._requirePatientRecordAccess(ctx, patientID, patient, 'doctor');

        if (!/^[a-f0-9]{64}$/i.test(sha256)) {
            throw new Error('SHA-256 hash must contain exactly 64 hexadecimal characters');
        }
        const fileEntry = {
            docType: 'radiographicFileMetadata',
            fileID,
            patientID,
            storageReference,
            fileName,
            mediaType,
            fileSize: Number(fileSize),
            sha256: sha256.toLowerCase(),
            uploaderID,
            uploadedAt
        };
        await ctx.stub.putState(`RADFILE:${fileID}`, Buffer.from(JSON.stringify(fileEntry)));
        patient.dentalFileIDs = Array.isArray(patient.dentalFileIDs) ? patient.dentalFileIDs : [];
        patient.dentalFileIDs.push(fileID);
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
        this._requirePatientRecordAccess(ctx, patientID, patient, 'admin', 'doctor', 'patient', 'system');
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
        this._requirePatientRecordAccess(ctx, file.patientID, patient, 'admin', 'doctor', 'patient', 'system');
        return JSON.stringify(file);
    }


    
}

module.exports = DentalRecordSharing;
