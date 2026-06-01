/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'basic');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

// Path to crypto materials.
const cryptoPath = envOrDefault(
    'CRYPTO_PATH',
    path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'test-network',
        'organizations',
        'peerOrganizations',
        'org1.example.com'
    )
);

// Path to user private key directory.
const keyDirectoryPath = envOrDefault(
    'KEY_DIRECTORY_PATH',
    path.resolve(
        cryptoPath,
        'users',
        'User1@org1.example.com',
        'msp',
        'keystore'
    )
);

// Path to user certificate directory.
const certDirectoryPath = envOrDefault(
    'CERT_DIRECTORY_PATH',
    path.resolve(
        cryptoPath,
        'users',
        'User1@org1.example.com',
        'msp',
        'signcerts'
    )
);

// Path to peer tls certificate.
const tlsCertPath = envOrDefault(
    'TLS_CERT_PATH',
    path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt')
);

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const utf8Decoder = new TextDecoder();
// const assetId = `asset${String(Date.now())}`;

async function main() {
    displayInputParameters();

    // The gRPC client connection should be shared by all Gateway connections to this endpoint.
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    });

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);

     
        // Initialize the ledger with some default records
        // await initLedger(contract);

        // Add a patient to the ledger
        // await addPatient(contract, 'Patient4', 'John', 'Doe', '1985-10-12', 'male', '1234567890', 'john.doe@example.com', '0501234567', '789 Cedar Road, Dubai', '2023-01-01', []);

        // Retrieve all patients
        await getAllPatients(contract);

        // Add a doctor to the ledger
        // await addDoctor(contract, 'doctor123', 'Alice', 'Smith', 'Dentist', 'Hospital 1', 'alice.smith@example.com', '0509876543', '2023-01-01');

        // Get a patient's details by ID
        await getPatientByID(contract, 'Patient1');
    } finally {
        gateway.close();
        client.close();
    }
}

main().catch((error) => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity() {
    const certPath = await getFirstDirFileName(certDirectoryPath);
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function getFirstDirFileName(dirPath) {
    const files = await fs.readdir(dirPath);
    const file = files[0];
    if (!file) {
        throw new Error(`No files in directory: ${dirPath}`);
    }
    return path.join(dirPath, file);
}

async function newSigner() {
    const keyPath = await getFirstDirFileName(keyDirectoryPath);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * Initialize the ledger with sample data.
 */
async function initLedger(contract) {
    console.log('\n--> Submit Transaction: InitLedger, initialize the ledger with some default records');
    await contract.submitTransaction('InitLedger');
    console.log('*** Ledger initialized successfully');
}


/**
 *  Evaluate a transaction to query ledger state. Retrieve all patient records from the ledger.
 */
async function getAllPatients(contract) {
    console.log('\n--> Evaluate Transaction: GetAllPatients, retrieve all patient records from the ledger');
    const resultBytes = await contract.evaluateTransaction('GetAllPatients');
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** All Patients:', result);
}

/**
 * Submit a transaction synchronously, blocking until it has been committed to the ledger.
 * Add a new patient record to the ledger.
 */
async function addPatient(contract, patientID, firstName, lastName, dateOfBirth, gender, emiratesID, email, contactNumber, address, createdDate) {
    console.log('\n--> Submit Transaction: AddPatient, add a new patient record');
    await contract.submitTransaction('AddPatient', patientID, firstName, lastName, dateOfBirth, gender, emiratesID, email, contactNumber, address, createdDate, JSON.stringify(doctors));
    console.log('*** Patient record added successfully');
}

/**
 * Submit transaction asynchronously, allowing the application to process the smart contract response (e.g. update a UI)
 * while waiting for the commit notification.
 */
// async function transferAssetAsync(contract) {
//     console.log(
//         '\n--> Async Submit Transaction: TransferAsset, updates existing asset owner'
//     );

//     const commit = await contract.submitAsync('TransferAsset', {
//         arguments: [assetId, 'Saptha'],
//     });
//     const oldOwner = utf8Decoder.decode(commit.getResult());

//     console.log(
//         `*** Successfully submitted transaction to transfer ownership from ${oldOwner} to Saptha`
//     );
//     console.log('*** Waiting for transaction commit');

//     const status = await commit.getStatus();
//     if (!status.successful) {
//         throw new Error(
//             `Transaction ${
//                 status.transactionId
//             } failed to commit with status code ${String(status.code)}`
//         );
//     }

//     console.log('*** Transaction committed successfully');
// }

/**
 * Retrieve patient details by patient ID.
 */
async function getPatientByID(contract, patientID) {
    console.log(`\n--> Evaluate Transaction: GetPatientByID, retrieve details of patient ${patientID}`);
    const resultBytes = await contract.evaluateTransaction('ReadPatient', patientID);
    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log(`*** Patient ${patientID}:`, result);
}

/**
 * submitTransaction() will throw an error containing details of any error responses from the smart contract.
 */
// async function updateNonExistentAsset(contract) {
//     console.log(
//         '\n--> Submit Transaction: UpdateAsset asset70, asset70 does not exist and should return an error'
//     );

//     try {
//         await contract.submitTransaction(
//             'UpdateAsset',
//             'asset70',
//             'blue',
//             '5',
//             'Tomoko',
//             '300'
//         );
//         console.log('******** FAILED to return an error');
//     } catch (error) {
//         console.log('*** Successfully caught the error: \n', error);
//     }
// }

/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 */
function envOrDefault(key, defaultValue) {
    return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
function displayInputParameters() {
    console.log(`channelName:       ${channelName}`);
    console.log(`chaincodeName:     ${chaincodeName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
    console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
    console.log(`certDirectoryPath: ${certDirectoryPath}`);
    console.log(`tlsCertPath:       ${tlsCertPath}`);
    console.log(`peerEndpoint:      ${peerEndpoint}`);
    console.log(`peerHostAlias:     ${peerHostAlias}`);
}
