'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class ReadPatientWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        this.txIndex = 0;
        this.sutAdapter = sutAdapter;       // ✅ this line is required
        this.sutContext = sutContext;       // (optional if you're using it)
    }

    async submitTransaction() {
        const id = 'Patient1';
        this.txIndex++;

        return this.sutAdapter.sendRequests({
            contractId: 'basic',       // adjust if your chaincode name is different
            contractFunction: 'ReadPatient',
            invokerIdentity: 'User1',           // this should match the identity in your network config
            contractArguments: [id],
            readOnly: true
        });
    }
}

function createWorkloadModule() {
    return new ReadPatientWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
