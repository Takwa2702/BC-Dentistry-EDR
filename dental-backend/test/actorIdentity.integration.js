'use strict';

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Gateway, Wallets } = require('fabric-network');

const root = path.resolve(__dirname, '..');
const ccpPath = path.resolve(root, process.env.FABRIC_CONNECTION_PROFILE || './connection/connection-org1.json');
const walletPath = path.resolve(root, process.env.FABRIC_WALLET_PATH || './wallet');
const channel = process.env.FABRIC_CHANNEL || 'mychannel';
const chaincode = process.env.FABRIC_CHAINCODE || 'basic';

const invoke = async (identity, transaction, ...args) => {
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const gateway = new Gateway();
    try {
        await gateway.connect(JSON.parse(fs.readFileSync(ccpPath, 'utf8')), {
            wallet,
            identity,
            discovery: {
                enabled: process.env.FABRIC_DISCOVERY_ENABLED !== 'false',
                asLocalhost: process.env.FABRIC_DISCOVERY_AS_LOCALHOST !== 'false',
            },
        });
        const network = await gateway.getNetwork(channel);
        return await network.getContract(chaincode).evaluateTransaction(transaction, ...args);
    } finally {
        gateway.disconnect();
    }
};

const expectPass = async (label, identity, transaction, ...args) => {
    await invoke(identity, transaction, ...args);
    console.log(`PASS ${label}`);
};

const expectReject = async (label, expectedMessage, identity, transaction, ...args) => {
    try {
        await invoke(identity, transaction, ...args);
        throw new Error(`Unexpected success: ${label}`);
    } catch (error) {
        if (error.message.includes('Unexpected success') || !error.message.includes(expectedMessage)) {
            throw error;
        }
        console.log(`PASS ${label}`);
    }
};

const main = async () => {
    await expectPass('admin can enumerate patients', 'admin-1', 'GetAllPatients');
    await expectReject('doctor cannot enumerate all patients', 'requires admin or system role', 'doctor-Doctor1', 'GetAllPatients');
    await expectPass('doctor can read own assigned patients', 'doctor-Doctor1', 'getPatientsAssignedToDoctor', 'Doctor1');
    await expectReject('doctor cannot use another doctor identity', 'certificate actorID does not match Doctor2', 'doctor-Doctor1', 'getPatientsAssignedToDoctor', 'Doctor2');
    await expectPass('patient can read own request queue', 'patient-Patient1', 'GetAllRequestsForPatient', 'Patient1');
    await expectReject('patient cannot read another request queue', 'certificate actorID does not match Patient2', 'patient-Patient1', 'GetAllRequestsForPatient', 'Patient2');
    await expectReject('admin cannot read another clinic queue', 'not authorized for clinic 2', 'admin-1', 'GetRequestsForAdmin', '2');
    await expectPass('system identity can simulate an access log', 'role-system', 'LogAccess', 'Doctor1', 'Patient1');
    await expectReject('patient cannot invoke system access logging', 'requires system role', 'patient-Patient1', 'LogAccess', 'Doctor1', 'Patient1');
};

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
