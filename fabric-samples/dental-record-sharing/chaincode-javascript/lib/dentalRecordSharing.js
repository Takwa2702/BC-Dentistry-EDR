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

class DentalRecordSharing extends Contract {

    async InitLedger(ctx) {
        
        await this.InitDoctors(ctx);
        
        await this.InitPatients(ctx);
    }


    async InitDoctors(ctx) {
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
 

    async addDoctor(ctx, doctorID, firstName, lastName, emiratesID, speciality, worksAt, clinicID, email, contactNumber, createdDate, patients) {
        // try {
            // // Get the creator's identity
            // const creator = ctx.clientIdentity.getIDBytes().toString();
            // const attributes = JSON.parse(Buffer.from(creator, 'base64').toString());
            
            // // Check the role of the user
            // const roleAttr = attributes.attributes.find(attr => attr.name === 'role');
            // if (!roleAttr || roleAttr.value !== 'admin') {
            //     throw new Error('Only admins can add doctors.');
            // }
  
            const exists = await this.actorExists(ctx, emiratesID);
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
                clinicID: clinicID,
                email: email,
                contactNumber: contactNumber,
                role: 'doctor',
                createdDate: createdDate,
                patients: patients
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
        // try {
        //     //only admin can add patients 
        //     const isAdmin = ctx.clientIdentity.assertAttributeValue('role', 'admin');
        //     if (!isAdmin) {
        //         throw new Error('Only admins can add patients.');
        //     }
            // Check if patient already exists
            const exists = await this.actorExists(ctx, emiratesID);
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
                doctors: doctors,  // Pre-assigned doctors
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


    // actorExists returns true when doctor or patient with given ID exists in world state.
    async actorExists(ctx, actorID) {
        const actorJSON = await ctx.stub.getState(actorID);
        return actorJSON && actorJSON.length > 0;
    }
 

    // ReadDoctor returns the doctor stored in the world state with given id.
    async ReadDoctor(ctx, id) {
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
        return patientJSON.toString();
    }


    async GetPatientsByClinic(ctx, clinicID) {
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
    async UpdateDoctorInfo(ctx, doctorID, firstName, lastName, speciality, worksAt, clinicID, email, contactNumber, createdDate, patients) {
        const exists = await this.actorExists(ctx, doctorID);
        if (!exists) {
            throw new Error(`The doctor ${doctorID} does not exist`);
        }

        // overwriting original doctor with new doctor
        const updatedDoctor = {
            doctorID: doctorID,
            firstName: firstName,
            lastName: lastName,
            speciality: speciality,
            clinicID:clinicID,
            worksAt: worksAt,
            email: email,
            contactNumber: contactNumber,
            role: 'doctor',
            createdDate: createdDate,
            patients: patients
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        return ctx.stub.putState(doctorID, Buffer.from(stringify(sortKeysRecursive(updatedDoctor))));
    }

    // UpdatePatient updates an existing patient in the world state with provided parameters.
    async UpdatePatientInfo(ctx, patientID, firstName, lastName, dateOfBirth, gender, emiratesID, email, contactNumber, address, createdDate, doctors, clinicID,
        dentalChart) {
        const exists = await this.actorExists(ctx, patientID);
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
        const exists = await this.actorExists(ctx, id);
        if (!exists) {
            throw new Error(`The doctor ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }

    // DeletePatient deletes an given patient from the world state.
    async DeletePatient(ctx, id) {
        const exists = await this.actorExists(ctx, id);
        if (!exists) {
            throw new Error(`The patient ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }
   

    // GetAllDoctors returns all doctors found in the world state.
    async GetAllDoctors(ctx) {
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
        const exists = await this.actorExists(ctx, patientID);
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

        return JSON.stringify(patient.dentalChart);
    }


    // Add a medical record for a patient
    async AddMedicalRecord(ctx, patientID, medicalRecord) {
        // Check if the patient existsaddDentalChartEntry
        const exists = await this.actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        // Retrieve the patient's current data
        const patientAsBytes = await ctx.stub.getState(patientID);
        const patient = JSON.parse(patientAsBytes.toString());

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
        const exists = await this.actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`Patient ${patientID} does not exist`);
        }

        // Retrieve the patient's current data
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`Patient ${patientID} does not exist`);
        }

        const patient = JSON.parse(patientAsBytes.toString());
        return patient.medicalRecords || []; // Return the medical records or an empty array
    }

    // register patient in clinic 
    async registerPatientInClinic(ctx, patientID, clinicID) {
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
        const sharedClinics = patient.clinicIDs.filter(clinic => clinic === doctor.clinicID);
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
    async RequestDataAccess(ctx, doctorID, patientID, dataOriginClinicID) {
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
            patientID,
            clinicID: patient.clinicIDs,  // Clinics the patient is registered in
            dataOriginClinicID: parseInt(dataOriginClinicID), // Where the data exists
            dataType: 'Dental and Medical Records',
            status: 'PENDING_ADMIN_APPROVAL',
        };

        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));

        return request.requestID;
    }

    // Admin of Hospital will review the data access request and approve or deny it.

    async ApproveRequest(ctx, adminID, requestID, adminClinicID) {
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
    
        request.status = 'PENDING_PATIENT_CONSENT';
    
        await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
    
        return { success: true, message: `Request ${requestID} approved by Admin from Clinic ${adminClinicID}.` };
    }

    //Admin gets all request related to clinic
    async GetRequestsForAdmin(ctx, adminClinicID) {
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

        request.status = 'CONSENT_GRANTED';

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
            if (record.patientID === patientID && record.status === 'PENDING_PATIENT_CONSENT') {
                allRequests.push(record);
            }
            result = await iterator.next();
        }
    
        return JSON.stringify(allRequests);
    }
    async GetAllRequestsForPatient(ctx, patientID) {
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
    
        if (request.status === 'PENDING_ADMIN_APPROVAL' || request.status === 'PENDING_PATIENT_CONSENT') {
            request.status = 'REJECTED';
            request.rejectionReason = rejectionReason;
    
            await ctx.stub.putState(request.requestID, Buffer.from(JSON.stringify(request)));
            return { success: true, message: `Request ${requestID} was rejected by ${actorID}.` };
        } else {
            throw new Error(`Request ${requestID} cannot be rejected at this stage.`);
        }
    }
    
    async LogAccess(ctx, doctorID, patientID) {
        const logEntry = {
            logID: ctx.stub.getTxID(),
            doctorID: doctorID,
            patientID: patientID,
            timestamp: new Date().toISOString(),
        };
    
        await ctx.stub.putState(logEntry.logID, Buffer.from(JSON.stringify(logEntry)));
    
        return { success: true, message: `Access logged for Doctor ${doctorID} and Patient ${patientID}` };
    }

    // Add a dental file entry to a patient's record (IPFS-based)
    async addDentalFile(ctx, patientID, cid, fileName, fileType, uploaderID, uploadDate) {
        const exists = await this.actorExists(ctx, patientID);
        if (!exists) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        const patientAsBytes = await ctx.stub.getState(patientID);
        const patient = JSON.parse(patientAsBytes.toString());

        if (!patient.dentalFiles) {
            patient.dentalFiles = [];
        }

        const fileEntry = {
            cid,
            fileName,
            fileType,
            uploaderID,
            uploadDate
        };

        patient.dentalFiles.push(fileEntry);

        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));

        return JSON.stringify(fileEntry);
    }

    // Get all dental files stored for a patient
    async getDentalFiles(ctx, patientID) {
        const patientJSON = await ctx.stub.getState(patientID);
        if (!patientJSON || patientJSON.length === 0) {
            throw new Error(`The patient ${patientID} does not exist`);
        }

        const patient = JSON.parse(patientJSON.toString());
        return JSON.stringify(patient.dentalFiles || []);
    }


    
}

module.exports = DentalRecordSharing;