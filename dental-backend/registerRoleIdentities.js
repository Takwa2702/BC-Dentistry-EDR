'use strict';

require('dotenv').config();
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const values = (name, defaults) => (process.env[name] || defaults)
    .split(',').map((value) => value.trim()).filter(Boolean);

const roleIdentities = () => [
    ...values('FABRIC_ADMIN_CLINIC_IDS', '1,2').map((clinicID) => ({
        label: `admin-${clinicID}`, role: 'admin', actorID: `AdminClinic${clinicID}`, clinicID,
    })),
    { label: 'role-system', role: 'system', actorID: 'system', clinicID: '' },
    ...values('FABRIC_DOCTOR_IDS', 'Doctor1,Doctor2').map((actorID) => ({
        label: `doctor-${actorID}`, role: 'doctor', actorID,
    })),
    ...values('FABRIC_PATIENT_IDS', 'Patient1,Patient2,Patient3').map((actorID) => ({
        label: `patient-${actorID}`, role: 'patient', actorID,
    })),
];

async function main() {
    const ccpPath = path.resolve(__dirname, process.env.FABRIC_CCP_PATH || './connection/connection-org1.json');
    const walletPath = path.resolve(__dirname, process.env.FABRIC_WALLET_PATH || './wallet');
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
    const ca = new FabricCAServices(caInfo.url, {
        trustedRoots: caInfo.tlsCACerts.pem,
        verify: false,
    }, caInfo.caName);
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const adminIdentity = await wallet.get('admin');
    if (!adminIdentity) {
        throw new Error('Wallet identity "admin" is required. Run enrollAdmin.js first.');
    }
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');

    for (const definition of roleIdentities()) {
        if (await wallet.get(definition.label)) {
            console.log(`Identity ${definition.label} already exists`);
            continue;
        }
        const enrollmentSecret = await ca.register({
            enrollmentID: definition.label,
            role: 'client',
            attrs: [
                { name: 'role', value: definition.role, ecert: true },
                { name: 'actorID', value: definition.actorID, ecert: true },
                ...(definition.clinicID ? [{ name: 'clinicID', value: definition.clinicID, ecert: true }] : []),
            ],
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: definition.label,
            enrollmentSecret,
            attr_reqs: [
                { name: 'role', optional: false },
                { name: 'actorID', optional: false },
                { name: 'clinicID', optional: true },
            ],
        });
        await wallet.put(definition.label, {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: process.env.FABRIC_MSP_ID || 'Org1MSP',
            type: 'X.509',
        });
        console.log(`Registered ${definition.label}`);
    }
}

main().catch((error) => {
    console.error(`Failed to register role identities: ${error.message}`);
    process.exit(1);
});
