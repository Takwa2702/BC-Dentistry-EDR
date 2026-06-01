'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class DeletePatientWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        this.txIndex = 0;
        this.sutAdapter = sutAdapter;
        this.sutContext = sutContext;
    }

    async submitTransaction() {
        const patientId = 'TestPatient_' + this.txIndex;

        this.txIndex++;

        return this.sutAdapter.sendRequests({
            contractId: 'basic',
            contractFunction: 'DeletePatient',
            invokerIdentity: 'User1',
            contractArguments: [patientId],
            readOnly: false
        });
    }
}

function createWorkloadModule() {
    return new DeletePatientWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
