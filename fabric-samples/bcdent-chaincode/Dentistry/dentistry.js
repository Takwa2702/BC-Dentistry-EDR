'use strict';

const { Contract } = require('fabric-contract-api');

class BCDentistryContract extends Contract {

    async initLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        // Initialization logic if required
        console.info('============= END : Initialize Ledger ===========');
    }

    // Utility function to generate unique IDs
    generateID() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    // Admin: Add Patient
    async addPatient(ctx, firstName, lastName, dateOfBirth, gender, emiratesID, email, contactNumber, address) {
        const patientID = this.generateID();
        const patient = {
            patientID,
            firstName,
            lastName,
            dateOfBirth,
            gender,
            emiratesID,
            email,
            contactNumber,
            address,
            role: 'patient',
            createdDate: new Date().toISOString(),
            medicalHistory: [],
            allergies: [],
            medications: [],
            dentalHistory: [],
            dentalChart: [],
            labResults: [],
            labPrescriptions: [],
            attachments: []
        };
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Admin: Add Doctor
    async addDoctor(ctx, firstName, lastName, speciality, worksAt, email, contactNumber) {
        const doctorID = this.generateID();
        const doctor = {
            doctorID,
            firstName,
            lastName,
            speciality,
            worksAt,
            email,
            contactNumber,
            role: 'doctor',
            createdDate: new Date().toISOString()
        };
        await ctx.stub.putState(doctorID, Buffer.from(JSON.stringify(doctor)));
        return JSON.stringify(doctor);
    }

    // Admin: Make Appointment
    async makeAppointment(ctx, meetingFor, patientID, doctorID, date, notes) {
        const appointmentID = this.generateID();
        const appointment = {
            appointmentID,
            meetingFor,
            patientID,
            doctorID,
            date,
            notes,
            createdDate: new Date().toISOString()
        };
        await ctx.stub.putState(appointmentID, Buffer.from(JSON.stringify(appointment)));
        return JSON.stringify(appointment);
    }

    // Doctor: Add/Edit Medical History
    async addOrEditMedicalHistory(ctx, patientID, category, questionType, answer, note, verifiedDate, isApproved) {
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`${patientID} does not exist`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        patient.medicalHistory.push({
            id: this.generateID(),
            category,
            questionType,
            answer,
            note,
            verifiedDate,
            isApproved,
            modifiedDate: new Date().toISOString(),
            createdDate: new Date().toISOString()
        });
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Doctor: Add/Edit Dental History
    async addOrEditDentalHistory(ctx, patientID, category, questionType, answer, note, verifiedDate, isApproved) {
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`${patientID} does not exist`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        patient.dentalHistory.push({
            id: this.generateID(),
            category,
            questionType,
            answer,
            note,
            verifiedDate,
            isApproved,
            modifiedDate: new Date().toISOString(),
            createdDate: new Date().toISOString()
        });
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Doctor: Add/Edit Dental Chart
    async addOrEditDentalChart(ctx, patientID, category, subCategory, code, site, suf, status, preAuth, phase, discipline, diagnoses, note, estimate, doctorID, auditDate) {
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`${patientID} does not exist`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        patient.dentalChart.push({
            id: this.generateID(),
            category,
            subCategory,
            code,
            site,
            suf,
            status,
            preAuth,
            phase,
            discipline,
            diagnoses,
            note,
            estimate,
            doctorID,
            auditDate,
            createdDate: new Date().toISOString()
        });
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Doctor: Add/Edit Lab Results
    async addOrEditLabResults(ctx, patientID, orderID, caseID, labProcedure, siteID, discipline, lab, isCompleted, status, state) {
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`${patientID} does not exist`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        patient.labResults.push({
            id: this.generateID(),
            orderID,
            caseID,
            labProcedure,
            siteID,
            discipline,
            lab,
            isCompleted,
            status,
            state,
            createdDate: new Date().toISOString()
        });
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Doctor: Add/Edit Lab Prescriptions
    async addOrEditLabPrescriptions(ctx, patientID, type, prescription) {
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`${patientID} does not exist`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        patient.labPrescriptions.push({
            id: this.generateID(),
            type,
            prescription,
            createdDate: new Date().toISOString()
        });
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Doctor: Add/Edit Allergies
    async addOrEditAllergies(ctx, patientID, name, description) {
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`${patientID} does not exist`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        patient.allergies.push({
            id: this.generateID(),
            name,
            description,
            createdDate: new Date().toISOString()
        });
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Doctor: Add/Edit Medications
    async addOrEditMedications(ctx, patientID, drug, dose, total, refills, startDate, endDate, frequency, approvedBy) {
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`${patientID} does not exist`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        patient.medications.push({
            id: this.generateID(),
            drug,
            dose,
            total,
            refills,
            startDate,
            endDate,
            frequency,
            approvedBy,
            createdDate: new Date().toISOString()
        });
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Doctor: Add/Edit Attachments
    async addOrEditAttachments(ctx, patientID, sectionType, filePath, size, format) {
        const patientAsBytes = await ctx.stub.getState(patientID);
        if (!patientAsBytes || patientAsBytes.length === 0) {
            throw new Error(`${patientID} does not exist`);
        }
        const patient = JSON.parse(patientAsBytes.toString());
        patient.attachments.push({
            id: this.generateID(),
            sectionType,
            filePath,
            size,
            format,
            createdDate: new Date().toISOString()
        });
        await ctx.stub.putState(patientID, Buffer.from(JSON.stringify(patient)));
        return JSON.stringify(patient);
    }

    // Doctor: Request Patient Data from Another Hospital
    async requestPatientData(ctx, patientID, dataType, reason, requestedBy) {
        const requestID = this.generateID();
        const request = {
            requestID,
            patientID,
            dataType,
            reason,
            requestedBy,
            status: 'Pending',
            createdDate: new Date().toISOString()
        };
        await ctx.stub.putState(requestID, Buffer.from(JSON.stringify(request)));
        return JSON.stringify(request);
    }

    // Admin: Manage Data Requests
    async manageDataRequest(ctx, requestID, action, comments) {
        const requestAsBytes = await ctx.stub.getState(requestID);
        if (!requestAsBytes || requestAsBytes.length === 0) {
            throw new Error(`${requestID} does not exist`);
        }
        const request = JSON.parse(requestAsBytes.toString());
        request.status = action;
        request.comments = comments;
        request.modifiedDate = new Date().toISOString();
        await ctx.stub.putState(requestID, Buffer.from(JSON.stringify(request)));
        return JSON.stringify(request);
    }
}

module.exports = BCDentistryContract;
