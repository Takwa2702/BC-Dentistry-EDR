'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class DeletePatientWorkload extends WorkloadModuleBase {
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

        this.txIndex++;

        return this.sutAdapter.sendRequests({
            contractId: 'basic',
            contractFunction: 'DeletePatient',
            invokerIdentity: 'Admin2',
            contractArguments: [patientId],
            readOnly: false
        });
    }
}

function createWorkloadModule() {
    return new DeletePatientWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
