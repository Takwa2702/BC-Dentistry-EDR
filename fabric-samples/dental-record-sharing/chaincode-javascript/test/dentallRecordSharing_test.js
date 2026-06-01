/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
*/

'use strict';
const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub } = require('fabric-shim');

const MyChaincode = require('../lib/dentalRecordSharing.js'); // Adjust path based on your structure

let assert = sinon.assert;
chai.use(sinonChai);

describe('Doctor and Patient Management Tests', () => {
    let transactionContext, chaincodeStub;

    beforeEach(() => {
        chaincodeStub = sinon.createStubInstance(ChaincodeStub);
        transactionContext = new Context(chaincodeStub);

        // Stub putState to mimic blockchain state storage
        chaincodeStub.putState.callsFake((key, value) => {
            if (!chaincodeStub.states) {
                chaincodeStub.states = {};
            }
            chaincodeStub.states[key] = value;
        });

        // Stub getState to mimic blockchain state retrieval
        chaincodeStub.getState.callsFake(async (key) => {
            let ret;
            if (chaincodeStub.states) {
                ret = chaincodeStub.states[key];
            }
            return Promise.resolve(ret);
        });
    });

    describe('Test addDoctor', () => {
        it('should allow admin to add a doctor', async () => {
            // Mock the context for an admin user
            const creator = Buffer.from(JSON.stringify({
                mspid: 'Org1MSP',
                id_bytes: Buffer.from('adminUser'),
                attributes: [{ name: 'role', value: 'admin' }]
            }));
            chaincodeStub.getCreator.returns(creator);

            let chaincode = new MyChaincode();
            const response = await chaincode.addDoctor(transactionContext, 'D001', 'John', 'Doe', 'Dentist', 'Clinic A', 'john@example.com', '1234567890', '2024-10-16', []);
            expect(response).to.include('D001');
        });

        it('should not allow non-admin to add a doctor', async () => {
            // Mock the context for a non-admin user
            const creator = Buffer.from(JSON.stringify({
                mspid: 'Org1MSP',
                id_bytes: Buffer.from('nonAdminUser'),
                attributes: [{ name: 'role', value: 'user' }]
            }));
            chaincodeStub.getCreator.returns(creator);

            let chaincode = new MyChaincode();
            try {
                await chaincode.addDoctor(transactionContext, 'D002', 'Jane', 'Doe', 'Orthodontist', 'Clinic B', 'jane@example.com', '0987654321', '2024-10-16', []);
                assert.fail('Expected error was not thrown');
            } catch (error) {
                expect(error.message).to.equal('Only admins can add doctors.');
            }
        });
    });

    describe('Test addPatient', () => {
        it('should allow admin to add a patient', async () => {
            // Mock the context for an admin user
            const creator = Buffer.from(JSON.stringify({
                mspid: 'Org1MSP',
                id_bytes: Buffer.from('adminUser'),
                attributes: [{ name: 'role', value: 'admin' }]
            }));
            chaincodeStub.getCreator.returns(creator);

            let chaincode = new MyChaincode();
            const response = await chaincode.addPatient(transactionContext, 'P001', 'Alice', 'Smith', '1990-01-01', 'female', 'EID123456', 'alice@example.com', '9876543210', 'Address A', '2024-10-16', []);
            expect(response).to.include('P001');
        });

        it('should not allow non-admin to add a patient', async () => {
            // Mock the context for a non-admin user
            const creator = Buffer.from(JSON.stringify({
                mspid: 'Org1MSP',
                id_bytes: Buffer.from('nonAdminUser'),
                attributes: [{ name: 'role', value: 'user' }]
            }));
            chaincodeStub.getCreator.returns(creator);

            let chaincode = new MyChaincode();
            try {
                await chaincode.addPatient(transactionContext, 'P002', 'Bob', 'Johnson', '1992-02-02', 'male', 'EID654321', 'bob@example.com', '1234567890', 'Address B', '2024-10-16', []);
                assert.fail('Expected error was not thrown');
            } catch (error) {
                expect(error.message).to.equal('Only admins can add patients.');
            }
        });
    });
});
