'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Gateway, Wallets } = require('fabric-network');
const crypto = require('crypto');
const path = require('path');
const { enrollIdentity } = require('./fabricEnrollment');
const { submitWithMvccRetry } = require('./fabricTransactionRetry');

const jsonValue = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    return typeof value === 'string' ? JSON.parse(value) : value;
};

const patientHash = (patient) => crypto.createHash('sha256').update(JSON.stringify({
    patientID: patient.actorID,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    contactNumber: patient.contactNumber,
    email: patient.email,
    emiratesID: patient.emiratesID,
    nationality: patient.nationality,
    address: patient.address,
    bloodType: patient.bloodType,
    medicalHistory: jsonValue(patient.medicalHistory, null),
    allergies: jsonValue(patient.allergies, null),
    medications: jsonValue(patient.medications, null),
    insuranceDetails: jsonValue(patient.insuranceDetails, null),
    clinicID: Number(patient.clinicID),
    doctors: jsonValue(patient.doctors, []),
})).digest('hex');

const main = async () => {
    const reconciliationId = `fabric-reconciliation-${crypto.randomUUID()}`;
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'mydatabase',
    });
    const ccpPath = path.resolve(__dirname, process.env.FABRIC_CONNECTION_PROFILE || './connection/connection-org1.json');
    const walletPath = path.resolve(__dirname, process.env.FABRIC_WALLET_PATH || './wallet');
    try {
        const [admins] = await connection.execute(
            `SELECT Admin.Organization_ID AS clinicID
             FROM Admin JOIN User ON User.ID=Admin.User_ID
             JOIN Organization ON Organization.Organization_ID=Admin.Organization_ID
             WHERE User.IsActive=1 AND Organization.IsActive=1`,
        );
        const [doctors] = await connection.execute(
            `SELECT Doctor.ID AS databaseID, Doctor.Blockchain_ID AS actorID, Doctor.Clinic_ID AS clinicID,
                Doctor.Works_At AS worksAt, Doctor.Specialty AS speciality, Doctor.Emirates_ID AS emiratesID,
                Doctor.License_Number AS licenseNumber, User.First_Name AS firstName, User.Last_Name AS lastName,
                User.Email AS email, User.Contact_Number AS contactNumber, User.Created_Date AS createdDate
             FROM Doctor JOIN User ON User.ID=Doctor.ID
             JOIN Organization ON Organization.Organization_ID=Doctor.Clinic_ID
             WHERE Doctor.Blockchain_ID IS NOT NULL AND User.IsActive=1 AND Organization.IsActive=1`,
        );
        const [patients] = await connection.execute(
            `SELECT Patient.ID AS databaseID, Patient.Blockchain_ID AS actorID,
                Patient.Clinic_ID AS clinicID, Patient.Doctors AS doctors,
                User.First_Name AS firstName, User.Last_Name AS lastName,
                User.Contact_Number AS contactNumber, User.Email AS email,
                User.Created_Date AS createdDate,
                Patient.Date_of_Birth AS dateOfBirth, Patient.Gender AS gender,
                Patient.Emirates_ID AS emiratesID, Patient.Nationality AS nationality,
                Patient.Address AS address, Patient.Blood_Type AS bloodType,
                Patient.Medical_History AS medicalHistory, Patient.Allergies AS allergies,
                Patient.Medications AS medications, Patient.Insurance_Details AS insuranceDetails
             FROM Patient
             JOIN User ON User.ID = Patient.ID
             JOIN Organization ON Organization.Organization_ID=Patient.Clinic_ID
             WHERE Patient.Blockchain_ID IS NOT NULL AND User.IsActive=1 AND Organization.IsActive=1`,
        );
        const unscoped = [
            ...doctors.filter((row) => row.clinicID === null || row.clinicID === undefined),
            ...patients.filter((row) => row.clinicID === null || row.clinicID === undefined),
        ];
        if (unscoped.length) {
            throw new Error(`Refusing Fabric reconciliation for ${unscoped.length} actor(s) without a clinic assignment`);
        }
        let created = 0;
        for (const identity of [
            ...admins.map((row) => ({ role: 'admin', actorID: `AdminClinic${row.clinicID}`, clinicID: row.clinicID })),
            ...doctors.map((row) => ({ ...row, role: 'doctor' })),
            ...patients.map((row) => ({ ...row, role: 'patient' })),
        ]) {
            const result = await enrollIdentity({ ccpPath, walletPath, ...identity });
            if (result.created) created += 1;
        }
        const identityCount = admins.length + doctors.length + patients.length;
        console.log(`Fabric identity reconciliation complete: ${created} created, ${identityCount - created} already present`);

        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const ccp = require(ccpPath);
        const doctorBlockchainIDByDatabaseID = new Map(
            doctors.map((doctor) => [String(doctor.databaseID), String(doctor.actorID)]),
        );
        const knownDoctorBlockchainIDs = new Set(doctors.map((doctor) => String(doctor.actorID)));
        const assignmentsByClinic = new Map(admins.map((admin) => [String(admin.clinicID), []]));
        const desiredDoctorsByPatient = new Map();
        const desiredPatientsByDoctor = new Map(doctors.map((doctor) => [String(doctor.actorID), []]));
        const skippedAssignments = [];
        for (const patient of patients) {
            const assignedDoctors = typeof patient.doctors === 'string'
                ? JSON.parse(patient.doctors || '[]')
                : (patient.doctors || []);
            if (!assignmentsByClinic.has(String(patient.clinicID))) assignmentsByClinic.set(String(patient.clinicID), []);
            for (const doctorID of assignedDoctors) {
                const normalizedDoctorID = knownDoctorBlockchainIDs.has(String(doctorID))
                    ? String(doctorID)
                    : doctorBlockchainIDByDatabaseID.get(String(doctorID));
                if (!normalizedDoctorID) {
                    skippedAssignments.push({ patientID: String(patient.actorID), doctorID: String(doctorID) });
                    continue;
                }
                assignmentsByClinic.get(String(patient.clinicID)).push({
                    patientID: patient.actorID,
                    doctorID: normalizedDoctorID,
                });
                if (!desiredDoctorsByPatient.has(String(patient.actorID))) {
                    desiredDoctorsByPatient.set(String(patient.actorID), []);
                }
                desiredDoctorsByPatient.get(String(patient.actorID)).push(normalizedDoctorID);
                desiredPatientsByDoctor.get(normalizedDoctorID).push(String(patient.actorID));
            }
            if (!desiredDoctorsByPatient.has(String(patient.actorID))) {
                desiredDoctorsByPatient.set(String(patient.actorID), []);
            }
        }

        let assignments = 0;
        const failedAssignments = [];
        for (const [clinicID, clinicAssignments] of assignmentsByClinic) {
            const gateway = new Gateway();
            try {
                await gateway.connect(ccp, {
                    wallet,
                    identity: `admin-${clinicID}`,
                    discovery: {
                        enabled: process.env.FABRIC_DISCOVERY_ENABLED !== 'false',
                        asLocalhost: process.env.FABRIC_DISCOVERY_AS_LOCALHOST !== 'false',
                    },
                });
                const network = await gateway.getNetwork(process.env.FABRIC_CHANNEL || 'mychannel');
                const contract = network.getContract(process.env.FABRIC_CHAINCODE || 'basic');
                const submitReconciliationTransaction = (transactionName, ...args) => submitWithMvccRetry(
                    contract,
                    transactionName,
                    args,
                    { correlationId: reconciliationId, actorRole: 'admin', clinicId: clinicID },
                );
                for (const patient of patients.filter((row) => String(row.clinicID) === String(clinicID))) {
                    try {
                        await contract.evaluateTransaction('ReadPatient', String(patient.actorID));
                    } catch (error) {
                        if (!String(error.message || error).includes('does not exist')) throw error;
                        await submitReconciliationTransaction(
                            'AddPatientMetadata',
                            String(patient.actorID),
                            String(clinicID),
                            `mysql:Patient/${patient.databaseID}`,
                            patientHash(patient),
                            JSON.stringify(desiredDoctorsByPatient.get(String(patient.actorID)) || []),
                            patient.createdDate ? new Date(patient.createdDate).toISOString() : new Date().toISOString(),
                        );
                    }
                }
                for (const assignment of clinicAssignments) {
                    try {
                        await submitReconciliationTransaction(
                            'assignPatientToDoctor',
                            String(assignment.patientID),
                            String(assignment.doctorID),
                            '',
                            '',
                        );
                        assignments += 1;
                    } catch (error) {
                        failedAssignments.push({
                            ...assignment,
                            reason: String(error.message || error).split('\n')[0],
                        });
                    }
                }
                for (const patient of patients.filter((row) => String(row.clinicID) === String(clinicID))) {
                    try {
                        const current = JSON.parse((await contract.evaluateTransaction('ReadPatient', String(patient.actorID))).toString());
                        await submitReconciliationTransaction(
                            'UpdatePatientMetadata',
                            String(patient.actorID),
                            String(clinicID),
                            String(current.offChainRef || `mysql:Patient/${patient.actorID}`),
                            String(current.dataHash),
                            JSON.stringify(desiredDoctorsByPatient.get(String(patient.actorID)) || []),
                            new Date().toISOString(),
                        );
                    } catch (error) {
                        failedAssignments.push({
                            patientID: String(patient.actorID),
                            doctorID: 'metadata-sync',
                            reason: String(error.message || error).split('\n')[0],
                        });
                    }
                }
                for (const doctor of doctors.filter((row) => String(row.clinicID) === String(clinicID))) {
                    try {
                        let current;
                        try {
                            current = JSON.parse((await contract.evaluateTransaction('ReadDoctor', String(doctor.actorID))).toString());
                        } catch (error) {
                            if (!String(error.message || error).includes('does not exist')) throw error;
                            current = JSON.parse((await submitReconciliationTransaction(
                                'addDoctor', String(doctor.actorID), String(doctor.firstName), String(doctor.lastName),
                                String(doctor.emiratesID), String(doctor.speciality), String(doctor.worksAt), String(clinicID),
                                String(doctor.email), String(doctor.contactNumber), String(doctor.licenseNumber),
                                doctor.createdDate ? new Date(doctor.createdDate).toISOString() : new Date().toISOString(),
                                JSON.stringify(desiredPatientsByDoctor.get(String(doctor.actorID)) || []),
                            )).toString());
                        }
                        await submitReconciliationTransaction(
                            'UpdateDoctorInfo',
                            String(doctor.actorID),
                            String(current.firstName || ''),
                            String(current.lastName || ''),
                            String(current.emiratesID || ''),
                            String(current.speciality || ''),
                            String(current.worksAt || ''),
                            String(clinicID),
                            String(current.email || ''),
                            String(current.contactNumber || ''),
                            String(current.licenseNumber || ''),
                            String(current.createdDate || new Date().toISOString()),
                            JSON.stringify(desiredPatientsByDoctor.get(String(doctor.actorID)) || []),
                        );
                    } catch (error) {
                        failedAssignments.push({
                            patientID: 'doctor-metadata-sync',
                            doctorID: String(doctor.actorID),
                            reason: String(error.message || error).split('\n')[0],
                        });
                    }
                }
            } finally {
                gateway.disconnect();
            }
        }
        if (skippedAssignments.length) {
            throw new Error(`Fabric assignment reconciliation skipped ${skippedAssignments.length} unknown legacy relationship(s): ${
                skippedAssignments.map(({ patientID, doctorID }) => `${patientID}->${doctorID}`).join(', ')
            }`);
        }
        if (failedAssignments.length) {
            throw new Error(`Fabric assignment reconciliation could not replay ${failedAssignments.length} legacy relationship(s): ${
                failedAssignments.map(({ patientID, doctorID, reason }) => `${patientID}->${doctorID} (${reason})`).join(', ')
            }`);
        }
        console.log(`Fabric assignment reconciliation complete: ${assignments} relationship(s) verified`);
    } finally {
        await connection.end();
    }
};

main().catch((error) => {
    console.error(`Fabric identity reconciliation failed: ${error.message}`);
    process.exit(1);
});
