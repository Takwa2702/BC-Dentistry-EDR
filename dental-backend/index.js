// index.js

const express = require('express');
const bodyParser = require('body-parser');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createSessionAuthenticator, verifySessionSchema } = require('./sessionAuth');
const { fabricIdentityForUser } = require('./fabricIdentity');
const { enrollIdentity, retireIdentity } = require('./fabricEnrollment');
const { sha256File, verifyFileIntegrity } = require('./radiographicIntegrity');
const { validateRadiographicFile } = require('./radiographicFileValidation');
const {
    pushStatus,
    registerPushSubscription,
    unregisterPushSubscription,
    listPushSubscriptions,
    removePushSubscription,
    pruneStaleSubscriptions,
    sendPushNotification,
} = require('./pushNotifications');

require('dotenv').config();

const app = express();
app.disable('x-powered-by');
app.use(bodyParser.json());
const blockchainInternalToken = process.env.BLOCKCHAIN_INTERNAL_TOKEN;

if (process.env.NODE_ENV === 'production' && !blockchainInternalToken) {
    throw new Error('BLOCKCHAIN_INTERNAL_TOKEN is required in production');
}

const ccpPath = path.resolve(__dirname, process.env.FABRIC_CONNECTION_PROFILE || './connection/connection-org1.json');
const walletPath = path.resolve(__dirname, process.env.FABRIC_WALLET_PATH || './wallet');
const fabricChannel = process.env.FABRIC_CHANNEL || 'mychannel';
const fabricChaincode = process.env.FABRIC_CHAINCODE || 'basic';
const discoveryEnabled = process.env.FABRIC_DISCOVERY_ENABLED !== 'false';
const discoveryAsLocalhost = process.env.FABRIC_DISCOVERY_AS_LOCALHOST !== 'false';
const radiographicStorageRoot = path.resolve(__dirname, process.env.RADIOGRAPHIC_STORAGE_ROOT || './data/radiographic-files');
const radiographicMaxFileBytes = Number(process.env.RADIOGRAPHIC_MAX_FILE_BYTES || 536870912);

const ROLE_ALIASES = {
    admin: 'admin',
    administrator: 'admin',
    doctor: 'doctor',
    patient: 'patient',
    system: 'system',
    sysadmin: 'system'
};

const normalizeRole = (role) => {
    const normalized = String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    return ROLE_ALIASES[normalized] || normalized;
};

const isRole = (req, role) => normalizeRole(req.user?.role) === normalizeRole(role);
const sendApiError = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

const authenticateToken = createSessionAuthenticator(sendApiError);

const requireRoles = (...allowedRoles) => {
    const allowed = allowedRoles.map(normalizeRole);

    return (req, res, next) => {
        const userRole = normalizeRole(req.user?.role);

        if (!userRole || !allowed.includes(userRole)) {
            return sendApiError(res, 403, 'FORBIDDEN', 'Forbidden: insufficient role permissions');
        }

        next();
    };
};

const requireAdminClinicParam = (paramName) => (req, res, next) => {
    if (!isRole(req, 'admin')) {
        return next();
    }

    const requestedClinicID = req.params[paramName];

    if (requestedClinicID === undefined || requestedClinicID === null || requestedClinicID === '') {
        return next();
    }

    if (!req.user.organizationId || String(req.user.organizationId) !== String(requestedClinicID)) {
        return res.status(403).json({ error: 'Forbidden: clinic access is limited to the authenticated admin organization' });
    }

    next();
};

const requireAdminClinicBody = (fieldName) => (req, res, next) => {
    if (!isRole(req, 'admin')) {
        return next();
    }

    const requestedClinicID = req.body[fieldName];

    if (requestedClinicID === undefined || requestedClinicID === null || requestedClinicID === '') {
        return next();
    }

    if (!req.user.organizationId || String(req.user.organizationId) !== String(requestedClinicID)) {
        return res.status(403).json({ error: 'Forbidden: clinic access is limited to the authenticated admin organization' });
    }

    next();
};

const requireDoctorSelfParam = (paramName) => (req, res, next) => {
    if (!isRole(req, 'doctor')) {
        return next();
    }

    const requestedDoctorID = req.params[paramName];

    if (requestedDoctorID === undefined || requestedDoctorID === null || requestedDoctorID === '') {
        return next();
    }

    if (!req.user.blockchainID || String(req.user.blockchainID) !== String(requestedDoctorID)) {
        return res.status(403).json({ error: 'Forbidden: doctor access is limited to the authenticated doctor identity' });
    }

    next();
};

const requireDoctorSelfBody = (fieldName) => (req, res, next) => {
    if (!isRole(req, 'doctor')) {
        return next();
    }

    const requestedDoctorID = req.body[fieldName];

    if (requestedDoctorID === undefined || requestedDoctorID === null || requestedDoctorID === '') {
        return next();
    }

    if (!req.user.blockchainID || String(req.user.blockchainID) !== String(requestedDoctorID)) {
        return res.status(403).json({ error: 'Forbidden: doctor access is limited to the authenticated doctor identity' });
    }

    next();
};

const requirePatientSelfParam = (paramName) => (req, res, next) => {
    if (!isRole(req, 'patient')) {
        return next();
    }

    const requestedPatientID = req.params[paramName];

    if (requestedPatientID === undefined || requestedPatientID === null || requestedPatientID === '') {
        return next();
    }

    if (!req.user.blockchainID || String(req.user.blockchainID) !== String(requestedPatientID)) {
        return res.status(403).json({ error: 'Forbidden: patient access is limited to the authenticated patient identity' });
    }

    next();
};

const requirePatientSelfBody = (fieldName) => (req, res, next) => {
    if (!isRole(req, 'patient')) {
        return next();
    }

    const requestedPatientID = req.body[fieldName];

    if (requestedPatientID === undefined || requestedPatientID === null || requestedPatientID === '') {
        return next();
    }

    if (!req.user.blockchainID || String(req.user.blockchainID) !== String(requestedPatientID)) {
        return res.status(403).json({ error: 'Forbidden: patient access is limited to the authenticated patient identity' });
    }

    next();
};

console.log('Connection profile path:', ccpPath);
console.log('Fabric wallet path:', walletPath);

let connectionProfile;

app.get('/health', async (req, res) => {
    const profileReady = fs.existsSync(ccpPath);
    const walletReady = fs.existsSync(walletPath)
        && fs.readdirSync(walletPath).some((entry) => entry.endsWith('.id'));
    const sessionSchemaReady = await verifySessionSchema().catch(() => false);
    return res.status(profileReady && walletReady && sessionSchemaReady ? 200 : 503).json({
        status: profileReady && walletReady && sessionSchemaReady ? 'ok' : 'not-ready',
        service: 'blockchain-api',
        fabric: { profileReady, walletReady, channel: fabricChannel, chaincode: fabricChaincode },
        sessionSchema: sessionSchemaReady,
    });
});

const requireInternalService = (req, res, next) => {
    const suppliedBuffer = Buffer.from(req.get('x-edr-internal-token') || '');
    const expectedBuffer = Buffer.from(blockchainInternalToken || '');
    if (!expectedBuffer.length || suppliedBuffer.length !== expectedBuffer.length
        || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) {
        return sendApiError(res, 401, 'INTERNAL_SERVICE_AUTH_REQUIRED', 'Internal service authentication is required');
    }
    return next();
};

// Health remains reachable on the private service network for orchestration.
// Every business route below additionally requires application-service proof.
app.use(requireInternalService);

const getConnectionProfile = () => {
    if (connectionProfile) {
        return connectionProfile;
    }

    if (!fs.existsSync(ccpPath)) {
        const error = new Error(`Fabric connection profile not found at ${ccpPath}`);
        error.statusCode = 503;
        throw error;
    }

    connectionProfile = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    return connectionProfile;
};

const sendFabricError = (res, error) => {
    const message = error.message || String(error);
    const patientHasNoDataAtClinic = /does not have data in Clinic/i.test(message);
    const statusCode = error.statusCode
        || (/access denied|not authorized|forbidden|requires .* role|does not match/i.test(message) ? 403 : null)
        || (/does not exist|not found/i.test(message) ? 404 : null)
        || (patientHasNoDataAtClinic ? 409 : null)
        || (/cannot be approved at this stage|not waiting for patient consent|cannot be rejected at this stage|does not have active consent|already (?:processed|approved|rejected|revoked)|was rejected and cannot be resubmitted/i.test(message) ? 409 : null)
        || (/missing required|cannot be rejected at this stage/i.test(message) ? 400 : null)
        || 500;
    res.status(statusCode).json({
        success: false,
        error: {
            code: error.code || (patientHasNoDataAtClinic ? 'PATIENT_HAS_NO_DATA_IN_REQUESTED_CLINIC' : statusCode === 409 ? 'ALREADY_PROCESSED' : statusCode === 400 ? 'VALIDATION_ERROR' : statusCode === 403 ? 'FORBIDDEN' : 'BLOCKCHAIN_ERROR'),
            message
        }
    });
};

const sendSuccess = (res, data, statusCode = 200, aliases = []) => res.status(statusCode).json({
    success: true,
    data,
    ...(aliases.length ? { compatibleAliases: aliases } : {})
});

const fabricIdentityForRequest = (req) => {
    return fabricIdentityForUser(req.user);
};

const withContract = async (req, callback) => {
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const gateway = new Gateway();
    const identity = fabricIdentityForRequest(req);

    if (!await wallet.get(identity)) {
        if (isRole(req, 'admin') && req.user.organizationId) {
            await enrollIdentity({
                ccpPath,
                walletPath,
                role: 'admin',
                actorID: `AdminClinic${req.user.organizationId}`,
                clinicID: req.user.organizationId,
            });
        }
        if (!await wallet.get(identity)) {
            const error = new Error(`Fabric identity ${identity} is not enrolled in the configured wallet.`);
            error.statusCode = 503;
            throw error;
        }
    }

    try {
        await gateway.connect(getConnectionProfile(), {
            wallet,
            identity,
            discovery: { enabled: discoveryEnabled, asLocalhost: discoveryAsLocalhost },
        });

        const network = await gateway.getNetwork(fabricChannel);
        const contract = network.getContract(fabricChaincode);
        return await callback(contract);
    } finally {
        gateway.disconnect();
    }
};

const parseBufferJson = (buffer) => {
    const text = buffer.toString();
    return text ? JSON.parse(text) : {};
};

const FABRIC_QUERY_PAGE_SIZE = 100;
const FABRIC_QUERY_MAX_PAGES = 100;
const FABRIC_QUERY_MAX_RECORDS = FABRIC_QUERY_PAGE_SIZE * FABRIC_QUERY_MAX_PAGES;

const evaluateAllFabricPages = async (contract, transaction, leadingArgs = []) => {
    const records = [];
    let bookmark = '';
    const seenBookmarks = new Set();

    for (let pageNumber = 1; pageNumber <= FABRIC_QUERY_MAX_PAGES; pageNumber += 1) {
        const result = await contract.evaluateTransaction(
            transaction, ...leadingArgs.map(String), String(FABRIC_QUERY_PAGE_SIZE), bookmark
        );
        const page = parseBufferJson(result);
        if (!page || !Array.isArray(page.records)) {
            throw Object.assign(new Error(`${transaction} returned an invalid paginated response`), { statusCode: 502 });
        }
        records.push(...page.records);
        const nextBookmark = String(page.bookmark || '');
        if (!nextBookmark) return records;
        if (records.length >= FABRIC_QUERY_MAX_RECORDS || seenBookmarks.has(nextBookmark)) {
            throw Object.assign(new Error(`${transaction} exceeded the bounded pagination safety limit`), { statusCode: 502 });
        }
        seenBookmarks.add(nextBookmark);
        bookmark = nextBookmark;
    }

    throw Object.assign(new Error(`${transaction} did not complete within ${FABRIC_QUERY_MAX_PAGES} pages`), { statusCode: 502 });
};

const submitClinicDeactivationBatches = async (contract, clinicID) => {
    const totals = { actorsDeactivated: 0, requestsCancelled: 0, batches: 0 };
    let bookmarks = { doctor: '', patient: '', originRequest: '', requestingRequest: '' };
    const seenContinuations = new Set();

    for (let batch = 1; batch <= FABRIC_QUERY_MAX_PAGES; batch += 1) {
        const result = parseBufferJson(await contract.submitTransaction(
            'DeactivateClinicActors', String(clinicID), String(FABRIC_QUERY_PAGE_SIZE),
            bookmarks.doctor, bookmarks.patient, bookmarks.originRequest, bookmarks.requestingRequest
        ));
        totals.actorsDeactivated += Number(result.actorsDeactivated || 0);
        totals.requestsCancelled += Number(result.requestsCancelled || 0);
        totals.batches = batch;
        bookmarks = { doctor: '', patient: '', originRequest: '', requestingRequest: '', ...(result.bookmarks || {}) };
        if (result.complete === true || !Object.values(bookmarks).some(Boolean)) {
            return { clinicID: String(clinicID), ...totals, historyPreserved: true, complete: true };
        }
        const continuation = JSON.stringify(bookmarks);
        if (seenContinuations.has(continuation)) {
            throw Object.assign(new Error('Clinic deactivation returned a repeated Fabric bookmark'), { statusCode: 502 });
        }
        seenContinuations.add(continuation);
    }

    throw Object.assign(new Error('Clinic deactivation exceeded the bounded batch safety limit'), { statusCode: 502 });
};

const submitQueryIndexBackfill = async (contract) => {
    const summary = { indexedRecords: 0, fetchedRecordsCount: 0, batches: 0 };
    let bookmark = '';
    const seenBookmarks = new Set();

    for (let batch = 1; batch <= FABRIC_QUERY_MAX_PAGES; batch += 1) {
        const result = parseBufferJson(await contract.submitTransaction(
            'BackfillQueryIndexes', String(FABRIC_QUERY_PAGE_SIZE), bookmark
        ));
        summary.indexedRecords += Number(result.indexedRecords || 0);
        summary.fetchedRecordsCount += Number(result.fetchedRecordsCount || 0);
        summary.batches = batch;
        const nextBookmark = String(result.bookmark || '');
        if (result.complete === true || !nextBookmark) return { ...summary, complete: true };
        if (seenBookmarks.has(nextBookmark)) {
            throw Object.assign(new Error('Query-index backfill returned a repeated Fabric bookmark'), { statusCode: 502 });
        }
        seenBookmarks.add(nextBookmark);
        bookmark = nextBookmark;
    }

    throw Object.assign(new Error('Query-index backfill exceeded the bounded batch safety limit'), { statusCode: 502 });
};

const requireFields = (body, fields) => {
    const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');

    if (missing.length > 0) {
        const error = new Error(`Missing required fields: ${missing.join(', ')}`);
        error.statusCode = 400;
        throw error;
    }
};

const accessRequestDetails = (body) => ({
    workflowType: 'REFERRAL',
    reason: body.reason || body.purpose,
    urgency: body.urgency || 'routine',
    notes: body.notes || '',
    expiresAt: body.expiresAt || null,
    requestedRecordTypes: Array.isArray(body.requestedRecordTypes) && body.requestedRecordTypes.length
        ? body.requestedRecordTypes
        : [body.dataType || 'Dental and Medical Records'],
});

const notificationTargetFromUser = (user) => {
    if (isRole({ user }, 'admin')) {
        return { role: 'admin', id: user.organizationId };
    }
    if (isRole({ user }, 'patient') || isRole({ user }, 'doctor')) {
        return { role: normalizeRole(user.role), id: user.blockchainID };
    }
    return { role: normalizeRole(user.role), id: user.blockchainID || user.organizationId || user.id };
};

const requireValidPatientNames = (body) => {
    for (const field of ['firstName', 'lastName']) {
        if (Array.from(String(body[field] || '')).length > 100) {
            const error = new Error(`${field === 'firstName' ? 'First' : 'Last'} name must be 100 characters or fewer`);
            error.statusCode = 400;
            error.code = 'PATIENT_NAME_TOO_LONG';
            throw error;
        }
    }
};

const requireLegacyProfileBounds = (body, entity) => {
    requireValidPatientNames(body);
    const limits = entity === 'doctor'
        ? { email: 254, contactNumber: 25, emiratesID: 18, speciality: 100, worksAt: 255, licenseNumber: 100 }
        : { email: 254, contactNumber: 25, emiratesID: 18, address: 1000 };
    for (const [field, max] of Object.entries(limits)) {
        if (Array.from(String(body[field] || '')).length > max) {
            const error = new Error(`${field} must be ${max} characters or fewer`); error.statusCode = 400; error.code = 'FIELD_TOO_LONG'; throw error;
        }
    }
    if (!/^\S+@\S+\.\S+$/.test(String(body.email)) || Array.from(String(body.email)).length > 254) {
        const error = new Error('Invalid email address'); error.statusCode = 400; error.code = 'INVALID_EMAIL'; throw error;
    }
    if (!/^\+?[0-9][0-9 ()-]{6,24}$/.test(String(body.contactNumber))) {
        const error = new Error('Invalid contact number'); error.statusCode = 400; error.code = 'INVALID_CONTACT_NUMBER'; throw error;
    }
    if (!/^784-\d{4}-\d{7}-\d$/.test(String(body.emiratesID))) {
        const error = new Error('Emirates ID must use the format 784-YYYY-NNNNNNN-C'); error.statusCode = 400; error.code = 'INVALID_EMIRATES_ID'; throw error;
    }
};

app.post('/internal/identities', authenticateToken, requireRoles('admin', 'system'), async (req, res) => {
    try {
        requireFields(req.body, ['role', 'actorID']);
        if (isRole(req, 'admin') && Number(req.body.clinicID) !== Number(req.user.organizationId)) {
            return sendApiError(res, 403, 'CLINIC_SCOPE_DENIED', 'Identity clinic must match the authenticated admin organization');
        }
        const result = await enrollIdentity({
            ccpPath,
            walletPath,
            role: req.body.role,
            actorID: req.body.actorID,
            clinicID: req.body.clinicID,
        });
        return sendSuccess(res, result, result.created ? 201 : 200);
    } catch (error) {
        return sendApiError(res, error.statusCode || 503, 'FABRIC_IDENTITY_PROVISIONING_FAILED', error.message);
    }
});

app.delete('/internal/identities', authenticateToken, requireRoles('admin', 'system'), async (req, res) => {
    try {
        requireFields(req.body, ['role', 'actorID', 'clinicID']);
        if (isRole(req, 'admin') && Number(req.body.clinicID) !== Number(req.user.organizationId)) {
            return sendApiError(res, 403, 'CLINIC_SCOPE_DENIED', 'Identity clinic must match the authenticated admin organization');
        }
        const result = await retireIdentity({
            ccpPath, walletPath, role: req.body.role, actorID: req.body.actorID, clinicID: req.body.clinicID,
        });
        return sendSuccess(res, result);
    } catch (error) {
        return sendApiError(res, error.statusCode || 503, 'FABRIC_IDENTITY_RETIREMENT_FAILED', error.message);
    }
});

app.post('/internal/clinics/:clinicID/deactivate', authenticateToken, requireRoles('system'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => submitClinicDeactivationBatches(contract, req.params.clinicID));
        return sendSuccess(res, result);
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/internal/indexes/backfill', authenticateToken, requireRoles('system'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => submitQueryIndexBackfill(contract));
        return sendSuccess(res, result);
    } catch (error) { return sendFabricError(res, error); }
});

const notificationDeepLink = (notification) => {
    const requestID = notification.relatedRequestID || notification.payload?.requestID;
    const query = requestID ? `?requestId=${encodeURIComponent(requestID)}` : '';
    if (notification.type === 'ACCESS_REQUEST_PENDING_ADMIN') return `/datarequests${query}`;
    if (notification.recipientRole === 'doctor' && notification.payload?.patientID) {
        return `/patients/${encodeURIComponent(notification.payload.patientID)}${query}`;
    }
    if (notification.recipientRole === 'patient' && notification.relatedRequestID) return `/patient-requests${query}`;
    if (notification.recipientRole === 'patient') return `/my-record${query}`;
    return '/dashboard';
};

const pushTitleForType = {
    ACCESS_REQUEST_PENDING_ADMIN: 'New data access request',
    ACCESS_REQUEST_PENDING_PATIENT: 'Your consent is required',
    ACCESS_REQUEST_CONSENT_GRANTED: 'Patient consent granted',
    ACCESS_REQUEST_REJECTED: 'Data access request rejected',
    ACCESS_REQUEST_CONSENT_REVOKED: 'Patient consent revoked',
};

const pushBodyForType = {
    ACCESS_REQUEST_PENDING_ADMIN: 'Open EDR to review the new request.',
    ACCESS_REQUEST_PENDING_PATIENT: 'Open EDR to review and respond.',
    ACCESS_REQUEST_CONSENT_GRANTED: 'Open EDR to view the updated request.',
    ACCESS_REQUEST_REJECTED: 'Open EDR to view the updated request.',
    ACCESS_REQUEST_CONSENT_REVOKED: 'Open EDR to view the updated request.',
};

const dispatchNotificationPush = async (notification) => {
    if (!notification?.recipientRole) return;
    const recipientID = notification.recipientRole === 'admin'
        ? notification.recipientClinicID
        : notification.recipientActorID;
    const deepLink = notificationDeepLink(notification);
    try {
        const delivery = await sendPushNotification({
            role: notification.recipientRole,
            recipientID,
            title: pushTitleForType[notification.type] || 'EDR notification',
            // Avoid exposing patient identifiers or clinical details on a locked device.
            body: pushBodyForType[notification.type] || 'Open EDR to view this notification.',
            data: {
                notificationID: notification.notificationID,
                notificationType: notification.type,
                requestID: notification.relatedRequestID || notification.payload?.requestID,
                deepLink,
            },
        });
        console.info('Push notification delivery', { type: notification.type, recipientID, ...delivery });
    } catch (error) {
        // The Fabric transaction is authoritative. Push delivery is best-effort and must not
        // turn a committed clinical workflow into an HTTP failure.
        console.error(`Push notification delivery failed: ${error.message}`);
    }
};

const readPatientHandler = async (req, res) => {
    try {
        const patientID = req.params.id || req.params.patientID;
        const result = await withContract(req, (contract) => contract.evaluateTransaction('ReadPatient', String(patientID)));
        let accessLog = null;
        if (isRole(req, 'doctor')) {
            const accessLogResult = await withContract(req, (contract) => contract.submitTransaction(
                'LogClinicalAccess', String(patientID), 'patient-record', String(req.query.purpose || 'patient record review')
            ));
            accessLog = parseBufferJson(accessLogResult);
        }
        return res.status(200).json({
            success: true,
            data: parseBufferJson(result),
            ...(accessLog ? { accessLog } : {}),
        });
    } catch (error) {
        return sendFabricError(res, error);
    }
};

const requestAccessHandler = async (req, res) => {
    try {
        requireFields(req.body, ['doctorID', 'patientID', 'dataOriginClinicID', 'dataType', 'purpose', 'expiresAt']);
        const expiresAt = Date.parse(req.body.expiresAt);
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            return sendApiError(res, 400, 'INVALID_REFERRAL_EXPIRY', 'Referral expiry must be a valid future date');
        }
        const existingResult = await withContract(req, (contract) => contract.evaluateTransaction(
            'GetActiveDataAccessRequest', String(req.body.doctorID), String(req.body.patientID),
            String(req.body.dataOriginClinicID), String(req.body.dataType)
        ));
        const existing = parseBufferJson(existingResult);
        if (existing) return sendSuccess(res, {
            requestID: existing.requestID,
            transactionID: existing.requestID,
            alreadyPending: true,
            idempotent: true,
            status: existing.status,
            dataOriginClinicID: existing.dataOriginClinicID,
            requestingClinicID: existing.requestingClinicID,
            message: 'An active data-access request already exists; no duplicate request or notification was created',
        });
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'RequestDataAccess',
            String(req.body.doctorID),
            String(req.body.patientID),
            String(req.body.dataOriginClinicID),
            String(req.body.dataType),
            String(req.body.purpose),
            JSON.stringify(accessRequestDetails(req.body))
        ));
        const requestID = result.toString();
        await dispatchNotificationPush({
            notificationID: `NOTIFICATION:${requestID}:ADMIN_REVIEW`,
            recipientRole: 'admin',
            recipientClinicID: req.body.dataOriginClinicID,
            type: 'ACCESS_REQUEST_PENDING_ADMIN',
            relatedRequestID: requestID,
            message: `A doctor requested ${req.body.dataType} for patient ${req.body.patientID}.`,
            payload: { requestID, patientID: req.body.patientID, doctorID: req.body.doctorID },
        });
        return sendSuccess(res, {
            requestID,
            transactionID: requestID,
            status: 'PENDING_ADMIN_APPROVAL',
            dataOriginClinicID: Number(req.body.dataOriginClinicID),
            requestingClinicID: Number(req.user.organizationId),
        }, 201);
    } catch (error) {
        return sendFabricError(res, error);
    }
};

const grantConsentHandler = async (req, res) => {
    try {
        requireFields(req.body, ['patientID', 'requestID']);
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'ProvideConsent', String(req.body.patientID), String(req.body.requestID)
        ));
        const response = parseBufferJson(result);
        await dispatchNotificationPush(response.notification);
        return sendSuccess(res, response);
    } catch (error) {
        return sendFabricError(res, error);
    }
};

app.get(['/getPatientByID/:id', '/readPatient/:id'], authenticateToken, requireRoles('admin', 'doctor', 'patient', 'system'), requirePatientSelfParam('id'), readPatientHandler);

app.post('/patient-metadata', authenticateToken, requireRoles('admin'), requireAdminClinicBody('clinicID'), async (req, res) => {
    try {
        requireFields(req.body, ['patientID', 'clinicID', 'offChainRef', 'dataHash']);
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'AddPatientMetadata', String(req.body.patientID), String(req.body.clinicID), String(req.body.offChainRef),
            String(req.body.dataHash), JSON.stringify(req.body.doctors || []), new Date().toISOString()
        ));
        return sendSuccess(res, parseBufferJson(result), 201);
    } catch (error) { return sendFabricError(res, error); }
});

app.put('/patient-metadata/:id', authenticateToken, requireRoles('admin'), requireAdminClinicBody('clinicID'), async (req, res) => {
    try {
        requireFields(req.body, ['clinicID', 'offChainRef', 'dataHash']);
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'UpdatePatientMetadata', String(req.params.id), String(req.body.clinicID), String(req.body.offChainRef),
            String(req.body.dataHash), JSON.stringify(req.body.doctors || []), new Date().toISOString()
        ));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.delete('/patient-metadata/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.submitTransaction('DeactivatePatient', String(req.params.id)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/addMedicalRecord', authenticateToken, requireRoles('doctor'), requireDoctorSelfBody('doctorID'), async (req, res) => {
    try {
        requireFields(req.body, ['recordID', 'patientID', 'offChainRef', 'dataHash', 'doctorID', 'createdAt']);
        const result = await withContract(req, (contract) => contract.submitTransaction('AddMedicalRecord', String(req.body.recordID), String(req.body.patientID), String(req.body.offChainRef), String(req.body.dataHash), String(req.body.doctorID), String(req.body.createdAt)));
        return sendSuccess(res, parseBufferJson(result), 201);
    } catch (error) {
        return sendFabricError(res, error);
    }
});

app.post('/clinical-record-metadata', authenticateToken, requireRoles('doctor'), requireDoctorSelfBody('doctorID'), async (req, res) => {
    try {
        requireFields(req.body, ['recordID', 'recordType', 'patientID', 'offChainRef', 'dataHash', 'doctorID', 'createdAt']);
        if (!['medical', 'dental'].includes(req.body.recordType)) return sendApiError(res, 400, 'VALIDATION_ERROR', 'recordType must be medical or dental');
        const transaction = req.body.recordType === 'medical' ? 'AddMedicalRecord' : 'AddDentalChartEntry';
        const result = await withContract(req, (contract) => contract.submitTransaction(transaction,
            String(req.body.recordID), String(req.body.patientID), String(req.body.offChainRef), String(req.body.dataHash), String(req.body.doctorID), String(req.body.createdAt)));
        return sendSuccess(res, parseBufferJson(result), 201);
    } catch (error) { return sendFabricError(res, error); }
});

app.get('/clinical-records/:patientID/:recordType', authenticateToken, requireRoles('doctor', 'patient'), requirePatientSelfParam('patientID'), async (req, res) => {
    try {
        if (!['medical', 'dental'].includes(req.params.recordType)) return sendApiError(res, 400, 'VALIDATION_ERROR', 'recordType must be medical or dental');
        const transaction = req.params.recordType === 'medical' ? 'GetMedicalRecords' : 'GetAllDentalChartData';
        const result = await withContract(req, (contract) => contract.evaluateTransaction(transaction, String(req.params.patientID)));
        const accessLogResult = await withContract(req, (contract) => contract.submitTransaction('LogClinicalAccess', String(req.params.patientID), String(req.params.recordType), String(req.query.purpose || 'clinical care')));
        return sendSuccess(res, { records: parseBufferJson(result), accessLog: parseBufferJson(accessLogResult) });
    } catch (error) { return sendFabricError(res, error); }
});

app.get('/clinical-access-logs/:patientID', authenticateToken, requireRoles('patient', 'system'), requirePatientSelfParam('patientID'), async (req, res) => {
    try { const result = await withContract(req, (contract) => contract.evaluateTransaction('GetClinicalAccessLogs', String(req.params.patientID))); return sendSuccess(res, parseBufferJson(result)); }
    catch (error) { return sendFabricError(res, error); }
});

app.get(['/audit/clinical-access/:patientID', '/getAccessAuditLogs/:patientID'], authenticateToken, requireRoles('admin', 'patient', 'system'), requirePatientSelfParam('patientID'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.evaluateTransaction('GetClinicalAccessLogs', String(req.params.patientID)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/radiographic-files', authenticateToken, requireRoles('doctor'), express.raw({ type: 'application/octet-stream', limit: radiographicMaxFileBytes }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return sendApiError(res, 400, 'FILE_REQUIRED', 'A DICOM or radiographic file is required');
    const fileValidation = validateRadiographicFile({
        bytes: req.body,
        fileName: req.headers['x-file-name'],
        mediaType: req.headers['x-file-media-type'],
    });
    if (!fileValidation.valid) return sendApiError(res, 415, fileValidation.code || 'UNSUPPORTED_RADIOGRAPHIC_FILE_TYPE', fileValidation.reason);
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim() || null;
    if (idempotencyKey && idempotencyKey.length > 128) return sendApiError(res, 400, 'IDEMPOTENCY_KEY_TOO_LONG', 'Idempotency key must not exceed 128 characters');
    const patientID = req.headers['x-patient-id'];
    const contentHash = crypto.createHash('sha256').update(req.body).digest('hex');
    const idHex = idempotencyKey ? crypto.createHash('sha256').update(`${req.user.blockchainID}:${patientID}:${idempotencyKey}`).digest('hex').slice(0, 32) : null;
    const fileID = idHex ? `${idHex.slice(0,8)}-${idHex.slice(8,12)}-4${idHex.slice(13,16)}-a${idHex.slice(17,20)}-${idHex.slice(20,32)}` : crypto.randomUUID();
    fs.mkdirSync(radiographicStorageRoot, { recursive: true });
    const filePath = path.join(radiographicStorageRoot, fileID);
    try {
        const fileName = req.headers['x-file-name'];
        if (!patientID || !fileName) { const error = new Error('Missing required headers: x-patient-id, x-file-name'); error.statusCode = 400; throw error; }
        const uploaderID = req.user.blockchainID;
        if (!uploaderID) { const error = new Error('Authenticated doctor is missing a blockchain identity'); error.statusCode = 403; throw error; }
        if (idempotencyKey && fs.existsSync(filePath)) {
            const existingResult = await withContract(req, (contract) => contract.evaluateTransaction('GetDentalFile', fileID));
            const existing = parseBufferJson(existingResult);
            if (existing.sha256 !== contentHash || existing.patientID !== String(patientID)) return sendApiError(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different radiographic file');
            return sendSuccess(res, { ...existing, alreadyProcessed:true, idempotent:true, message:'This radiographic upload was already processed; the existing file was returned' });
        }
        await fs.promises.writeFile(filePath, req.body, { flag: 'wx' });
        const sha256 = await sha256File(filePath);
        const metadata = {
            fileID, patientID: String(patientID), storageReference: `filesystem:${fileID}`,
            fileName: String(fileName), mediaType: fileValidation.mediaType, fileSize: req.body.length,
            sha256, uploaderID: String(uploaderID), uploadedAt: new Date().toISOString()
        };
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'AddDentalFileMetadata', metadata.fileID, metadata.patientID, metadata.storageReference,
            metadata.fileName, metadata.mediaType, String(metadata.fileSize), metadata.sha256,
            metadata.uploaderID, metadata.uploadedAt
        ));
        return sendSuccess(res, parseBufferJson(result), 201);
    } catch (error) {
        await fs.promises.unlink(filePath).catch(() => {});
        return sendFabricError(res, error);
    }
});

app.get('/patients/:patientID/radiographic-files', authenticateToken, requireRoles('admin', 'doctor', 'patient', 'system'), requirePatientSelfParam('patientID'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.evaluateTransaction('getDentalFiles', String(req.params.patientID)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.get('/radiographic-files/:fileID/verify-integrity', authenticateToken, requireRoles('admin', 'doctor', 'patient', 'system'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.evaluateTransaction('GetDentalFile', String(req.params.fileID)));
        const metadata = parseBufferJson(result);
        if (!metadata.sha256 || !metadata.storageReference?.startsWith('filesystem:')) {
            return sendSuccess(res, { fileID: req.params.fileID, status: 'unknown', expectedSha256: metadata.sha256 || null, actualSha256: null });
        }
        const storedID = metadata.storageReference.slice('filesystem:'.length);
        if (storedID !== req.params.fileID || !/^[0-9a-f-]{36}$/i.test(storedID)) {
            return sendSuccess(res, { fileID: req.params.fileID, status: 'unknown', expectedSha256: metadata.sha256, actualSha256: null });
        }
        const filePath = path.join(radiographicStorageRoot, storedID);
        const verification = await verifyFileIntegrity(filePath, metadata.sha256);
        return sendSuccess(res, { fileID: req.params.fileID, ...verification, expectedSha256: metadata.sha256 });
    } catch (error) { return sendFabricError(res, error); }
});

app.get('/radiographic-files/:fileID/content', authenticateToken, requireRoles('doctor', 'patient'), async (req, res) => {
    try {
        const fileID = String(req.params.fileID);
        const result = await withContract(req, (contract) => contract.evaluateTransaction('GetDentalFile', fileID));
        const metadata = parseBufferJson(result);
        if (!metadata.storageReference?.startsWith('filesystem:') || !metadata.sha256) return sendApiError(res, 422, 'INVALID_FILE_METADATA', 'The radiographic file does not have a valid private-storage reference and hash');
        const storedID = metadata.storageReference.slice('filesystem:'.length);
        if (storedID !== fileID || !/^[0-9a-f-]{36}$/i.test(storedID)) return sendApiError(res, 422, 'INVALID_FILE_METADATA', 'The radiographic storage reference is invalid');
        const filePath = path.join(radiographicStorageRoot, storedID);
        const verification = await verifyFileIntegrity(filePath, metadata.sha256);
        if (verification.status === 'missing file') return sendApiError(res, 404, 'FILE_NOT_FOUND', 'The radiographic file is missing from private storage');
        if (verification.status !== 'verified') return sendApiError(res, 409, 'INTEGRITY_CHECK_FAILED', 'The radiographic file failed integrity verification and will not be streamed');
        const accessLogResult = await withContract(req, (contract) => contract.submitTransaction('LogClinicalAccess', String(metadata.patientID), 'radiographic', String(req.query.purpose || 'radiographic image view')));
        const accessLog = parseBufferJson(accessLogResult);
        const stat = await fs.promises.stat(filePath);
        const mediaType = /^image\/(jpeg|png|webp)$/i.test(metadata.mediaType) ? metadata.mediaType : 'application/dicom';
        const safeName = path.basename(String(metadata.fileName || `${fileID}.dcm`));
        res.status(200);
        res.setHeader('Content-Type', mediaType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Access-Transaction-ID', accessLog.transactionID);
        const stream = fs.createReadStream(filePath);
        stream.on('error', (error) => { if (!res.headersSent) sendFabricError(res, error); else res.destroy(error); });
        stream.pipe(res);
    } catch (error) { return sendFabricError(res, error); }
});

app.get('/getDentalChartData/:id', authenticateToken, requireRoles('admin', 'doctor', 'patient', 'system'), requirePatientSelfParam('id'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.evaluateTransaction('getAllDentalChartData', String(req.params.id)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) {
        return sendFabricError(res, error);
    }
});

app.post(['/requestDataAccess', '/requestAccess'], authenticateToken, requireRoles('doctor'), requireDoctorSelfBody('doctorID'), requestAccessHandler);
app.get('/referrals', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => evaluateAllFabricPages(contract, 'GetRequestsForDoctorPage', [req.user.blockchainID]));
        return sendSuccess(res, result);
    } catch (error) { return sendFabricError(res, error); }
});
app.post('/grantConsent', authenticateToken, requireRoles('patient'), requirePatientSelfBody('patientID'), grantConsentHandler);

app.get(['/accessRequests/:requestID', '/transferRequests/:requestID'], authenticateToken, requireRoles('patient'), async (req, res) => {
    try {
        if (!req.user.blockchainID) {
            const error = new Error('Authenticated patient is missing a blockchain identity');
            error.statusCode = 403;
            throw error;
        }
        const result = await withContract(req, (contract) => contract.evaluateTransaction(
            'ReadDataAccessRequest', String(req.user.blockchainID), String(req.params.requestID)
        ));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) {
        return sendFabricError(res, error);
    }
});

app.get('/getPendingRequests', authenticateToken, requireRoles('patient'), async (req, res) => {
    try {
        if (!req.user.blockchainID) {
            const error = new Error('Authenticated patient is missing a blockchain identity');
            error.statusCode = 403;
            throw error;
        }
        const result = await withContract(req, (contract) => evaluateAllFabricPages(contract, 'GetPendingRequestsForPatientPage', [req.user.blockchainID]));
        return sendSuccess(res, result);
    } catch (error) {
        return sendFabricError(res, error);
    }
});

app.get('/doctor/:id', authenticateToken, requireRoles('admin', 'doctor', 'system'), requireDoctorSelfParam('id'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.evaluateTransaction('ReadDoctor', String(req.params.id)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) {
        return sendFabricError(res, error);
    }
});

app.put('/patient/:id', authenticateToken, requireRoles('admin'), requireAdminClinicBody('clinicID'), async (req, res) => {
    try {
        requireFields(req.body, ['firstName', 'lastName', 'dateOfBirth', 'gender', 'emiratesID', 'email', 'contactNumber', 'address', 'clinicID']);
        requireLegacyProfileBounds(req.body, 'patient');
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'UpdatePatientInfo', String(req.params.id), String(req.body.firstName), String(req.body.lastName), String(req.body.dateOfBirth),
            String(req.body.gender), String(req.body.emiratesID), String(req.body.email), String(req.body.contactNumber), String(req.body.address),
            String(req.body.createdDate || new Date().toISOString()), JSON.stringify(req.body.doctors || []), String(req.body.clinicID), JSON.stringify(req.body.dentalChart || [])
        ));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.delete('/patient/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.submitTransaction('DeactivatePatient', String(req.params.id)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.put('/doctor/:id', authenticateToken, requireRoles('admin'), requireAdminClinicBody('clinicID'), async (req, res) => {
    try {
        if (req.body.doctorID !== undefined && String(req.body.doctorID) !== String(req.params.id)) {
            return sendApiError(res, 400, 'DOCTOR_ID_MISMATCH', 'doctorID is immutable and must match the URL');
        }
        if (req.body.patients !== undefined || req.body.createdDate !== undefined || req.body.modifiedDate !== undefined) {
            return sendApiError(res, 400, 'DOCTOR_PROTECTED_FIELD', 'Doctor relationships and immutable metadata cannot be changed through this route');
        }
        requireFields(req.body, ['firstName', 'lastName', 'emiratesID', 'speciality', 'worksAt', 'clinicID', 'email', 'contactNumber', 'licenseNumber']);
        requireLegacyProfileBounds(req.body, 'doctor');
        const result = await withContract(req, async (contract) => {
            let existingDoctor;
            try {
                existingDoctor = parseBufferJson(await contract.evaluateTransaction('ReadDoctor', String(req.params.id)));
            } catch (error) {
                if (/does not exist|not found/i.test(error.message || String(error))) {
                    error.statusCode = 404;
                    error.code = 'DOCTOR_NOT_FOUND';
                }
                throw error;
            }
            if (!existingDoctor || String(existingDoctor.doctorID) !== String(req.params.id)) {
                const error = new Error(`The doctor ${req.params.id} does not exist`);
                error.statusCode = 404;
                error.code = 'DOCTOR_NOT_FOUND';
                throw error;
            }
            if (Number(existingDoctor.clinicID) !== Number(req.body.clinicID)) {
                const error = new Error('Doctor belongs to a different clinic');
                error.statusCode = 403;
                error.code = 'DOCTOR_CLINIC_MISMATCH';
                throw error;
            }
            return contract.submitTransaction(
                'UpdateDoctorInfo', String(req.params.id), String(req.body.firstName), String(req.body.lastName), String(req.body.emiratesID), String(req.body.speciality),
                String(req.body.worksAt), String(req.body.clinicID), String(req.body.email), String(req.body.contactNumber),
                String(req.body.licenseNumber), '', '[]'
            );
        });
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.delete('/doctor/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.submitTransaction('DeactivateDoctor', String(req.params.id)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/admin/rejectRequest', authenticateToken, requireRoles('admin'), requireAdminClinicBody('adminClinicID'), async (req, res) => {
    try {
        requireFields(req.body, ['adminID', 'adminClinicID', 'requestID', 'rejectionReason']);
        const rejectionReason = String(req.body.rejectionReason).trim();
        if (!rejectionReason) return sendApiError(res, 400, 'REJECTION_REASON_REQUIRED', 'A rejection reason is required');
        if (Array.from(rejectionReason).length > 1000) return sendApiError(res, 400, 'REJECTION_REASON_TOO_LONG', 'Rejection reason must be 1000 characters or fewer');
        const result = await withContract(req, (contract) => contract.submitTransaction('RejectRequest', String(req.body.adminID), String(req.body.requestID), rejectionReason));
        const response = parseBufferJson(result);
        if (response.requestID !== req.body.requestID || response.status !== 'REJECTED' || response.accessGranted !== false) {
            return sendApiError(res, 502, 'INVALID_REJECTION_RESULT', 'The ledger did not return the expected rejected transition');
        }
        await dispatchNotificationPush(response.notification);
        return sendSuccess(res, response);
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/patient/rejectRequest', authenticateToken, requireRoles('patient'), requirePatientSelfBody('patientID'), async (req, res) => {
    try {
        requireFields(req.body, ['patientID', 'requestID', 'rejectionReason']);
        const result = await withContract(req, (contract) => contract.submitTransaction('RejectRequest', String(req.body.patientID), String(req.body.requestID), String(req.body.rejectionReason)));
        const response = parseBufferJson(result);
        if (response.requestID !== req.body.requestID || response.status !== 'REJECTED' || response.accessGranted !== false) {
            return sendApiError(res, 502, 'INVALID_REJECTION_RESULT', 'The ledger did not return the expected rejected transition');
        }
        await dispatchNotificationPush(response.notification);
        return sendSuccess(res, response);
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/addPatient', authenticateToken, requireRoles('admin'), requireAdminClinicBody('clinicID'), async (req, res) => {
    try {
        requireFields(req.body, [
            'patientID',
            'firstName',
            'lastName',
            'dateOfBirth',
            'gender',
            'emiratesID',
            'email',
            'contactNumber',
            'address',
            'clinicID'
        ]);

        const {
            patientID,
            firstName,
            lastName,
            dateOfBirth,
            gender,
            emiratesID,
            email,
            contactNumber,
            address,
            clinicID,
            doctors = [],
        } = req.body;
        const createdDate = req.body.createdDate || new Date().toISOString();

        const result = await withContract(req, (contract) => contract.submitTransaction(
            'addPatient',
            String(patientID),
            String(firstName),
            String(lastName),
            String(dateOfBirth),
            String(gender),
            String(emiratesID),
            String(email),
            String(contactNumber),
            String(address),
            String(createdDate),
            String(clinicID),
            JSON.stringify(doctors)
        ));

        res.status(201).json(parseBufferJson(result));
    } catch (error) {
        console.error(`Failed to add patient: ${error}`);
        sendFabricError(res, error);
    }
});

app.post('/addDoctor', authenticateToken, requireRoles('admin'), requireAdminClinicBody('clinicID'), async (req, res) => {
    try {
        requireFields(req.body, [
            'doctorID',
            'firstName',
            'lastName',
            'emiratesID',
            'speciality',
            'worksAt',
            'clinicID',
            'email',
            'contactNumber'
            ,'licenseNumber'
        ]);

        const {
            doctorID,
            firstName,
            lastName,
            emiratesID,
            speciality,
            worksAt,
            clinicID,
            email,
            contactNumber,
            licenseNumber,
            patients = [],
        } = req.body;
        const createdDate = req.body.createdDate || new Date().toISOString();

        const result = await withContract(req, (contract) => contract.submitTransaction(
            'addDoctor',
            String(doctorID),
            String(firstName),
            String(lastName),
            String(emiratesID),
            String(speciality),
            String(worksAt),
            String(clinicID),
            String(email),
            String(contactNumber),
            String(licenseNumber),
            String(createdDate),
            JSON.stringify(patients)
        ));

        res.status(201).json(parseBufferJson(result));
    } catch (error) {
        console.error(`Failed to add doctor: ${error}`);
        sendFabricError(res, error);
    }
});

app.post('/registerPatientInClinic', authenticateToken, requireRoles('admin'), requireAdminClinicBody('clinicID'), async (req, res) => {
    try {
        requireFields(req.body, ['patientID', 'clinicID']);
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'registerPatientInClinic',
            String(req.body.patientID),
            String(req.body.clinicID)
        ));

        res.json(parseBufferJson(result));
    } catch (error) {
        console.error(`Failed to register patient in clinic: ${error}`);
        sendFabricError(res, error);
    }
});

app.post('/assignPatientToDoctor', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        requireFields(req.body, ['patientID', 'doctorID']);
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'assignPatientToDoctor',
            String(req.body.patientID),
            String(req.body.doctorID),
            String(req.body.dataHash || ''),
            String(req.body.modifiedDate || new Date().toISOString())
        ));

        res.json(parseBufferJson(result));
    } catch (error) {
        console.error(`Failed to assign patient to doctor: ${error}`);
        sendFabricError(res, error);
    }
});

app.get('/getAllPatients', authenticateToken, requireRoles('admin', 'system'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => evaluateAllFabricPages(contract, 'GetAllPatientsPage'));
        return res.status(200).json(result);
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        sendFabricError(res, error);
    }
});

app.get('/doctor/me/assigned-patients', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        if (!req.user.blockchainID) return sendError(res, 403, 'DOCTOR_IDENTITY_MISSING', 'Authenticated doctor has no blockchain identity');
        const result = await withContract(req, (contract) => contract.evaluateTransaction('getPatientsAssignedToDoctor', String(req.user.blockchainID)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.get('/getPatientsByClinic/:clinicID', authenticateToken, requireRoles('admin'), requireAdminClinicParam('clinicID'), async (req, res) => {
    try {
        const clinicID = req.params.clinicID;
        const result = await withContract(req, (contract) => evaluateAllFabricPages(contract, 'GetPatientsByClinicPage', [clinicID]));
        return res.status(200).json(result);
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        sendFabricError(res, error);
    }
});



app.get('/getRequestsForAdmin/:clinicID', authenticateToken, requireRoles('admin'), requireAdminClinicParam('clinicID'), async (req, res) => {
    try {
        console.log("Received request to get admin clinic requests for:", req.params.clinicID);

        const { clinicID } = req.params;
        
        if (!clinicID) {
            return res.status(400).json({ error: "Missing required clinic ID parameter" });
        }

        const result = await withContract(req, (contract) => evaluateAllFabricPages(contract, 'GetRequestsForAdminPage', [clinicID]));
        return res.status(200).json(result);
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        sendFabricError(res, error);
    }
});
//admin from org approves request
app.post('/approveRequest', authenticateToken, requireRoles('admin'), requireAdminClinicBody('adminClinicID'), async (req, res) => {
    try {
        console.log("Received request to approve request:", req.body);

        const { adminID, requestID, adminClinicID } = req.body;
        
        if (!adminID || !requestID || !adminClinicID) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const gateway = new Gateway();
        await gateway.connect(getConnectionProfile(), {
            wallet,
            identity: fabricIdentityForRequest(req),
            discovery: { enabled: discoveryEnabled, asLocalhost: discoveryAsLocalhost },
        });

        const network = await gateway.getNetwork(fabricChannel);
        const contract = network.getContract(fabricChaincode);

        // Call `ApproveRequest` chaincode function with required parameters
        const result = await contract.submitTransaction(
            'ApproveRequest', 
            adminID, 
            requestID, 
            String(adminClinicID)
        );

        console.log("Approval Response:", result.toString());
        const response = JSON.parse(result.toString());
        if (response.requestID !== requestID || response.status !== 'PENDING_PATIENT_CONSENT') {
            return sendApiError(res, 502, 'INVALID_APPROVAL_RESULT', 'The ledger did not return the expected patient-consent transition');
        }
        await dispatchNotificationPush(response.notification);
        res.status(200).json(response);
        await gateway.disconnect();
    } catch (error) {
        console.error(`Failed to approve request: ${error}`);
        sendFabricError(res, error);
    }
});

app.get('/getProcessedRequestsForPatient/:patientID', authenticateToken, requireRoles('patient'), requirePatientSelfParam('patientID'), async (req, res) => {
    try {
        const patientID = req.params.patientID;
        const result = await withContract(req, (contract) => evaluateAllFabricPages(contract, 'GetProcessedRequestsForPatientPage', [patientID]));
        return res.status(200).json(result);
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        sendFabricError(res, error);
    }
});

app.get('/getAllRequestsForPatient/:patientID', authenticateToken, requireRoles('patient'), requirePatientSelfParam('patientID'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => evaluateAllFabricPages(
            contract, 'GetAllRequestsForPatientPage', [req.params.patientID]
        ));
        return sendSuccess(res, result);
    } catch (error) {
        return sendFabricError(res, error);
    }
});


app.post('/patient/revokeConsent', authenticateToken, requireRoles('patient'), requirePatientSelfBody('patientID'), async (req, res) => {
    try {
        requireFields(req.body, ['patientID', 'requestID']);
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'RevokeConsent',
            String(req.body.patientID),
            String(req.body.requestID),
            String(req.body.revocationReason || 'Patient revoked consent')
        ));
        const response = parseBufferJson(result);
        if (response.requestID !== req.body.requestID || response.status !== 'REVOKED' || response.accessGranted !== false) {
            return sendApiError(res, 502, 'INVALID_REVOCATION_RESULT', 'The ledger did not return the expected revoked transition');
        }
        await dispatchNotificationPush(response.notification);
        return sendSuccess(res, response);
    } catch (error) { return sendFabricError(res, error); }
});

app.get('/notifications', authenticateToken, requireRoles('admin', 'doctor', 'patient'), async (req, res) => {
    try {
        const target = notificationTargetFromUser(req.user);
        if (!target.id) {
            return sendApiError(res, 403, 'NOTIFICATION_IDENTITY_REQUIRED', 'Authenticated user is missing a notification identity');
        }
        const result = await withContract(req, (contract) => contract.evaluateTransaction(
            'GetNotificationsForActor',
            String(target.role),
            String(target.id),
            String(req.query.status || 'ALL')
        ));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/notifications/:notificationID/read', authenticateToken, requireRoles('admin', 'doctor', 'patient'), async (req, res) => {
    try {
        const result = await withContract(req, (contract) => contract.submitTransaction('MarkNotificationRead', String(req.params.notificationID)));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/referrals/:requestID/complete', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        requireFields(req.body, ['completionSummary']);
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'CompleteReferral', String(req.user.blockchainID), String(req.params.requestID), String(req.body.completionSummary)
        ));
        const response = parseBufferJson(result);
        await dispatchNotificationPush(response.notification);
        return sendSuccess(res, response);
    } catch (error) { return sendFabricError(res, error); }
});

app.post('/unassignPatientFromDoctor', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        requireFields(req.body, ['patientID', 'doctorID']);
        const result = await withContract(req, (contract) => contract.submitTransaction(
            'unassignPatientFromDoctor', String(req.body.patientID), String(req.body.doctorID),
            String(req.body.dataHash || ''), String(req.body.modifiedDate || new Date().toISOString())
        ));
        return sendSuccess(res, parseBufferJson(result));
    } catch (error) { return sendFabricError(res, error); }
});

app.get('/push/config', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) => {
    return sendSuccess(res, { ...pushStatus(), staleDays: Number(process.env.PUSH_TOKEN_STALE_DAYS || 60) });
});

app.get('/push/subscriptions', authenticateToken, requireRoles('admin', 'doctor', 'patient'), async (req, res) => {
    try {
        const target = notificationTargetFromUser(req.user);
        if (!target.id) return sendApiError(res, 403, 'NOTIFICATION_IDENTITY_REQUIRED', 'Authenticated user is missing a notification identity');
        return sendSuccess(res, await listPushSubscriptions({ role: target.role, recipientID: target.id }));
    } catch (error) {
        console.error(`Push subscription listing failed: ${error.message}`);
        return sendApiError(res, 503, 'PUSH_SUBSCRIPTION_UNAVAILABLE', 'Push subscription storage is unavailable');
    }
});

app.post('/push/subscriptions', authenticateToken, requireRoles('admin', 'doctor', 'patient'), async (req, res) => {
    try {
        requireFields(req.body, ['platform', 'token']);
        const target = notificationTargetFromUser(req.user);
        if (!target.id) return sendApiError(res, 403, 'NOTIFICATION_IDENTITY_REQUIRED', 'Authenticated user is missing a notification identity');
        const registration = await registerPushSubscription({
            role: target.role,
            recipientID: target.id,
            platform: req.body.platform,
            token: req.body.token,
            deviceLabel: req.body.deviceLabel,
        });
        return sendSuccess(res, { registered:true, ...registration }, registration.created ? 201 : 200);
    } catch (error) {
        console.error(`Push subscription registration failed: ${error.message}`);
        return sendApiError(res, 503, 'PUSH_SUBSCRIPTION_UNAVAILABLE', 'Push subscription storage is unavailable');
    }
});

app.delete('/push/subscriptions', authenticateToken, requireRoles('admin', 'doctor', 'patient'), async (req, res) => {
    try {
        requireFields(req.body, ['token']);
        const target = notificationTargetFromUser(req.user);
        if (!target.id) return sendApiError(res, 403, 'NOTIFICATION_IDENTITY_REQUIRED', 'Authenticated user is missing a notification identity');
        await unregisterPushSubscription({ role: target.role, recipientID: target.id, token: req.body.token });
        return sendSuccess(res, { unregistered: true });
    } catch (error) {
        console.error(`Push subscription removal failed: ${error.message}`);
        return sendApiError(res, 503, 'PUSH_SUBSCRIPTION_UNAVAILABLE', 'Push subscription storage is unavailable');
    }
});

app.delete('/push/subscriptions/:subscriptionID', authenticateToken, requireRoles('admin', 'doctor', 'patient'), async (req, res) => {
    try {
        const target = notificationTargetFromUser(req.user);
        if (!target.id) return sendApiError(res, 403, 'NOTIFICATION_IDENTITY_REQUIRED', 'Authenticated user is missing a notification identity');
        const removed = await removePushSubscription({
            role: target.role,
            recipientID: target.id,
            subscriptionID: req.params.subscriptionID,
        });
        if (!removed) return sendApiError(res, 404, 'PUSH_SUBSCRIPTION_NOT_FOUND', 'Push subscription was not found');
        return sendSuccess(res, { unregistered: true });
    } catch (error) {
        console.error(`Push subscription removal failed: ${error.message}`);
        return sendApiError(res, 503, 'PUSH_SUBSCRIPTION_UNAVAILABLE', 'Push subscription storage is unavailable');
    }
});

const pushPruneInterval = setInterval(() => {
    pruneStaleSubscriptions().then((count) => {
        if (count) console.info(`Deactivated ${count} stale push subscription(s)`);
    }).catch((error) => console.error(`Push subscription pruning failed: ${error.message}`));
}, 24 * 60 * 60 * 1000);
pushPruneInterval.unref();
pruneStaleSubscriptions().catch((error) => console.warn(`Initial push subscription pruning skipped: ${error.message}`));

const PORT = process.env.PORT || 8081;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
