// index.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const ccpPath = path.resolve(__dirname, 'connection', 'connection-org1.json');
// Add this to verify the path
console.log('Connection profile path:', ccpPath);

// Add this to verify the content of the file
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
console.log('Connection profile content:', ccp);

// app.post('/addDoctor', async (req, res) => {
//     try {
//         const walletPath = path.join(process.cwd(), 'wallet');
//         const wallet = await Wallets.newFileSystemWallet(walletPath);

//         const gateway = new Gateway();
//         await gateway.connect(ccp, {
//             wallet,
//             identity: 'appUser',
//             discovery: { enabled: true, asLocalhost: true },
//         });

//         const network = await gateway.getNetwork('mychannel');
//         const contract = network.getContract('basic');

//         const {
//             doctorID,
//             firstName,
//             lastName,
//             speciality,
//             worksAt,
//             email,
//             contactNumber,
//             createdDate,
//             patients,
//         } = req.body;

//         await contract.submitTransaction(
//             'addDoctor',
//             doctorID,
//             firstName,
//             lastName,
//             speciality,
//             worksAt,
//             email,
//             contactNumber,
//             createdDate,
//             JSON.stringify(patients)
//         );

//         res.status(200).send('Doctor added successfully');
//         await gateway.disconnect();
//     } catch (error) {
//         console.error(`Failed to submit transaction: ${error}`);
//         res.status(500).send(`Error: ${error}`);
//     }
// });

app.get('/getAllPatients', async (req, res) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const result = await contract.evaluateTransaction('GetAllPatients');
        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

app.get('/readPatient/:patientID', async (req, res) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const patientID = req.params.patientID;
        const result = await contract.evaluateTransaction('ReadPatient', patientID);

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

app.get('/getPatientsAssignedToDoctor/:doctorID', async (req, res) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const doctorID = req.params.doctorID;
        const result = await contract.evaluateTransaction('getPatientsAssignedToDoctor', doctorID);

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

app.get('/getPatientsByClinic/:clinicID', async (req, res) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const clinicID = req.params.clinicID;
        const result = await contract.evaluateTransaction('GetPatientsByClinic', clinicID);

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});


// Endpoint for doctor to request data access
app.post('/requestDataAccess', async (req, res) => {
    try {
        // console.log("Received API request:", req.body);

        const { doctorID, patientID, dataOriginClinicID } = req.body;
        
        if (!doctorID || !patientID || !dataOriginClinicID) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        // Convert clinic ID to string to match Fabric contract expectations
        const requestID = await contract.submitTransaction(
            'RequestDataAccess', 
            doctorID, 
            patientID, 
            String(dataOriginClinicID)
        );

        res.status(200).json({ requestID: requestID.toString() });
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

app.get('/getRequestsForAdmin/:clinicID', async (req, res) => {
    try {
        console.log("Received request to get admin clinic requests for:", req.params.clinicID);

        const { clinicID } = req.params;
        
        if (!clinicID) {
            return res.status(400).json({ error: "Missing required clinic ID parameter" });
        }

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        // Call `GetRequestsForAdmin` chaincode function with the provided clinic ID
        const result = await contract.evaluateTransaction('GetRequestsForAdmin', clinicID);

        console.log("Fetched Requests for Clinic:", clinicID, "Response:", result.toString());

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});
//admin from org approves request
app.post('/approveRequest', async (req, res) => {
    try {
        console.log("Received request to approve request:", req.body);

        const { adminID, requestID, adminClinicID } = req.body;
        
        if (!adminID || !requestID || !adminClinicID) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        // Call `ApproveRequest` chaincode function with required parameters
        const result = await contract.submitTransaction(
            'ApproveRequest', 
            adminID, 
            requestID, 
            String(adminClinicID)
        );

        console.log("Approval Response:", result.toString());

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to approve request: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

app.get('/getPendingRequestsForPatient/:patientID', async (req, res) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const patientID = req.params.patientID;
        const result = await contract.evaluateTransaction('GetPendingRequestsForPatient', patientID);

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

app.get('/getProcessedRequestsForPatient/:patientID', async (req, res) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const patientID = req.params.patientID;
        const result = await contract.evaluateTransaction('GetProcessedRequestsForPatient', patientID);

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

app.get('/getAllRequestsForPatient/:patientID', async (req, res) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const patientID = req.params.patientID;
        const result = await contract.evaluateTransaction('GetAllRequestsForPatient', patientID);

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});


app.post('/provideConsent', async (req, res) => {
    try {
        const { patientID, requestID } = req.body;
        
        if (!patientID || !requestID) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const result = await contract.submitTransaction('ProvideConsent', patientID, requestID);

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

app.post('/rejectRequest', async (req, res) => {
    try {
        const { patientID, requestID, rejectionReason } = req.body;
        
        if (!patientID || !requestID || !rejectionReason) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUser',
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('basic');

        const result = await contract.submitTransaction('RejectRequest', patientID, requestID, rejectionReason);

        res.status(200).json(JSON.parse(result.toString()));
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        res.status(500).send(`Error: ${error}`);
    }
});

// const PORT = process.env.PORT || 8081;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });
const PORT = process.env.PORT || 8081;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
