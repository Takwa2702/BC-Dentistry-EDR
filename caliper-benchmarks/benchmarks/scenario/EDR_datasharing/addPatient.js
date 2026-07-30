'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class AddPatientWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        this.txIndex = 0;
        this.prefix = roundArguments.prefix;
        this.sutAdapter = sutAdapter;
        this.sutContext = sutContext;
    }

    async submitTransaction() {
        const patientId = this.prefix + '_' + this.txIndex;
        const firstName = 'Test';
        const lastName = 'Patient';
        const dateOfBirth = '2000-01-01';
        const gender = 'M';
        const emiratesID = '784-1985-' + Math.floor(Math.random() * 1000000) + '-1';
        const email = 'test' + Math.floor(Math.random() * 1000) + '@example.com';
        const contactNumber = '050' + Math.floor(1000000 + Math.random() * 9000000);
        const address = 'Test Address, Dubai';
        const createdDate = new Date().toISOString(); // Current timestamp
        const clinicID = '2';
        const doctors = ['Doctor1'];

        this.txIndex++;

        return this.sutAdapter.sendRequests({
            contractId: 'basic',
            contractFunction: 'addPatient',
            invokerIdentity: 'Admin2',
            contractArguments: [
                patientId,
                firstName,
                lastName,
                dateOfBirth,
                gender,
                emiratesID,
                email,
                contactNumber,
                address,
                createdDate,
                clinicID,
                JSON.stringify(doctors) // <-- send doctors array as a string
            ],
            readOnly: false
        });
    }
}

function createWorkloadModule() {
    return new AddPatientWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
