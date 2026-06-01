'use strict';

const { Contract } = require('fabric-contract-api');

class PatientContract extends Contract {
    async createPatient(ctx, patientID, password, firstName, lastName, phoneNumber, emailAddress, appointmentDate) {
        const patient = {
            patientID: patientID,
            password: password,
            firstName: firstName,
            lastName: lastName,
            phoneNumber: phoneNumber,
            emailAddress: emailAddress,
            appointmentDate: appointmentDate,
            personalMedicalRecord: []
        };
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    async login(ctx, patientID, password) {
        const patientBytes = await ctx.stub.getState(patientID);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error('Patient not found');
        }
        const patient = JSON.parse(patientBytes.toString());
        if (password === patient.password) {
            return `${patient.firstName} ${patient.lastName} logged in.`;
        } else {
            throw new Error('Login failed. Invalid username or password.');
        }
    }

    async logout(ctx, patientID) {
        const patientBytes = await ctx.stub.getState(patientID);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error('Patient not found');
        }
        const patient = JSON.parse(patientBytes.toString());
        return `${patient.firstName} ${patient.lastName} logged out.`;
    }

    async listMedicalRecords(ctx, patientID) {
        const patientBytes = await ctx.stub.getState(patientID);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error('Patient not found');
        }
        const patient = JSON.parse(patientBytes.toString());
        return `Medical records for ${patient.firstName} ${patient.lastName}: ${JSON.stringify(patient.personalMedicalRecord)}`;
    }

    async grantSharingPermission(ctx, patientID, recipientID) {
    const patientBytes = await ctx.stub.getState(patientID);
    if (!patientBytes || patientBytes.length === 0) {
        throw new Error('Patient not found');
    }

    const recipientBytes = await ctx.stub.getState(recipientID);
    if (!recipientBytes || recipientBytes.length === 0) {
        throw new Error('Recipient not found');
    }

    const patient = JSON.parse(patientBytes.toString());
    const recipient = JSON.parse(recipientBytes.toString());

    if (!patient.sharedWith) {
        patient.sharedWith = [];
    }
    patient.sharedWith.push(recipientID);

    await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));

    return `Permission granted to share medical data with ${recipient.firstName} ${recipient.lastName}.`;
}

}



module.exports = PatientContract;
