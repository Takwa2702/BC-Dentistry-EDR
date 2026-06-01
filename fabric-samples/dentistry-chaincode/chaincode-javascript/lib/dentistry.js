/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class Dentistry extends Contract {
    async RegisterPatient(ctx, _patientEID, _password, _firstName, _lastName, _DoB, _gender, _phoneNumber, _emailAddress, _appointmentDate, _medicalRecords, _dentalRecords, _xRayPaths) {
        const exists = await this.PatientExists(ctx, _patientEID);
        if (exists) {
            throw new Error(`Patient with ID ${_patientEID} already exists.`);
        }
        const patient = {
            patientEID: _patientEID,
            password: _password,
            firstName: firstName,
            lastName: lastName,
            dateOfBirth: _DoB,
            gender: _gender,
            phoneNumber: phoneNumber,
            emailAddress: emailAddress,
            appointmentDate: appointmentDate,
            medicalHistory: JSON.parse(_medicalRecords),
            dentalRecords: JSON.parse(_dentalRecords),
            xRayPaths: [_xRayPaths]
        };
        await ctx.stub.putState(_patientEID, Buffer.from(JSON.stringify(patient)));
        ctx.stub.setEvent('PatientRegistered', Buffer.from(JSON.stringify({ _patientEID, first_name: _firstName, last_name: _lastName })));
        return JSON.stringify(patient);
    }

    async PatientExists(ctx, patientId) {
        const patientBytes = await ctx.stub.getState(patientId);
        return patientBytes && patientBytes.length > 0;
    }

    async AddTeeth(ctx, patientId, toothId, status, side1condition, side1treatment, side2condition, side2treatment, 
        side3condition, side3treatment, side4condition, side4treatment) {
        const patientBytes = await ctx.stub.getState(patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error(`Patient with ID ${patientId} not found.`);
        }
    
        const patient = JSON.parse(patientBytes.toString());
        patient.dentalRecords[toothId] = {
            status,
            sides: {
                side1: { condition: side1condition, treatment: side1treatment },
                side2: { condition: side2condition, treatment: side2treatment },
                side3: { condition: side3condition, treatment: side3treatment },
                side4: { condition: side4condition, treatment: side4treatment }
            }
        };
    
        await ctx.stub.putState(patientId, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }
    
    async UpdateToothData(ctx, patientId, toothId, updatedData) {
        const patientBytes = await ctx.stub.getState(patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error(`Patient with ID ${patientId} not found.`);
        }
    
        const patient = JSON.parse(patientBytes.toString());
        if (!patient.dentalRecords[toothId]) {
            throw new Error(`Tooth with ID ${toothId} not found for patient ${patientId}.`);
        }
    
        // Update the tooth data with the provided updatedData
        patient.dentalRecords[toothId] = Object.assign({}, patient.dentalRecords[toothId], updatedData);
    
        // Put the updated patient record back to the ledger
        await ctx.stub.putState(patientId, Buffer.from(JSON.stringify(patient)));
    
        return JSON.stringify(patient);
    }

    async GetDentalRecords(ctx, patientId) {
        const patientBytes = await ctx.stub.getState(patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error(`Patient with ID ${patientId} not found.`);
        }
    
        const patient = JSON.parse(patientBytes.toString());
        return JSON.stringify(patient.dentalRecords);
    }

    async AddMedicalHistory(ctx, patientId, medicalEntry) {
        const patientBytes = await ctx.stub.getState(patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error(`Patient with ID ${patientId} not found.`);
        }
    
        const patient = JSON.parse(patientBytes.toString());
        patient.medicalHistory.push(medicalEntry);
    
        await ctx.stub.putState(patientId, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }
    
    async UpdateMedicalHistory(ctx, patientId, entryId, updatedEntry) {
        const patientBytes = await ctx.stub.getState(patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error(`Patient with ID ${patientId} not found.`);
        }
    
        const patient = JSON.parse(patientBytes.toString());
        if (!patient.medicalHistory[entryId]) {
            throw new Error(`Medical entry with ID ${entryId} not found.`);
        }
    
        patient.medicalHistory[entryId] = updatedEntry;
    
        await ctx.stub.putState(patientId, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }
    
    async GetMedicalHistory(ctx, patientId) {
        const patientBytes = await ctx.stub.getState(patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error(`Patient with ID ${patientId} not found.`);
        }
    
        const patient = JSON.parse(patientBytes.toString());
        return JSON.stringify(patient.medicalHistory);
    }
    
    
    async GetPatientData(ctx, patientId) {
        const patientBytes = await ctx.stub.getState(patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error(`Patient with ID ${patientId} not found.`);
        }
        return patientBytes.toString();
    }

    async getAllPatients(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const patientIds = [];
        for await (const result of iterator) {
            patientIds.push(result.key);
        }
        return patientIds;
    }

    async UpdatePatientPersonalInfo(ctx, _patientEID, _firstName, _lastName, _DoB, _phoneNumber, _emailAddress) {
        const existingPatientBytes = await ctx.stub.getState(_patientEID);
        if (!existingPatientBytes || existingPatientBytes.length === 0) {
            throw new Error(`Patient with ID ${_patientEID} not found.`);
        }
    
        const existingPatient = JSON.parse(existingPatientBytes.toString());
    
        // Update patient's personal information
        existingPatient.firstName = _firstName;
        existingPatient.lastName = _lastName;
        existingPatient.dateOfBirth = _DoB;
        existingPatient.phoneNumber = _phoneNumber;
        existingPatient.emailAddress = _emailAddress;
    
        await ctx.stub.putState(_patientEID, Buffer.from(JSON.stringify(existingPatient)));
        ctx.stub.setEvent('PatientPersonalInfoUpdated', Buffer.from(JSON.stringify({ patientEID: _patientEID, firstName: _firstName, lastName: _lastName })));
    }
    

    async sharePatientInfo(ctx, _patientId, _organization) {
        const patientBytes = await ctx.stub.getState(_patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error('Patient not found');
        }

        // Check if the organization is authorized to access patient information
        // This is a simplified example, and you may implement more complex authorization logic
        if (!_organization || _organization !== 'AuthorizedOrg') {
            throw new Error('Unauthorized organization');
        }

        // Share patient information with the authorized organization
        await ctx.stub.putState(`${_organization}_${_patientId}`, Buffer.from(JSON.stringify(patientBytes)));

        ctx.stub.setEvent('PatientInfoShared', Buffer.from(JSON.stringify({ patientId: _patientId, organization: _organization })));
    }
}

module.exports = Dentistry;
