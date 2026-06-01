/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class PatientRegistry extends Contract {
    async registerPatient(ctx, _name, _age, _dentalInfo) {

        const patientId = ctx.stub.getTxID(); 

       
        const patient = {
            name: _name,
            age: _age,
            dentalInfo: _dentalInfo,
        };
        await ctx.stub.putState(patientId, Buffer.from(JSON.stringify(patient)));

     
        ctx.stub.setEvent('PatientRegistered', Buffer.from(JSON.stringify({ patientId, name: _name })));

        return patientId;
    }

    async getPatient(ctx, _patientId) {
        const patientBytes = await ctx.stub.getState(_patientId);
        if (!patientBytes || patientBytes.length === 0) {
            throw new Error('Patient not found');
        }

        const patient = JSON.parse(patientBytes.toString());
        return patient;
    }

    async getAllPatients(ctx) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const patientIds = [];

        for await (const result of iterator) {
            patientIds.push(result.key);
        }

        return patientIds;
    }

    async updatePatientInfo(ctx, _patientId, _name, _age, _dentalInfo) {
        const existingPatientBytes = await ctx.stub.getState(_patientId);
        if (!existingPatientBytes || existingPatientBytes.length === 0) {
            throw new Error('Patient not found');
        }

        

        const updatedPatient = {
            name: _name,
            age: _age,
            dentalInfo: _dentalInfo,
        };
        await ctx.stub.putState(_patientId, Buffer.from(JSON.stringify(updatedPatient)));

        ctx.stub.setEvent('PatientInfoUpdated', Buffer.from(JSON.stringify({ patientId: _patientId, ...updatedPatient })));
    }
}

module.exports = PatientRegistry;
