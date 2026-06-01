const { ChaincodeStub, ClientIdentity } = require('fabric-shim');
const { PatientRegistry } = require('./patient-registry'); 
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const { expect } = chai;

const chaincode = new PatientRegistry();

async function mockContext() {
    const stub = sinon.createStubInstance(ChaincodeStub);
    stub.getTxID.returns('mockTxID');

    const identity = sinon.createStubInstance(ClientIdentity);
    identity.getMSPID.returns('mockMSP');
    identity.getID.returns('mockUser');

    const ctx = {
        stub,
        clientIdentity: identity,
    };

    return ctx;
}

describe('PatientRegistry Chaincode', () => {
    // ... (existing tests)

    it('should share patient info with authorized organization', async () => {
        const ctx = await mockContext();
        const patientId = 'mockTxID';
        const organization = 'AuthorizedOrg';

        // Register a patient first
        await chaincode.registerPatient(ctx, 'John Doe', 30, 'Some dental info');

        // Share patient info with the authorized organization
        await chaincode.sharePatientInfo(ctx, patientId, organization);

        // Check if patient info is shared and event is emitted
        sinon.assert.calledWith(ctx.stub.putState, `${organization}_${patientId}`, sinon.match.any);
        sinon.assert.calledWith(ctx.stub.setEvent, 'PatientInfoShared', sinon.match.any);
    });

    it('should not share patient info with unauthorized organization', async () => {
        const ctx = await mockContext();
        const patientId = 'mockTxID';
        const unauthorizedOrganization = 'UnauthorizedOrg';

        // Register a patient first
        await chaincode.registerPatient(ctx, 'John Doe', 30, 'Some dental info');

        // Attempt to share patient info with an unauthorized organization
        await expect(chaincode.sharePatientInfo(ctx, patientId, unauthorizedOrganization)).to.be.rejectedWith('Unauthorized organization');

        // Ensure that no state is put and no event is emitted
        sinon.assert.notCalled(ctx.stub.putState);
        sinon.assert.notCalled(ctx.stub.setEvent);
    });
});
