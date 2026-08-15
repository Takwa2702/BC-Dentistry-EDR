const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
require('dotenv').config();
const {
    ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE, hash: hashSessionSecret,
    sqlDate, sessionTtls, signAccessToken, verifyAccessToken, createSession,
    setWebSessionCookies, clearWebSessionCookies, parseCookies, base64UrlSecret,
} = require('./sessionService');
const { validateRadiographicFile } = require('./radiographicFileValidation');
const { normalizeDentalCoding } = require('./dentalCoding');
const { clinicalHash } = require('./clinicalHash');
const { generateSecret, verifyTotp, matchingTotpStep, provisioningUri, encryptSecret, decryptSecret,
    generateRecoveryCodes, hashRecoveryCode } = require('./totpService');

const app = express();
app.disable('x-powered-by');
const BLOCKCHAIN_API_URL = process.env.BLOCKCHAIN_API_URL?.replace(/\/+$/, '');
const BLOCKCHAIN_INTERNAL_TOKEN = process.env.BLOCKCHAIN_INTERNAL_TOKEN;
const PATIENT_ROLE_ID = 4;
const DOCTOR_ROLE_ID = 3;
const ADMIN_ROLE_ID = 2;

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

const sendApiError = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });

const query = (sql, params = []) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => err ? reject(err) : resolve(result));
});

const normalizePatient = (row) => ({
    patientID: row.Blockchain_ID,
    firstName: row.First_Name,
    lastName: row.Last_Name,
    dateOfBirth: row.Date_of_Birth,
    gender: row.Gender,
    contactNumber: row.Contact_Number,
    email: row.Email,
    emiratesID: row.Emirates_ID,
    nationality: row.Nationality,
    address: row.Address,
    bloodType: row.Blood_Type,
    medicalHistory: row.Medical_History,
    allergies: row.Allergies,
    medications: row.Medications,
    insuranceDetails: row.Insurance_Details,
    clinicID: row.Clinic_ID,
    doctors: row.Doctors ? (typeof row.Doctors === 'string' ? JSON.parse(row.Doctors) : row.Doctors) : [],
    createdDate: row.Created_Date,
    modifiedDate: row.Modified_Date,
    associationStatus: row.Association_Status || 'current',
    operationalAccess: (row.Association_Status || 'current') === 'current',
    currentClinicName: row.Current_Clinic_Name || null
});

const patientHash = (patient) => crypto.createHash('sha256').update(JSON.stringify({
    patientID: patient.patientID,
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
    medicalHistory: patient.medicalHistory,
    allergies: patient.allergies,
    medications: patient.medications,
    insuranceDetails: patient.insuranceDetails,
    clinicID: Number(patient.clinicID),
    doctors: patient.doctors || []
})).digest('hex');

const validationError = (code, message) => Object.assign(new Error(message), { statusCode: 400, code });
const textLength = (value) => Array.from(String(value ?? '')).length;
const requireTextLimit = (value, field, max, code = 'FIELD_TOO_LONG') => {
    if (textLength(value) > max) throw validationError(code, `${field} must be ${max} characters or fewer`);
};
const validateEmail = (value) => {
    requireTextLimit(value, 'Email', 254, 'EMAIL_TOO_LONG');
    if (!/^\S+@\S+\.\S+$/.test(String(value))) throw validationError('INVALID_EMAIL', 'Invalid email address');
};
const validateContactNumber = (value) => {
    requireTextLimit(value, 'Contact number', 25, 'CONTACT_NUMBER_TOO_LONG');
    if (!/^\+?[0-9][0-9 ()-]{6,24}$/.test(String(value))) throw validationError('INVALID_CONTACT_NUMBER', 'Contact number must contain 7 to 25 valid telephone characters');
};
const validateEmiratesID = (value) => {
    if (!/^784-\d{4}-\d{7}-\d$/.test(String(value))) throw validationError('INVALID_EMIRATES_ID', 'Emirates ID must use the format 784-YYYY-NNNNNNN-C');
};
const validatePersonNames = (body, entity = 'Person', code = `${entity.toUpperCase().replace(/\s+/g, '_')}_NAME_TOO_LONG`) => {
    for (const field of ['firstName', 'lastName']) {
        requireTextLimit(body[field], `${entity} ${field === 'firstName' ? 'first' : 'last'} name`, 100, code);
    }
};
const validateBoundedJson = (value, label, { maxBytes = 65536, maxDepth = 6, maxArray = 100, maxString = 4000 } = {}) => {
    if (Buffer.byteLength(JSON.stringify(value ?? null), 'utf8') > maxBytes) throw validationError('CLINICAL_PAYLOAD_TOO_LARGE', `${label} must be ${maxBytes} bytes or fewer`);
    const visit = (item, depth) => {
        if (depth > maxDepth) throw validationError('CLINICAL_PAYLOAD_TOO_DEEP', `${label} nesting exceeds ${maxDepth} levels`);
        if (typeof item === 'string' && textLength(item) > maxString) throw validationError('CLINICAL_TEXT_TOO_LONG', `${label} text values must be ${maxString} characters or fewer`);
        if (Array.isArray(item)) {
            if (item.length > maxArray) throw validationError('CLINICAL_ARRAY_TOO_LARGE', `${label} arrays may contain at most ${maxArray} items`);
            item.forEach((entry) => visit(entry, depth + 1));
        } else if (item && typeof item === 'object') {
            const entries = Object.entries(item);
            if (entries.length > 100) throw validationError('CLINICAL_OBJECT_TOO_LARGE', `${label} objects may contain at most 100 fields`);
            entries.forEach(([key, entry]) => { requireTextLimit(key, `${label} field name`, 100, 'CLINICAL_FIELD_NAME_TOO_LONG'); visit(entry, depth + 1); });
        }
    };
    visit(value, 0);
};
const validateClinicalPayload = (recordType, payload) => {
    if (!['medical', 'dental'].includes(recordType)) { const error = new Error('recordType must be medical or dental'); error.statusCode = 400; throw error; }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { const error = new Error('payload must be an object'); error.statusCode = 400; throw error; }
    const required = recordType === 'medical' ? ['medicalHistory', 'allergies', 'labResults', 'medications']
        : ['treatmentPhase', 'procedureCode', 'ceramicType', 'prescriptions', 'diagnostics'];
    const missing = required.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
    if (missing.length) { const error = new Error(`Missing required clinical fields: ${missing.join(', ')}`); error.statusCode = 400; throw error; }
    const normalized = recordType === 'dental' ? normalizeDentalCoding(payload) : payload;
    validateBoundedJson(normalized, 'Clinical payload');
    return normalized;
};

const blockchainHeaders = (req, contentType = 'application/json', extraHeaders = {}) => ({
    ...(contentType ? { 'Content-Type': contentType } : {}),
    Authorization: `Bearer ${req.accessToken || getBearerToken(req) || ''}`,
    'X-EDR-Internal-Token': BLOCKCHAIN_INTERNAL_TOKEN || '',
    'X-Correlation-ID': req.get('x-correlation-id') || crypto.randomUUID(),
    ...extraHeaders,
});

const callBlockchainResponse = async (req, path, method = 'GET', body, contentType = 'application/json', extraHeaders = {}) => {
    if (!BLOCKCHAIN_API_URL) {
        const error = new Error('Blockchain API URL is not configured');
        error.statusCode = 503;
        throw error;
    }
    return fetch(`${BLOCKCHAIN_API_URL}${path}`, {
        method,
        headers: blockchainHeaders(req, contentType, extraHeaders),
        body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)),
    });
};

const callBlockchain = async (req, path, method, body) => {
    const response = await callBlockchainResponse(req, path, method, body);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error?.message || payload?.error || 'Blockchain operation failed');
        error.statusCode = response.status;
        throw error;
    }
    return payload.data ?? payload;
};

const provisionFabricIdentity = (req, role, actorID, clinicID) => callBlockchain(
    req,
    '/internal/identities',
    'POST',
    { role, actorID, clinicID },
);

const retireFabricIdentity = (req, role, actorID, clinicID) => callBlockchain(
    req, '/internal/identities', 'DELETE', { role, actorID, clinicID },
);

const lifecyclePayloadHash = (payload) => crypto.createHash('sha256')
    .update(JSON.stringify(payload || {})).digest('hex');
const beginLifecycleOperation = async (req, operationType, entityType, entityID, clinicID, payload) => {
    const operationID = crypto.randomUUID();
    await query(`INSERT INTO Entity_Lifecycle_Operation
        (Operation_ID,Operation_Type,Entity_Type,Entity_ID,Clinic_ID,Correlation_ID,Payload_Hash)
        VALUES (?,?,?,?,?,?,?)`, [operationID, operationType, entityType, String(entityID), clinicID || null,
        req.get('x-correlation-id') || null, lifecyclePayloadHash(payload)]);
    return operationID;
};
const markLifecycleOperation = (operationID, status, stage, error = null) => operationID ? query(
    `UPDATE Entity_Lifecycle_Operation SET Status=?,Current_Stage=?,Error_Code=?,Error_Message=?,
        Completed_At=IF(?='COMPLETED',NOW(3),Completed_At) WHERE Operation_ID=?`,
    [status, stage, error?.code || null, error ? String(error.message || error).slice(0, 1000) : null, status, operationID],
) : Promise.resolve();

const requireAdminClinic = (req, clinicID) => {
    if (Number(req.user.organizationId) !== Number(clinicID)) {
        const error = new Error('Forbidden: patient clinic must match the authenticated admin organization');
        error.statusCode = 403;
        throw error;
    }
};

const parseCorsOrigin = (value) => {
    if (!value || value === '*') {
        return '*';
    }

    return value.split(',').map((origin) => origin.trim()).filter(Boolean);
};

const corsOptions = {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    credentials: true,
    optionsSuccessStatus: 200
};
const allowedWebOrigins = Array.isArray(corsOptions.origin) ? corsOptions.origin : [corsOptions.origin].filter(Boolean);
const hasAllowedWebOrigin = (req) => corsOptions.origin === '*' || allowedWebOrigins.includes(req.get('origin'));

if (process.env.NODE_ENV === 'production' && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*')) {
    throw new Error('Production CORS_ORIGIN must be an explicit allow-list');
}

if (!BLOCKCHAIN_API_URL) {
    console.warn('BLOCKCHAIN_API_URL is not configured. /syncOnChainPatients will return a configuration error.');
}
if (process.env.NODE_ENV === 'production' && !BLOCKCHAIN_INTERNAL_TOKEN) {
    throw new Error('BLOCKCHAIN_INTERNAL_TOKEN is required in production');
}

// Reject an untrusted browser origin explicitly instead of merely omitting ACAO.
// This gives browser clients and security automation an unambiguous policy result
// and prevents the request from reaching authentication or business handlers.
app.use((req, res, next) => {
    const requestOrigin = req.get('origin');
    if (requestOrigin && !hasAllowedWebOrigin(req)) {
        res.vary('Origin');
        return sendApiError(res, 403, 'CORS_ORIGIN_DENIED', 'Cross-origin request is not permitted');
    }
    return next();
});
app.use(cors(corsOptions));
app.use(express.json());

// Connection pool — handles reconnects automatically, reads config from .env
const db = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'CHANGE_ME',
    database: process.env.DB_NAME     || 'mydatabase',
    waitForConnections: true,
    connectionLimit: 10,
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database');
    connection.release();
});


app.use((req, res, next) => {
    console.log('Received request:', req.method, req.url);  // Logs every incoming request
    next();
});


// Home route for testing
app.get('/', (req, res) => {
    return res.json("from backend side");
});

const sessionRetentionDays = Math.max(1, Number(process.env.SESSION_RETENTION_DAYS || 90));
setInterval(async () => {
    try {
        await query(`DELETE FROM Auth_Session_Event
            WHERE Occurred_At < DATE_SUB(NOW(3), INTERVAL ? DAY)`, [sessionRetentionDays]);
        await query(`DELETE FROM Auth_Refresh_Token
            WHERE Expires_At < DATE_SUB(NOW(3), INTERVAL ? DAY)`, [sessionRetentionDays]);
        await query(`DELETE FROM Auth_Session
            WHERE Absolute_Expires_At < DATE_SUB(NOW(3), INTERVAL ? DAY)`, [sessionRetentionDays]);
    } catch (error) {
        console.warn('Session cleanup skipped:', error.message);
    }
}, 6 * 60 * 60 * 1000).unref();

app.get('/health', (req, res) => {
    db.query(`SELECT (
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME IN ('Auth_Session','Auth_Refresh_Token','Auth_Session_Event','Schema_Migration','Entity_Lifecycle_Operation',
                'Auth_MFA_Credential','Auth_MFA_Recovery_Code','Auth_MFA_Challenge'))=8
        AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='User'
            AND COLUMN_NAME IN ('Security_Version','Sessions_Invalid_Before'))=2
        AND EXISTS (SELECT 1 FROM Schema_Migration WHERE Migration_ID='2026-07-29-secure-auth-sessions')
        AND EXISTS (SELECT 1 FROM Schema_Migration WHERE Migration_ID='2026-08-03-entity-lifecycle-hardening')
        AND EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME='Patient_Clinic_Association')
        AND EXISTS (SELECT 1 FROM Schema_Migration WHERE Migration_ID='2026-08-05-patient-clinic-transfer')
        AND EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME='System_Configuration')
        AND EXISTS (SELECT 1 FROM Schema_Migration WHERE Migration_ID='2026-08-05-appointment-overlap')
        AND EXISTS (SELECT 1 FROM Schema_Migration WHERE Migration_ID='2026-08-15-administrator-totp-mfa')
    ) AS ready`, (error, rows) => {
        if (error) {
            return res.status(503).json({ status: 'not-ready', service: 'database-api', database: false, sessionSchema: false });
        }
        const sessionSchema = Boolean(rows[0]?.ready);
        return res.status(sessionSchema ? 200 : 503).json({
            status: sessionSchema ? 'ok' : 'not-ready', service: 'database-api', database: true, sessionSchema,
        });
    });
});

const authRateBuckets = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of authRateBuckets) if (bucket.resetAt <= now) authRateBuckets.delete(key);
}, 15 * 60 * 1000).unref();
const authRateLimit = (name, limit, windowMs) => (req, res, next) => {
    const key = `${name}:${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`;
    const now = Date.now();
    const bucket = authRateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        authRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
        return next();
    }
    bucket.count += 1;
    if (bucket.count > limit) {
        res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
        return sendApiError(res, 429, 'AUTH_RATE_LIMITED', 'Too many authentication attempts');
    }
    return next();
};

app.post('/login', authRateLimit('login', 10, 15 * 60 * 1000), async (req, res) => {
    const { email, password } = req.body;

    // Input check
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    console.log('🔐 Login attempt:', email);

    const sql = `
        SELECT 
            User.ID, User.First_Name, User.Last_Name, User.Email, User.Password, 
            UserRole.Name AS Role_Name, User.Must_Change_Password, User.Security_Version, User.IsActive,
            Organization.IsActive AS Clinic_IsActive,
            COALESCE(Admin.Organization_ID, NULL) AS Organization_ID,
            COALESCE(Doctor.Works_At, NULL) AS WorksAt,
            COALESCE(Doctor.Specialty, NULL) AS Specialty,
            COALESCE(Doctor.Blockchain_ID, Patient.Blockchain_ID, NULL) AS BlockchainID
        FROM User 
        INNER JOIN UserRole ON User.Role_ID = UserRole.Role_ID
        LEFT JOIN Admin ON User.ID = Admin.User_ID
        LEFT JOIN Organization ON Admin.Organization_ID = Organization.Organization_ID
        LEFT JOIN Doctor ON User.ID = Doctor.ID
        LEFT JOIN Patient ON User.ID = Patient.ID
        WHERE User.Email = ?
    `;

    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error('❌ DB error:', err);
            return res.status(500).json({ error: 'Database error during login' });
        }

        if (results.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = results[0];
        if (!user.IsActive) return res.status(403).json({ error: 'Account is inactive' });
        if (normalizeRole(user.Role_Name) === 'admin' && !user.Clinic_IsActive) return res.status(403).json({ error: 'Clinic is inactive' });
        const match = await bcrypt.compare(password, user.Password);

        if (!match) {
            console.log('❌ Password mismatch for:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        db.query("UPDATE User SET Last_Login_Date = NOW() WHERE ID = ?", [user.ID], (updateErr) => {
            if (updateErr) console.warn('⚠️ Failed to update last login date:', updateErr);
        });

        let connection;
        try {
            connection = await db.promise().getConnection();
            await connection.beginTransaction();
            const [credentials] = await connection.query(
                'SELECT User_ID FROM Auth_MFA_Credential WHERE User_ID=? AND Reset_At IS NULL', [user.ID]);
            const enrollmentRequired = credentials.length === 0;
            const challenge = base64UrlSecret();
            let encrypted = { ciphertext: null, iv: null, tag: null };
            let setup = null;
            if (enrollmentRequired) {
                const secret = generateSecret();
                encrypted = encryptSecret(secret);
                setup = { secret, provisioningUri: provisioningUri({ secret, email: user.Email, issuer: process.env.MFA_ISSUER || 'EDR' }) };
            }
            const clientType = ['web', 'ios', 'android'].includes(req.body.clientType) ? req.body.clientType : 'web';
            await connection.query(`INSERT INTO Auth_MFA_Challenge
                (Challenge_Hash,User_ID,Purpose,Pending_Secret_Ciphertext,Pending_Secret_IV,Pending_Secret_Tag,Client_Type,Device_Label,Expires_At)
                VALUES (?,?,?,?,?,?,?,?,DATE_ADD(NOW(3),INTERVAL 10 MINUTE))`, [
                hashSessionSecret(challenge), user.ID, enrollmentRequired ? 'enrollment' : 'login',
                encrypted.ciphertext, encrypted.iv, encrypted.tag, clientType,
                String(req.body.deviceLabel || '').slice(0, 255) || null,
            ]);
            await connection.commit();
            res.set('Cache-Control', 'no-store');
            return res.status(202).json({ mfaRequired: true, enrollmentRequired, challenge, setup });
        } catch (sessionError) {
            if (connection) await connection.rollback().catch(() => {});
            console.error('Session creation failed:', sessionError);
            return sendApiError(res, sessionError.statusCode || 500, sessionError.code || 'MFA_CHALLENGE_FAILED', 'Unable to start MFA verification');
        } finally {
            if (connection) connection.release();
        }
    });
});

app.post('/auth/mfa/verify', authRateLimit('mfa', 10, 10 * 60 * 1000), async (req, res) => {
    const challengeValue = String(req.body?.challenge || '');
    const code = String(req.body?.code || '');
    if (!challengeValue || !code) return sendApiError(res, 400, 'MFA_INPUT_REQUIRED', 'MFA challenge and verification code are required');
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [challenges] = await connection.query(`SELECT * FROM Auth_MFA_Challenge
            WHERE Challenge_Hash=? AND Used_At IS NULL AND Expires_At>NOW(3) FOR UPDATE`, [hashSessionSecret(challengeValue)]);
        if (!challenges.length) throw Object.assign(new Error('MFA challenge is invalid or expired'), { statusCode: 401, code: 'MFA_CHALLENGE_INVALID' });
        const challenge = challenges[0];
        const [users] = await connection.query(`SELECT User.ID,User.First_Name,User.Last_Name,User.Email,
            UserRole.Name AS Role_Name,User.Must_Change_Password,User.Security_Version,User.IsActive,
            Organization.IsActive AS Clinic_IsActive,COALESCE(Admin.Organization_ID,NULL) AS Organization_ID,
            COALESCE(Doctor.Works_At,NULL) AS WorksAt,COALESCE(Doctor.Specialty,NULL) AS Specialty,
            COALESCE(Doctor.Blockchain_ID,Patient.Blockchain_ID,NULL) AS BlockchainID
            FROM User INNER JOIN UserRole ON User.Role_ID=UserRole.Role_ID
            LEFT JOIN Admin ON User.ID=Admin.User_ID LEFT JOIN Organization ON Admin.Organization_ID=Organization.Organization_ID
            LEFT JOIN Doctor ON User.ID=Doctor.ID LEFT JOIN Patient ON User.ID=Patient.ID WHERE User.ID=? FOR UPDATE`, [challenge.User_ID]);
        const user = users[0];
        if (!user?.IsActive || (normalizeRole(user.Role_Name) === 'admin' && !user.Clinic_IsActive)) {
            throw Object.assign(new Error('Account is inactive'), { statusCode: 403, code: 'ACCOUNT_INACTIVE' });
        }
        let verified = false;
        let recoveryUsed = false;
        let recoveryCodes = null;
        if (challenge.Purpose === 'enrollment') {
            const [existingCredentials] = await connection.query(
                'SELECT User_ID FROM Auth_MFA_Credential WHERE User_ID=? AND Reset_At IS NULL FOR UPDATE', [user.ID]);
            if (existingCredentials.length) throw Object.assign(new Error('This enrollment challenge has been superseded'), { statusCode: 409, code: 'MFA_CHALLENGE_SUPERSEDED' });
            const secret = decryptSecret({ ciphertext: challenge.Pending_Secret_Ciphertext, iv: challenge.Pending_Secret_IV, tag: challenge.Pending_Secret_Tag });
            const matchedStep = matchingTotpStep(secret, code);
            verified = matchedStep !== null;
            if (verified) {
                await connection.query(`INSERT INTO Auth_MFA_Credential
                    (User_ID,Secret_Ciphertext,Secret_IV,Secret_Tag,Enabled_At,Reset_At,Last_TOTP_Step) VALUES (?,?,?,?,NOW(3),NULL,?)
                    ON DUPLICATE KEY UPDATE Secret_Ciphertext=VALUES(Secret_Ciphertext),Secret_IV=VALUES(Secret_IV),
                    Secret_Tag=VALUES(Secret_Tag),Enabled_At=NOW(3),Reset_At=NULL,Last_TOTP_Step=VALUES(Last_TOTP_Step)`,
                    [user.ID, challenge.Pending_Secret_Ciphertext, challenge.Pending_Secret_IV, challenge.Pending_Secret_Tag, matchedStep]);
                recoveryCodes = generateRecoveryCodes();
                await connection.query('DELETE FROM Auth_MFA_Recovery_Code WHERE User_ID=?', [user.ID]);
                for (const recoveryCode of recoveryCodes) {
                    await connection.query('INSERT INTO Auth_MFA_Recovery_Code (User_ID,Code_Hash) VALUES (?,?)', [user.ID, hashRecoveryCode(recoveryCode)]);
                }
            }
        } else {
            const [credentials] = await connection.query('SELECT * FROM Auth_MFA_Credential WHERE User_ID=? AND Reset_At IS NULL FOR UPDATE', [user.ID]);
            if (!credentials.length) throw Object.assign(new Error('MFA enrollment is required'), { statusCode: 409, code: 'MFA_ENROLLMENT_REQUIRED' });
            const credential = credentials[0];
            const secret = decryptSecret({ ciphertext: credential.Secret_Ciphertext, iv: credential.Secret_IV, tag: credential.Secret_Tag });
            const matchedStep = matchingTotpStep(secret, code);
            verified = matchedStep !== null && (credential.Last_TOTP_Step === null || matchedStep > Number(credential.Last_TOTP_Step));
            if (!verified) {
                const [result] = await connection.query(`UPDATE Auth_MFA_Recovery_Code SET Used_At=NOW(3)
                    WHERE User_ID=? AND Code_Hash=? AND Used_At IS NULL`, [user.ID, hashRecoveryCode(code)]);
                verified = result.affectedRows === 1;
                recoveryUsed = verified;
            }
            if (verified && recoveryUsed) await connection.query('UPDATE Auth_MFA_Credential SET Last_Used_At=NOW(3) WHERE User_ID=?', [user.ID]);
            else if (verified) await connection.query('UPDATE Auth_MFA_Credential SET Last_Used_At=NOW(3),Last_TOTP_Step=? WHERE User_ID=?', [matchedStep, user.ID]);
        }
        if (!verified) throw Object.assign(new Error('Invalid authentication code'), { statusCode: 401, code: 'MFA_CODE_INVALID' });
        const tokenPayload = { id: user.ID, role: normalizeRole(user.Role_Name), organizationId: user.Organization_ID || null,
            worksAt: user.WorksAt || null, specialty: user.Specialty || null, blockchainID: user.BlockchainID || null,
            mustChangePassword: Boolean(user.Must_Change_Password), securityVersion: Number(user.Security_Version || 1), mfa: true };
        const userData = { id: user.ID, name: `${user.First_Name} ${user.Last_Name}`, email: user.Email,
            role: tokenPayload.role, organizationId: tokenPayload.organizationId, worksAt: tokenPayload.worksAt,
            specialty: tokenPayload.specialty, blockchainID: tokenPayload.blockchainID, mustChangePassword: tokenPayload.mustChangePassword };
        const session = await createSession(connection, tokenPayload, { clientType: challenge.Client_Type,
            deviceLabel: challenge.Device_Label, ip: req.ip, userAgent: req.get('user-agent') });
        await connection.query('UPDATE Auth_MFA_Challenge SET Used_At=NOW(3) WHERE Challenge_Hash=?', [hashSessionSecret(challengeValue)]);
        await connection.query('UPDATE User SET Last_Login_Date=NOW() WHERE ID=?', [user.ID]);
        await connection.query('INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type,Details) VALUES (?,?,?,?)',
            [session.sessionID, user.ID, recoveryUsed ? 'MFA_RECOVERY_LOGIN' : (challenge.Purpose === 'enrollment' ? 'MFA_ENROLLED' : 'MFA_VERIFIED'), JSON.stringify({ clientType: challenge.Client_Type })]);
        await connection.commit();
        res.set('Cache-Control', 'no-store');
        if (challenge.Client_Type === 'web') {
            setWebSessionCookies(res, session);
            return res.json({ user: userData, csrfToken: session.csrfToken, recoveryCodes });
        }
        return res.json({ token: session.accessToken, refreshToken: session.refreshToken, user: userData, recoveryCodes });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, error.code || 'MFA_VERIFY_FAILED', error.statusCode ? error.message : 'Unable to verify MFA');
    } finally {
        if (connection) connection.release();
    }
});

const getBearerToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(' ');
    return /^Bearer$/i.test(scheme) ? token : null;
};

const getAccessToken = (req) => {
    const bearer = getBearerToken(req);
    if (bearer) return { token: bearer, mode: 'bearer' };
    const token = parseCookies(req.headers.cookie || '')[ACCESS_COOKIE];
    return token ? { token, mode: 'cookie' } : { token: null, mode: null };
};

const authenticateToken = async (req, res, next) => {
    const credentials = getAccessToken(req);
    if (!credentials.token) return sendApiError(res, 401, 'AUTH_REQUIRED', 'Access denied');
    try {
        const user = verifyAccessToken(credentials.token);
        if (user.mfa !== true) return sendApiError(res, 401, 'MFA_REQUIRED', 'Multi-factor authentication is required');
        const rows = await query(`SELECT s.Session_ID, s.Security_Version, s.Csrf_Token_Hash, s.Idle_Expires_At, s.Absolute_Expires_At,
            s.Revoked_At, u.IsActive, u.Security_Version AS User_Security_Version,
            u.Sessions_Invalid_Before, ur.Name AS Current_Role, COALESCE(o.IsActive,1) AS Clinic_IsActive
            FROM Auth_Session s JOIN User u ON u.ID=s.User_ID JOIN UserRole ur ON ur.Role_ID=u.Role_ID
            LEFT JOIN Admin a ON a.User_ID=u.ID LEFT JOIN Organization o ON o.Organization_ID=a.Organization_ID
            WHERE s.Session_ID=? AND s.User_ID=? LIMIT 1`, [user.sid, user.id]);
        const session = rows[0];
        const now = Date.now();
        if (!session || session.Revoked_At || !session.IsActive || !session.Clinic_IsActive
            || new Date(session.Idle_Expires_At).getTime() <= now || new Date(session.Absolute_Expires_At).getTime() <= now
            || Number(session.Security_Version) !== Number(session.User_Security_Version)
            || Number(user.securityVersion) !== Number(session.User_Security_Version)
            || (session.Sessions_Invalid_Before && user.iat < Math.floor(new Date(session.Sessions_Invalid_Before).getTime() / 1000))) {
            return sendApiError(res, 401, 'SESSION_REVOKED', 'Session is no longer active');
        }
        if (normalizeRole(session.Current_Role) !== normalizeRole(user.role)) {
            return sendApiError(res, 401, 'SESSION_STALE', 'Session claims are no longer current');
        }
        req.authMode = credentials.mode;
        req.accessToken = credentials.token;
        res.set('Cache-Control', 'private, no-store');
        if (credentials.mode === 'cookie' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            if (!hasAllowedWebOrigin(req)) {
                return sendApiError(res, 403, 'ORIGIN_VALIDATION_FAILED', 'Request origin is not permitted');
            }
            const csrf = req.get('x-csrf-token');
            if (!csrf || hashSessionSecret(csrf) !== session.Csrf_Token_Hash) {
                return sendApiError(res, 403, 'CSRF_VALIDATION_FAILED', 'CSRF validation failed');
            }
        }
        if (user.mustChangePassword && !['/change-password', '/auth/logout', '/auth/me'].includes(req.path)) {
            return sendApiError(res, 403, 'PASSWORD_CHANGE_REQUIRED', 'Password change is required before continuing');
        }
        req.user = user;
        next();
    } catch (error) {
        return sendApiError(res, error.statusCode || 403, error.code || 'INVALID_TOKEN', 'Invalid or expired session');
    }
};

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

const loadSessionUser = async (connection, sessionID) => {
    const [rows] = await connection.query(`SELECT u.ID, u.IsActive, u.Must_Change_Password, u.Security_Version,
        ur.Name AS Role_Name, COALESCE(a.Organization_ID,NULL) AS Organization_ID,
        COALESCE(d.Works_At,NULL) AS WorksAt, COALESCE(d.Specialty,NULL) AS Specialty,
        COALESCE(d.Blockchain_ID,p.Blockchain_ID,NULL) AS BlockchainID,
        COALESCE(o.IsActive,1) AS Clinic_IsActive
        FROM Auth_Session s JOIN User u ON u.ID=s.User_ID JOIN UserRole ur ON ur.Role_ID=u.Role_ID
        LEFT JOIN Admin a ON a.User_ID=u.ID LEFT JOIN Organization o ON o.Organization_ID=a.Organization_ID
        LEFT JOIN Doctor d ON d.ID=u.ID LEFT JOIN Patient p ON p.ID=u.ID
        WHERE s.Session_ID=? LIMIT 1`, [sessionID]);
    if (!rows.length || !rows[0].IsActive || !rows[0].Clinic_IsActive) return null;
    const row = rows[0];
    return {
        id: row.ID, role: normalizeRole(row.Role_Name), organizationId: row.Organization_ID || null,
        worksAt: row.WorksAt || null, specialty: row.Specialty || null, blockchainID: row.BlockchainID || null,
        mustChangePassword: Boolean(row.Must_Change_Password), securityVersion: Number(row.Security_Version || 1), mfa: true,
    };
};

app.post('/auth/refresh', authRateLimit('refresh', 60, 5 * 60 * 1000), async (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const webToken = cookies[REFRESH_COOKIE];
    const webCsrf = req.get('x-csrf-token');
    const refreshToken = webToken || req.body?.refreshToken;
    if (!refreshToken) return sendApiError(res, 401, 'REFRESH_REQUIRED', 'Refresh token is required');
    if (webToken) {
        if (!hasAllowedWebOrigin(req)) return sendApiError(res, 403, 'ORIGIN_VALIDATION_FAILED', 'Request origin is not permitted');
        if (!webCsrf || webCsrf !== cookies[CSRF_COOKIE]) return sendApiError(res, 403, 'CSRF_VALIDATION_FAILED', 'CSRF validation failed');
    }
    let connection;
    try {
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [tokens] = await connection.query(`SELECT rt.*, rt.Revoked_At AS Token_Revoked_At,
            s.Client_Type, s.Idle_Expires_At, s.Absolute_Expires_At,
            s.Revoked_At AS Session_Revoked_At, s.Security_Version, s.Csrf_Token_Hash
            FROM Auth_Refresh_Token rt JOIN Auth_Session s ON s.Session_ID=rt.Session_ID
            WHERE rt.Token_Hash=? FOR UPDATE`, [hashSessionSecret(refreshToken)]);
        const current = tokens[0];
        if (!current) throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
        if (webToken && hashSessionSecret(webCsrf) !== current.Csrf_Token_Hash) {
            throw Object.assign(new Error('CSRF validation failed'), { statusCode: 403, code: 'CSRF_VALIDATION_FAILED' });
        }
        if (current.Used_At) {
            await connection.query(`UPDATE Auth_Session SET Revoked_At=NOW(3),Revocation_Reason='refresh token reuse detected'
                WHERE Session_ID=? AND Revoked_At IS NULL`, [current.Session_ID]);
            await connection.query('UPDATE Auth_Refresh_Token SET Revoked_At=COALESCE(Revoked_At,NOW(3)) WHERE Session_ID=?', [current.Session_ID]);
            await connection.query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type,Details)
                SELECT Session_ID,User_ID,'REFRESH_REUSE_DETECTED',JSON_OBJECT('tokenId',?) FROM Auth_Session WHERE Session_ID=?`,
            [current.Token_ID, current.Session_ID]);
            await connection.commit();
            return sendApiError(res, 401, 'REFRESH_TOKEN_REUSE', 'Session revoked because refresh-token reuse was detected');
        }
        const now = Date.now();
        if (current.Token_Revoked_At || current.Session_Revoked_At || new Date(current.Expires_At).getTime() <= now
            || new Date(current.Idle_Expires_At).getTime() <= now || new Date(current.Absolute_Expires_At).getTime() <= now) {
            throw Object.assign(new Error('Refresh session expired or revoked'), { statusCode: 401, code: 'SESSION_REVOKED' });
        }
        const user = await loadSessionUser(connection, current.Session_ID);
        if (!user || Number(user.securityVersion) !== Number(current.Security_Version)) {
            throw Object.assign(new Error('Session claims are stale'), { statusCode: 401, code: 'SESSION_STALE' });
        }
        const replacementID = crypto.randomUUID();
        const replacement = base64UrlSecret();
        const ttl = sessionTtls(current.Client_Type);
        const absolute = new Date(current.Absolute_Expires_At);
        const idle = new Date(Math.min(now + ttl.idle, absolute.getTime()));
        await connection.query('UPDATE Auth_Refresh_Token SET Used_At=NOW(3),Replaced_By_Token_ID=? WHERE Token_ID=?', [replacementID, current.Token_ID]);
        await connection.query(`INSERT INTO Auth_Refresh_Token
            (Token_ID,Session_ID,Token_Hash,Parent_Token_ID,Expires_At) VALUES (?,?,?,?,?)`,
        [replacementID, current.Session_ID, hashSessionSecret(replacement), current.Token_ID, sqlDate(absolute)]);
        const csrfToken = current.Client_Type === 'web' ? base64UrlSecret() : null;
        await connection.query(`UPDATE Auth_Session SET Last_Seen_At=NOW(3),Idle_Expires_At=?,Last_IP_Hash=?,
            Csrf_Token_Hash=COALESCE(?,Csrf_Token_Hash) WHERE Session_ID=?`,
        [sqlDate(idle), req.ip ? hashSessionSecret(req.ip) : null, csrfToken ? hashSessionSecret(csrfToken) : null, current.Session_ID]);
        await connection.query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type)
            SELECT Session_ID,User_ID,'SESSION_REFRESHED' FROM Auth_Session WHERE Session_ID=?`, [current.Session_ID]);
        const session = {
            accessToken: signAccessToken(user, current.Session_ID), refreshToken: replacement,
            csrfToken, refreshExpires: absolute,
        };
        await connection.commit();
        res.set('Cache-Control', 'no-store');
        if (current.Client_Type === 'web') {
            setWebSessionCookies(res, session);
            return res.json({ csrfToken });
        }
        return res.json({ token: session.accessToken, refreshToken: replacement });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, error.code || 'REFRESH_FAILED', error.statusCode ? error.message : 'Unable to refresh session');
    } finally { if (connection) connection.release(); }
});

app.post('/auth/logout', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const webRefresh = cookies[REFRESH_COOKIE];
    if (webRefresh) {
        if (!hasAllowedWebOrigin(req)) return sendApiError(res, 403, 'ORIGIN_VALIDATION_FAILED', 'Request origin is not permitted');
        const csrf = req.get('x-csrf-token');
        if (!csrf || csrf !== cookies[CSRF_COOKIE]) return sendApiError(res, 403, 'CSRF_VALIDATION_FAILED', 'CSRF validation failed');
    }
    let sessionID = null;
    const access = getAccessToken(req).token;
    if (access) {
        try { sessionID = verifyAccessToken(access).sid; } catch { /* refresh token fallback handles expired access */ }
    }
    const refreshToken = webRefresh || req.body?.refreshToken;
    if (!sessionID && refreshToken) {
        const rows = await query('SELECT Session_ID FROM Auth_Refresh_Token WHERE Token_Hash=? LIMIT 1', [hashSessionSecret(refreshToken)]);
        sessionID = rows[0]?.Session_ID || null;
    }
    if (sessionID) {
        await query(`UPDATE Auth_Session SET Revoked_At=COALESCE(Revoked_At,NOW(3)),Revocation_Reason=COALESCE(Revocation_Reason,'user logout')
            WHERE Session_ID=?`, [sessionID]);
        await query('UPDATE Auth_Refresh_Token SET Revoked_At=COALESCE(Revoked_At,NOW(3)) WHERE Session_ID=?', [sessionID]);
        await query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type)
            SELECT Session_ID,User_ID,'SESSION_LOGOUT' FROM Auth_Session WHERE Session_ID=?`, [sessionID]);
    }
    clearWebSessionCookies(res);
    return res.status(204).end();
});

app.get('/auth/me', authenticateToken, async (req, res) => {
    const rows = await query('SELECT First_Name,Last_Name,Email FROM User WHERE ID=? LIMIT 1', [req.user.id]);
    if (!rows.length) return sendApiError(res, 404, 'USER_NOT_FOUND', 'User not found');
    return res.json({ success: true, data: { id: req.user.id, name: `${rows[0].First_Name} ${rows[0].Last_Name}`, email: rows[0].Email,
        role: normalizeRole(req.user.role), organizationId: req.user.organizationId || null, blockchainID: req.user.blockchainID || null,
        mustChangePassword: Boolean(req.user.mustChangePassword) } });
});

app.get('/auth/mfa/status', authenticateToken, async (req, res) => {
    const rows = await query(`SELECT c.Enabled_At,c.Last_Used_At,
        (SELECT COUNT(*) FROM Auth_MFA_Recovery_Code r WHERE r.User_ID=c.User_ID AND r.Used_At IS NULL) AS Recovery_Codes_Remaining
        FROM Auth_MFA_Credential c WHERE c.User_ID=? AND c.Reset_At IS NULL`, [req.user.id]);
    return res.json({ success: true, data: { enabled: rows.length === 1, enabledAt: rows[0]?.Enabled_At || null,
        lastUsedAt: rows[0]?.Last_Used_At || null, recoveryCodesRemaining: Number(rows[0]?.Recovery_Codes_Remaining || 0) } });
});

app.post('/auth/mfa/recovery-codes', authenticateToken, authRateLimit('mfa-recovery', 5, 15 * 60 * 1000), async (req, res) => {
    const passwordRows = await query('SELECT Password FROM User WHERE ID=? AND IsActive=1', [req.user.id]);
    const credentialRows = await query('SELECT * FROM Auth_MFA_Credential WHERE User_ID=? AND Reset_At IS NULL', [req.user.id]);
    if (!passwordRows.length || !(await bcrypt.compare(String(req.body?.currentPassword || ''), passwordRows[0].Password))) {
        return sendApiError(res, 401, 'RECENT_AUTH_REQUIRED', 'Current password is incorrect');
    }
    if (!credentialRows.length || !verifyTotp(decryptSecret({ ciphertext: credentialRows[0].Secret_Ciphertext,
        iv: credentialRows[0].Secret_IV, tag: credentialRows[0].Secret_Tag }), req.body?.mfaCode)) {
        return sendApiError(res, 401, 'MFA_CODE_INVALID', 'A current authenticator code is required');
    }
    const recoveryCodes = generateRecoveryCodes();
    let connection;
    try {
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        await connection.query('DELETE FROM Auth_MFA_Recovery_Code WHERE User_ID=?', [req.user.id]);
        for (const recoveryCode of recoveryCodes) await connection.query(
            'INSERT INTO Auth_MFA_Recovery_Code (User_ID,Code_Hash) VALUES (?,?)', [req.user.id, hashRecoveryCode(recoveryCode)]);
        await connection.query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type)
            VALUES (?,?,'MFA_RECOVERY_CODES_REGENERATED')`, [req.user.sid, req.user.id]);
        await connection.commit();
        res.set('Cache-Control', 'no-store');
        return res.json({ success: true, recoveryCodes });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, 500, 'MFA_RECOVERY_REGEN_FAILED', 'Unable to regenerate recovery codes');
    } finally { if (connection) connection.release(); }
});

app.post('/auth/mfa/users/:userID/reset', authenticateToken, requireRoles('system'), authRateLimit('mfa-reset', 5, 15 * 60 * 1000), async (req, res) => {
    const actorRows = await query(`SELECT u.Password,c.* FROM User u JOIN Auth_MFA_Credential c ON c.User_ID=u.ID
        WHERE u.ID=? AND u.IsActive=1 AND c.Reset_At IS NULL`, [req.user.id]);
    if (!actorRows.length || !(await bcrypt.compare(String(req.body?.currentPassword || ''), actorRows[0].Password))) {
        return sendApiError(res, 401, 'RECENT_AUTH_REQUIRED', 'Current password is incorrect');
    }
    if (!verifyTotp(decryptSecret({ ciphertext: actorRows[0].Secret_Ciphertext, iv: actorRows[0].Secret_IV,
        tag: actorRows[0].Secret_Tag }), req.body?.mfaCode)) return sendApiError(res, 401, 'MFA_CODE_INVALID', 'A current authenticator code is required');
    const targetUserID = Number(req.params.userID);
    if (!Number.isInteger(targetUserID) || targetUserID <= 0 || targetUserID === Number(req.user.id)) {
        return sendApiError(res, 400, 'INVALID_MFA_RESET_TARGET', 'Select another active user for controlled MFA reset');
    }
    let connection;
    try {
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [targets] = await connection.query('SELECT ID FROM User WHERE ID=? AND IsActive=1 FOR UPDATE', [targetUserID]);
        if (!targets.length) throw Object.assign(new Error('Active user not found'), { statusCode: 404, code: 'USER_NOT_FOUND' });
        await connection.query('UPDATE Auth_MFA_Credential SET Reset_At=NOW(3) WHERE User_ID=? AND Reset_At IS NULL', [targetUserID]);
        await connection.query('DELETE FROM Auth_MFA_Recovery_Code WHERE User_ID=?', [targetUserID]);
        await connection.query('DELETE FROM Auth_MFA_Challenge WHERE User_ID=?', [targetUserID]);
        await connection.query('UPDATE User SET Security_Version=Security_Version+1,Sessions_Invalid_Before=NOW(3) WHERE ID=?', [targetUserID]);
        await connection.query(`UPDATE Auth_Session SET Revoked_At=COALESCE(Revoked_At,NOW(3)),Revocation_Reason='MFA reset by system administrator'
            WHERE User_ID=?`, [targetUserID]);
        await connection.query(`UPDATE Auth_Refresh_Token rt JOIN Auth_Session s ON s.Session_ID=rt.Session_ID
            SET rt.Revoked_At=COALESCE(rt.Revoked_At,NOW(3)) WHERE s.User_ID=?`, [targetUserID]);
        await connection.query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type,Details)
            VALUES (?,?,?,JSON_OBJECT('targetUserID',?))`, [req.user.sid, req.user.id, 'MFA_RESET_BY_SYSTEM', targetUserID]);
        await connection.commit();
        return res.json({ success: true, message: 'MFA reset. Existing sessions were revoked; enrollment is required at next login.' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, error.code || 'MFA_RESET_FAILED', error.statusCode ? error.message : 'Unable to reset MFA');
    } finally { if (connection) connection.release(); }
});

app.post('/auth/logout-all', authenticateToken, async (req, res) => {
    const currentPassword = req.body?.currentPassword;
    const rows = await query('SELECT Password FROM User WHERE ID=? AND IsActive=1 LIMIT 1', [req.user.id]);
    if (!currentPassword || !rows.length || !(await bcrypt.compare(currentPassword, rows[0].Password))) {
        return sendApiError(res, 401, 'RECENT_AUTH_REQUIRED', 'Current password is required');
    }
    await query(`UPDATE User SET Security_Version=Security_Version+1,Sessions_Invalid_Before=NOW(3) WHERE ID=?`, [req.user.id]);
    await query(`UPDATE Auth_Session SET Revoked_At=COALESCE(Revoked_At,NOW(3)),Revocation_Reason=COALESCE(Revocation_Reason,'user logout all')
        WHERE User_ID=?`, [req.user.id]);
    await query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type)
        VALUES (NULL,?,'LOGOUT_ALL')`, [req.user.id]);
    clearWebSessionCookies(res);
    return res.status(204).end();
});

app.get('/auth/sessions', authenticateToken, async (req, res) => {
    const rows = await query(`SELECT Session_ID,Client_Type,Device_Label,Created_At,Last_Seen_At,Idle_Expires_At,Absolute_Expires_At
        FROM Auth_Session WHERE User_ID=? AND Revoked_At IS NULL AND Idle_Expires_At>NOW(3) AND Absolute_Expires_At>NOW(3)
        ORDER BY Last_Seen_At DESC`, [req.user.id]);
    return res.json({ success: true, data: rows.map((row) => ({
        sessionId: row.Session_ID, clientType: row.Client_Type, deviceLabel: row.Device_Label,
        createdAt: row.Created_At, lastSeenAt: row.Last_Seen_At, idleExpiresAt: row.Idle_Expires_At,
        absoluteExpiresAt: row.Absolute_Expires_At, current: row.Session_ID === req.user.sid,
    })) });
});

app.delete('/auth/sessions/:sessionId', authenticateToken, async (req, res) => {
    const result = await query(`UPDATE Auth_Session SET Revoked_At=COALESCE(Revoked_At,NOW(3)),
        Revocation_Reason=COALESCE(Revocation_Reason,'user device revocation') WHERE Session_ID=? AND User_ID=?`,
    [req.params.sessionId, req.user.id]);
    if (!result.affectedRows) return sendApiError(res, 404, 'SESSION_NOT_FOUND', 'Session not found');
    await query('UPDATE Auth_Refresh_Token SET Revoked_At=COALESCE(Revoked_At,NOW(3)) WHERE Session_ID=?', [req.params.sessionId]);
    await query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type)
        VALUES (?,?,?)`, [req.params.sessionId, req.user.id, req.params.sessionId === req.user.sid ? 'CURRENT_SESSION_REVOKED' : 'SESSION_REVOKED']);
    if (req.params.sessionId === req.user.sid) clearWebSessionCookies(res);
    return res.status(204).end();
});

app.post('/register', authenticateToken, requireRoles('system'), async (req, res) => {
    const { firstName, lastName, username, contactNumber, password, organizationId } = req.body;
    const roleId = ADMIN_ROLE_ID;

    // Validate required fields
    if (!firstName || !lastName || !username || !contactNumber || !password || !organizationId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        validatePersonNames({ firstName, lastName }, 'Admin', 'ADMIN_NAME_TOO_LONG');
        validateEmail(username); validateContactNumber(contactNumber);
        if (!validatePassword(password)) throw validationError('INVALID_PASSWORD', 'Temporary password must be 12 to 72 UTF-8 bytes and include uppercase, lowercase, number, and symbol');
    } catch (error) { return sendApiError(res, 400, error.code || 'INVALID_ADMIN', error.message); }

    db.getConnection(async (connectionErr, connection) => {
        if (connectionErr) {
            console.error(connectionErr);
            return res.status(500).json({ error: 'Database connection error during registration' });
        }

        const query = (sql, params = []) => new Promise((resolve, reject) => {
            connection.query(sql, params, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        const beginTransaction = () => new Promise((resolve, reject) => {
            connection.beginTransaction((err) => err ? reject(err) : resolve());
        });
        const commit = () => new Promise((resolve, reject) => {
            connection.commit((err) => err ? reject(err) : resolve());
        });
        const rollback = () => new Promise((resolve) => connection.rollback(() => resolve()));

        try {
            await beginTransaction();

            const existingUsers = await query("SELECT ID FROM User WHERE Email = ? LIMIT 1", [username]);
            if (existingUsers.length > 0) {
                await rollback();
                return res.status(400).json({ error: 'User already exists' });
            }

            const targetOrganization = Number(organizationId);
            if (!targetOrganization) {
                await rollback();
                return res.status(400).json({ error: 'A valid clinic is required' });
            }
            const organizations = await query('SELECT Organization_ID FROM Organization WHERE Organization_ID = ? AND IsActive = 1', [targetOrganization]);
            if (!organizations.length) {
                await rollback();
                return res.status(404).json({ error: 'Active clinic not found' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const insertUserSQL = `
                INSERT INTO User 
                (First_Name, Last_Name, Email, Contact_Number, Password, Role_ID, Created_Date, IsActive, Must_Change_Password)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), 1, 1)
            `;
            const userResult = await query(insertUserSQL, [
                firstName,
                lastName,
                username,
                contactNumber,
                hashedPassword,
                roleId
            ]);

            await query(
                `INSERT INTO Admin (User_ID, Organization_ID) VALUES (?, ?)`,
                [userResult.insertId, targetOrganization]
            );

            await commit();
            return res.json({ message: 'Admin registered successfully' });
        } catch (err) {
            await rollback();
            console.error(err);

            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'User or organization admin already exists' });
            }

            return res.status(500).json({ error: 'Error processing registration' });
        } finally {
            connection.release();
        }
    });
});

const validatePassword = (password) => typeof password === 'string' && password.length >= 12 && Buffer.byteLength(password, 'utf8') <= 72
    && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

app.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !validatePassword(newPassword)) {
        return sendApiError(res, 400, 'INVALID_PASSWORD', 'New password must be 12 to 72 UTF-8 bytes and include uppercase, lowercase, number, and symbol');
    }
    let connection;
    try {
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT Password, First_Name, Last_Name, Email, Role_ID, Security_Version FROM User WHERE ID = ? AND IsActive = 1 FOR UPDATE', [req.user.id]);
        if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].Password))) {
            await connection.rollback();
            return sendApiError(res, 401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
        }
        if (await bcrypt.compare(newPassword, rows[0].Password)) {
            await connection.rollback();
            return sendApiError(res, 400, 'PASSWORD_REUSE', 'New password must differ from the current password');
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const securityVersion = Number(rows[0].Security_Version || 1) + 1;
        await connection.query(`UPDATE User SET Password=?,Must_Change_Password=0,Security_Version=?,
            Sessions_Invalid_Before=NOW(3) WHERE ID=?`, [passwordHash, securityVersion, req.user.id]);
        await connection.query(`UPDATE Auth_Session SET Revoked_At=NOW(3),Revocation_Reason='password changed'
            WHERE User_ID=? AND Session_ID<>? AND Revoked_At IS NULL`, [req.user.id, req.user.sid]);
        await connection.query(`UPDATE Auth_Refresh_Token rt JOIN Auth_Session s ON s.Session_ID=rt.Session_ID
            SET rt.Revoked_At=COALESCE(rt.Revoked_At,NOW(3)) WHERE s.User_ID=?`, [req.user.id]);
        const [sessions] = await connection.query('SELECT Client_Type,Absolute_Expires_At FROM Auth_Session WHERE Session_ID=? AND User_ID=? FOR UPDATE', [req.user.sid, req.user.id]);
        if (!sessions.length) throw Object.assign(new Error('Current session not found'), { code: 'SESSION_REVOKED', statusCode: 401 });
        const refreshToken = base64UrlSecret();
        const csrfToken = sessions[0].Client_Type === 'web' ? base64UrlSecret() : null;
        await connection.query(`UPDATE Auth_Session SET Security_Version=?,Last_Seen_At=NOW(3),
            Csrf_Token_Hash=? WHERE Session_ID=?`, [securityVersion, csrfToken ? hashSessionSecret(csrfToken) : null, req.user.sid]);
        await connection.query(`INSERT INTO Auth_Refresh_Token
            (Token_ID,Session_ID,Token_Hash,Expires_At) VALUES (?,?,?,?)`,
        [crypto.randomUUID(), req.user.sid, hashSessionSecret(refreshToken), sessions[0].Absolute_Expires_At]);
        await connection.query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type)
            VALUES (?,?,?)`, [req.user.sid, req.user.id, 'PASSWORD_CHANGED']);
        const tokenPayload = {
            id: req.user.id, role: normalizeRole(req.user.role), organizationId: req.user.organizationId || null,
            worksAt: req.user.worksAt || null, specialty: req.user.specialty || null,
            blockchainID: req.user.blockchainID || null, mustChangePassword: false, securityVersion,
        };
        const session = {
            accessToken: signAccessToken(tokenPayload, req.user.sid), refreshToken, csrfToken,
            refreshExpires: new Date(sessions[0].Absolute_Expires_At),
        };
        await connection.commit();
        res.set('Cache-Control', 'no-store');
        const user = { id: req.user.id, name: `${rows[0].First_Name} ${rows[0].Last_Name}`, email: rows[0].Email,
            role: normalizeRole(req.user.role), organizationId: req.user.organizationId || null,
            blockchainID: req.user.blockchainID || null, mustChangePassword: false };
        if (sessions[0].Client_Type === 'web') {
            setWebSessionCookies(res, session);
            return res.json({ success: true, user, csrfToken });
        }
        return res.json({ success: true, token: session.accessToken, refreshToken, user });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error(error);
        return sendApiError(res, error.statusCode || 500, error.code || 'PASSWORD_CHANGE_FAILED', error.statusCode ? error.message : 'Unable to change password');
    } finally { if (connection) connection.release(); }
});

const normalizeClinic = (row) => ({
    clinicID: row.Organization_ID, name: row.Name, address: row.Address, description: row.Description,
    coordinates: row.Coordinates, type: row.Type, isActive: Boolean(row.IsActive),
    createdDate: row.Created_Date, modifiedDate: row.Modified_Date, adminCount: Number(row.Admin_Count || 0)
});

app.get('/clinics', authenticateToken, requireRoles('system'), async (_req, res) => {
    try {
        const rows = await query(`SELECT Organization.*, COUNT(Admin.User_ID) AS Admin_Count FROM Organization
            LEFT JOIN Admin ON Admin.Organization_ID = Organization.Organization_ID
            GROUP BY Organization.Organization_ID ORDER BY Organization.Name`);
        return res.json({ success: true, data: rows.map(normalizeClinic) });
    } catch (error) { console.error(error); return sendApiError(res, 500, 'CLINIC_LIST_FAILED', 'Unable to load clinics'); }
});

app.get('/clinic/me', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const rows = await query(`SELECT Organization_ID,Name,Address,Type FROM Organization
            WHERE Organization_ID=? AND IsActive=1 LIMIT 1`, [req.user.organizationId]);
        if (!rows.length) return sendApiError(res, 404, 'CLINIC_NOT_FOUND', 'Authenticated admin clinic was not found');
        return res.json({ success: true, data: {
            clinicID: rows[0].Organization_ID, name: rows[0].Name, address: rows[0].Address, type: rows[0].Type,
        } });
    } catch (error) { return sendApiError(res, 500, 'CLINIC_READ_FAILED', 'Unable to retrieve authenticated admin clinic'); }
});

app.get('/lifecycle-operations', authenticateToken, requireRoles('system'), async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    if (status && !['PENDING','FABRIC_COMMITTED','COMPLETED','FAILED'].includes(status)) {
        return sendApiError(res, 400, 'INVALID_LIFECYCLE_STATUS', 'Unsupported lifecycle status');
    }
    try {
        const rows = await query(`SELECT Operation_ID,Operation_Type,Entity_Type,Entity_ID,Clinic_ID,Status,
            Current_Stage,Correlation_ID,Error_Code,Error_Message,Created_At,Updated_At,Completed_At
            FROM Entity_Lifecycle_Operation WHERE (? IS NULL OR Status=?) ORDER BY Created_At DESC LIMIT ?`,
        [status, status, limit]);
        return res.json({ success: true, data: rows });
    } catch (error) { return sendApiError(res, 500, 'LIFECYCLE_OPERATION_LIST_FAILED', 'Unable to load lifecycle operations'); }
});

app.post('/clinics', authenticateToken, requireRoles('system'), async (req, res) => {
    const { name, address, description, coordinates, type = 'Dental Clinic', admin } = req.body || {};
    if (!name || !address || !admin?.firstName || !admin?.lastName || !admin?.email || !admin?.contactNumber || !validatePassword(admin?.password)) {
        return sendApiError(res, 400, 'INVALID_CLINIC', 'Clinic name, address, and a first admin with a strong temporary password are required');
    }
    try {
        requireTextLimit(name, 'Clinic name', 255, 'CLINIC_NAME_TOO_LONG');
        requireTextLimit(address, 'Clinic address', 1000, 'CLINIC_ADDRESS_TOO_LONG');
        requireTextLimit(description, 'Clinic description', 2000, 'CLINIC_DESCRIPTION_TOO_LONG');
        requireTextLimit(coordinates, 'Clinic coordinates', 255, 'CLINIC_COORDINATES_TOO_LONG');
        requireTextLimit(type, 'Clinic type', 100, 'CLINIC_TYPE_TOO_LONG');
        validatePersonNames(admin, 'Admin'); validateEmail(admin.email); validateContactNumber(admin.contactNumber);
    } catch (error) { return sendApiError(res, 400, error.code || 'INVALID_CLINIC', error.message); }
    let connection; let operationID;
    try {
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [duplicate] = await connection.query('SELECT ID FROM User WHERE Email = ? LIMIT 1', [admin.email]);
        if (duplicate.length) { const error = new Error('Admin email already exists'); error.statusCode = 409; throw error; }
        const [lastClinic] = await connection.query('SELECT Organization_ID FROM Organization ORDER BY Organization_ID DESC LIMIT 1 FOR UPDATE');
        const clinicID = Number(lastClinic[0]?.Organization_ID || 0) + 1;
        operationID = await beginLifecycleOperation(req, 'CLINIC_CREATE', 'clinic', clinicID, clinicID, { name, adminEmail: admin.email });
        await connection.query(`INSERT INTO Organization
            (Organization_ID, Name, Address, Description, Coordinates, Type, IsActive, Created_Date) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
            [clinicID, name, address, description || null, coordinates || null, type]);
        const passwordHash = await bcrypt.hash(admin.password, 10);
        const [userResult] = await connection.query(`INSERT INTO User
            (First_Name, Last_Name, Password, Email, Contact_Number, Role_ID, Created_Date, IsActive, Must_Change_Password)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), 1, 1)`, [admin.firstName, admin.lastName, passwordHash, admin.email, admin.contactNumber, ADMIN_ROLE_ID]);
        await connection.query('INSERT INTO Admin (Organization_ID, User_ID) VALUES (?, ?)', [clinicID, userResult.insertId]);
        await provisionFabricIdentity(req, 'admin', `AdminClinic${clinicID}`, clinicID);
        await markLifecycleOperation(operationID, 'FABRIC_COMMITTED', 'ADMIN_IDENTITY_PROVISIONED');
        await connection.commit();
        await markLifecycleOperation(operationID, 'COMPLETED', 'MYSQL_COMMITTED');
        return res.status(201).json({ success: true, data: { clinicID, primaryAdminID: userResult.insertId } });
    } catch (error) {
        if (connection) await connection.rollback(); console.error(error);
        await markLifecycleOperation(operationID, 'FAILED', 'CLINIC_CREATE_FAILED', error).catch(() => {});
        return sendApiError(res, error.statusCode || 500, error.code || 'CLINIC_CREATE_FAILED', error.message || 'Unable to create clinic');
    } finally { if (connection) connection.release(); }
});

app.get('/clinics/:id/deactivation-impact', authenticateToken, requireRoles('system'), async (req, res) => {
    try {
        const clinicID=Number(req.params.id); if(!clinicID)return sendApiError(res,400,'INVALID_CLINIC','Valid clinic is required');
        const [actors,appointments,requests,clinical,lab]=await Promise.all([
            query(`SELECT SUM(role='doctor') doctors,SUM(role='patient') patients,SUM(role='admin') admins FROM (SELECT 'doctor' role FROM Doctor JOIN User ON User.ID=Doctor.ID WHERE Doctor.Clinic_ID=? AND User.IsActive=1 UNION ALL SELECT 'patient' FROM Patient JOIN User ON User.ID=Patient.ID WHERE Patient.Clinic_ID=? AND User.IsActive=1 UNION ALL SELECT 'admin' FROM Admin JOIN User ON User.ID=Admin.User_ID WHERE Admin.Organization_ID=? AND User.IsActive=1) scoped`,[clinicID,clinicID,clinicID]),
            query(`SELECT COUNT(*) total FROM Appointment JOIN Patient ON Patient.ID=Appointment.Patient_ID WHERE Patient.Clinic_ID=? AND LOWER(COALESCE(Appointment.Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished')`,[clinicID]),
            query("SELECT COUNT(*) total FROM Request WHERE Organization_ID=? AND LOWER(COALESCE(Status,'pending')) NOT IN ('cancelled','rejected','consent_revoked','completed')",[clinicID]),
            query('SELECT COUNT(*) total FROM Clinical_Record JOIN Patient ON Patient.Blockchain_ID=Clinical_Record.Patient_Blockchain_ID WHERE Patient.Clinic_ID=?',[clinicID]),
            query('SELECT COUNT(*) total FROM Lab_Result WHERE Clinic_ID=?',[clinicID]),
        ]);
        return res.json({success:true,data:{clinicID,actors:{doctors:Number(actors[0]?.doctors||0),patients:Number(actors[0]?.patients||0),admins:Number(actors[0]?.admins||0)},activeAppointmentsToCancel:Number(appointments[0]?.total||0),activeRequestsToCancel:Number(requests[0]?.total||0),clinicalRecordsToPreserve:Number(clinical[0]?.total||0),labResultsToPreserve:Number(lab[0]?.total||0)}});
    } catch(error){return sendApiError(res,error.statusCode||500,error.code||'CLINIC_DEACTIVATION_IMPACT_FAILED',error.message);}
});

app.patch('/clinics/:id', authenticateToken, requireRoles('system'), async (req, res) => {
    const clinicID = Number(req.params.id); const { name, address, description, coordinates, type, isActive } = req.body || {};
    if (!clinicID || !name || !address || typeof isActive !== 'boolean') return sendApiError(res, 400, 'INVALID_CLINIC', 'Valid clinic name, address, and status are required');
    let connection;
    try {
        requireTextLimit(name, 'Clinic name', 255, 'CLINIC_NAME_TOO_LONG');
        requireTextLimit(address, 'Clinic address', 1000, 'CLINIC_ADDRESS_TOO_LONG');
        requireTextLimit(description, 'Clinic description', 2000, 'CLINIC_DESCRIPTION_TOO_LONG');
        requireTextLimit(coordinates, 'Clinic coordinates', 255, 'CLINIC_COORDINATES_TOO_LONG');
        requireTextLimit(type, 'Clinic type', 100, 'CLINIC_TYPE_TOO_LONG');
        if (isActive) {
            const result=await query(`UPDATE Organization SET Name=?,Address=?,Description=?,Coordinates=?,Type=?,IsActive=1,Modified_Date=NOW() WHERE Organization_ID=?`,[name,address,description||null,coordinates||null,type||'Dental Clinic',clinicID]);
            if(!result.affectedRows)return sendApiError(res,404,'CLINIC_NOT_FOUND','Clinic not found');
            return res.json({success:true,message:'Clinic profile updated; previously deactivated users require explicit reactivation workflows'});
        }
        connection=await db.promise().getConnection();await connection.beginTransaction();
        const [organizations]=await connection.query('SELECT Organization_ID,IsActive FROM Organization WHERE Organization_ID=? FOR UPDATE',[clinicID]);
        if(!organizations.length)throw Object.assign(new Error('Clinic not found'),{statusCode:404,code:'CLINIC_NOT_FOUND'});
        if(!organizations[0].IsActive){await connection.rollback();return res.json({success:true,data:{clinicID,deactivated:true,alreadyInactive:true,idempotent:true},message:'Clinic is already inactive; no lifecycle changes were repeated'});}
        const [doctors]=await connection.query(`${DOCTOR_SELECT} WHERE Doctor.Clinic_ID=? AND User.IsActive=1 FOR UPDATE`,[clinicID]);
        const [patients]=await connection.query(`${PATIENT_SELECT} WHERE Patient.Clinic_ID=? AND User.IsActive=1 FOR UPDATE`,[clinicID]);
        const [admins]=await connection.query('SELECT User.ID FROM Admin JOIN User ON User.ID=Admin.User_ID WHERE Admin.Organization_ID=? AND User.IsActive=1 FOR UPDATE',[clinicID]);
        const userIDs=[...admins.map(x=>x.ID),...doctors.map(x=>x.ID),...patients.map(x=>x.ID)];
        const actorIDs=[...doctors.map(x=>String(x.Blockchain_ID)),...patients.map(x=>String(x.Blockchain_ID))];
        const ledger=await callBlockchain(req,`/internal/clinics/${clinicID}/deactivate`,'POST',{});
        for(const doctor of doctors)await retireFabricIdentity(req,'doctor',doctor.Blockchain_ID,clinicID);
        for(const patient of patients)await retireFabricIdentity(req,'patient',patient.Blockchain_ID,clinicID);
        await retireFabricIdentity(req,'admin',`AdminClinic${clinicID}`,clinicID);
        const [appointments]=await connection.query(`UPDATE Appointment JOIN Patient ON Patient.ID=Appointment.Patient_ID SET Appointment.Status='cancelled',Appointment.Notes=CONCAT_WS('\n',NULLIF(Appointment.Notes,''),'Automatically cancelled because the clinic was deactivated.'),Appointment.Cancelled_Date=COALESCE(Appointment.Cancelled_Date,NOW()),Appointment.Modified_Date=NOW() WHERE Patient.Clinic_ID=? AND LOWER(COALESCE(Appointment.Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished')`,[clinicID]);
        const [requests]=await connection.query("UPDATE Request SET Status='cancelled',Modified_Date=CURDATE() WHERE Organization_ID=? AND LOWER(COALESCE(Status,'pending')) NOT IN ('cancelled','rejected','consent_revoked','completed')",[clinicID]);
        if(actorIDs.length)await connection.query(`UPDATE Push_Subscription SET Active=0,Updated_At=NOW(),Last_Error='clinic deactivated' WHERE (Recipient_Role='admin' AND Recipient_ID=?) OR Recipient_ID IN (${actorIDs.map(()=>'?').join(',')})`,[String(clinicID),...actorIDs]);
        else await connection.query("UPDATE Push_Subscription SET Active=0,Updated_At=NOW(),Last_Error='clinic deactivated' WHERE Recipient_Role='admin' AND Recipient_ID=?",[String(clinicID)]);
        await connection.query('UPDATE Patient SET Doctors=JSON_ARRAY(),Modified_Date=NOW() WHERE Clinic_ID=?',[clinicID]);
        if(userIDs.length){await connection.query(`UPDATE User SET IsActive=0,Security_Version=Security_Version+1,Sessions_Invalid_Before=NOW(3) WHERE ID IN (${userIDs.map(()=>'?').join(',')})`,userIDs);await connection.query(`UPDATE Auth_Session SET Revoked_At=COALESCE(Revoked_At,NOW(3)),Revocation_Reason=COALESCE(Revocation_Reason,'clinic deactivated') WHERE User_ID IN (${userIDs.map(()=>'?').join(',')})`,userIDs);}
        await connection.query(`UPDATE Organization SET Name=?,Address=?,Description=?,Coordinates=?,Type=?,IsActive=0,Modified_Date=NOW() WHERE Organization_ID=?`,[name,address,description||null,coordinates||null,type||'Dental Clinic',clinicID]);
        await connection.commit();
        return res.json({success:true,data:{clinicID,deactivated:true,actors:{doctors:doctors.length,patients:patients.length,admins:admins.length},appointmentsCancelled:appointments.affectedRows,requestsCancelled:requests.affectedRows,ledger},message:'Clinic deactivated; active appointments and requests cancelled; access revoked; clinical and ledger history preserved'});
    } catch (error) { if(connection)await connection.rollback().catch(()=>{});console.error(error); return sendApiError(res, error.statusCode || 500, error.code || 'CLINIC_UPDATE_FAILED', error.statusCode ? error.message : 'Unable to update clinic'); }
    finally{if(connection)connection.release();}
});

app.get('/clinic-admins', authenticateToken, requireRoles('admin', 'system'), async (req, res) => {
    const requestedClinic = Number(req.query.clinicID || req.user.organizationId);
    if (!requestedClinic || (normalizeRole(req.user.role) === 'admin' && requestedClinic !== Number(req.user.organizationId))) return sendApiError(res, 403, 'CLINIC_SCOPE_DENIED', 'Clinic scope is not permitted');
    try {
        const rows = await query(`SELECT User.ID, User.First_Name, User.Last_Name, User.Email, User.Contact_Number, User.IsActive,
            User.Must_Change_Password,
            Admin.Organization_ID FROM Admin JOIN User ON User.ID=Admin.User_ID WHERE Admin.Organization_ID=? ORDER BY User.Last_Name`, [requestedClinic]);
        return res.json({ success: true, data: rows.map((row) => ({ id: row.ID, firstName: row.First_Name, lastName: row.Last_Name,
            email: row.Email, contactNumber: row.Contact_Number, clinicID: row.Organization_ID, isActive: Boolean(row.IsActive),
            mustChangePassword: Boolean(row.Must_Change_Password) })) });
    } catch (error) { console.error(error); return sendApiError(res, 500, 'ADMIN_LIST_FAILED', 'Unable to load clinic admins'); }
});

const validateClinicAdminProfile = (body, requirePassword = false) => {
    const required = ['firstName', 'lastName', 'email', 'contactNumber'];
    if (requirePassword) required.push('password');
    const missing = required.filter((field) => !body?.[field] || !String(body[field]).trim());
    if (missing.length || !/^\S+@\S+\.\S+$/.test(body?.email || '') || (requirePassword && !validatePassword(body.password))) {
        const error = new Error(requirePassword
            ? 'Complete administrator details and a strong temporary password are required'
            : 'Complete administrator details and a valid email are required');
        error.statusCode = 400;
        throw error;
    }
    validatePersonNames(body, 'Admin'); validateEmail(body.email); validateContactNumber(body.contactNumber);
};

const revokeManagedAdminSessions = async (connection, userID, reason) => {
    await connection.query(`UPDATE Auth_Session SET Revoked_At=COALESCE(Revoked_At,NOW(3)),
        Revocation_Reason=COALESCE(Revocation_Reason,?) WHERE User_ID=?`, [reason, userID]);
    await connection.query(`UPDATE Auth_Refresh_Token rt JOIN Auth_Session s ON s.Session_ID=rt.Session_ID
        SET rt.Revoked_At=COALESCE(rt.Revoked_At,NOW(3)) WHERE s.User_ID=?`, [userID]);
};

const recordClinicAdminEvent = (connection, req, eventType, details) => connection.query(
    `INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type,Details) VALUES (?,?,?,?)`,
    [req.user.sid, req.user.id, eventType, JSON.stringify(details)]
);

app.patch('/clinics/:clinicID/admin', authenticateToken, requireRoles('system'), async (req, res) => {
    const clinicID = Number(req.params.clinicID);
    let connection;
    try {
        if (!clinicID) throw Object.assign(new Error('Valid clinic is required'), { statusCode: 400 });
        validateClinicAdminProfile(req.body);
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [admins] = await connection.query(`SELECT User.ID,User.Email FROM Admin JOIN User ON User.ID=Admin.User_ID
            WHERE Admin.Organization_ID=? FOR UPDATE`, [clinicID]);
        if (!admins.length) throw Object.assign(new Error('Clinic administrator not found'), { statusCode: 404 });
        const [duplicate] = await connection.query('SELECT ID FROM User WHERE Email=? AND ID<>? LIMIT 1', [req.body.email, admins[0].ID]);
        if (duplicate.length) throw Object.assign(new Error('Email is already in use'), { statusCode: 409 });
        await connection.query(`UPDATE User SET First_Name=?,Last_Name=?,Email=?,Contact_Number=?
            WHERE ID=?`, [req.body.firstName, req.body.lastName, req.body.email, req.body.contactNumber, admins[0].ID]);
        await recordClinicAdminEvent(connection, req, 'CLINIC_ADMIN_UPDATED', {
            clinicID, adminID: admins[0].ID, previousEmail: admins[0].Email, email: req.body.email,
        });
        await connection.commit();
        return res.json({ success: true });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, error.code || 'CLINIC_ADMIN_UPDATE_FAILED', error.statusCode ? error.message : 'Unable to update clinic administrator');
    } finally { if (connection) connection.release(); }
});

app.post('/clinics/:clinicID/admin/reset-password', authenticateToken, requireRoles('system'), async (req, res) => {
    const clinicID = Number(req.params.clinicID);
    if (!clinicID || !validatePassword(req.body?.password)) {
        return sendApiError(res, 400, 'INVALID_PASSWORD', 'A strong temporary password is required');
    }
    let connection;
    try {
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [admins] = await connection.query(`SELECT User.ID FROM Admin JOIN User ON User.ID=Admin.User_ID
            WHERE Admin.Organization_ID=? FOR UPDATE`, [clinicID]);
        if (!admins.length) throw Object.assign(new Error('Clinic administrator not found'), { statusCode: 404 });
        const passwordHash = await bcrypt.hash(req.body.password, 10);
        await connection.query(`UPDATE User SET Password=?,Must_Change_Password=1,Security_Version=Security_Version+1,
            Sessions_Invalid_Before=NOW(3) WHERE ID=?`, [passwordHash, admins[0].ID]);
        await revokeManagedAdminSessions(connection, admins[0].ID, 'password reset by system administrator');
        await recordClinicAdminEvent(connection, req, 'CLINIC_ADMIN_PASSWORD_RESET', { clinicID, adminID: admins[0].ID });
        await connection.commit();
        return res.json({ success: true });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, 'CLINIC_ADMIN_RESET_FAILED', error.statusCode ? error.message : 'Unable to reset clinic administrator password');
    } finally { if (connection) connection.release(); }
});

app.post('/clinics/:clinicID/admin/transfer', authenticateToken, requireRoles('system'), async (req, res) => {
    const clinicID = Number(req.params.clinicID);
    let connection;
    try {
        if (!clinicID) throw Object.assign(new Error('Valid clinic is required'), { statusCode: 400 });
        validateClinicAdminProfile(req.body, true);
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [organizations] = await connection.query('SELECT Organization_ID FROM Organization WHERE Organization_ID=? FOR UPDATE', [clinicID]);
        if (!organizations.length) throw Object.assign(new Error('Clinic not found'), { statusCode: 404 });
        const [current] = await connection.query(`SELECT User.ID,User.Email FROM Admin JOIN User ON User.ID=Admin.User_ID
            WHERE Admin.Organization_ID=? FOR UPDATE`, [clinicID]);
        if (!current.length) throw Object.assign(new Error('Current clinic administrator not found'), { statusCode: 409 });
        const [duplicate] = await connection.query('SELECT ID FROM User WHERE Email=? LIMIT 1', [req.body.email]);
        if (duplicate.length) throw Object.assign(new Error('Replacement administrator email is already in use'), { statusCode: 409 });
        const passwordHash = await bcrypt.hash(req.body.password, 10);
        const [created] = await connection.query(`INSERT INTO User
            (First_Name,Last_Name,Password,Email,Contact_Number,Role_ID,Created_Date,IsActive,Must_Change_Password)
            VALUES (?,?,?,?,?,?,NOW(),1,1)`, [req.body.firstName, req.body.lastName, passwordHash, req.body.email,
            req.body.contactNumber, ADMIN_ROLE_ID]);
        await connection.query('UPDATE Admin SET User_ID=? WHERE Organization_ID=? AND User_ID=?',
            [created.insertId, clinicID, current[0].ID]);
        await connection.query(`UPDATE User SET IsActive=0,Security_Version=Security_Version+1,
            Sessions_Invalid_Before=NOW(3) WHERE ID=?`, [current[0].ID]);
        await revokeManagedAdminSessions(connection, current[0].ID, 'clinic ownership transferred');
        await recordClinicAdminEvent(connection, req, 'CLINIC_ADMIN_TRANSFERRED', {
            clinicID, previousAdminID: current[0].ID, previousEmail: current[0].Email,
            newAdminID: created.insertId, newEmail: req.body.email,
        });
        await connection.commit();
        return res.status(201).json({ success: true, data: { clinicID, previousAdminID: current[0].ID, newAdminID: created.insertId } });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, error.code || 'CLINIC_ADMIN_TRANSFER_FAILED', error.statusCode ? error.message : 'Unable to transfer clinic ownership');
    } finally { if (connection) connection.release(); }
});

app.get('/clinics/:clinicID/admin-history', authenticateToken, requireRoles('system'), async (req, res) => {
    const clinicID = Number(req.params.clinicID);
    if (!clinicID) return sendApiError(res, 400, 'INVALID_CLINIC', 'Valid clinic is required');
    try {
        const rows = await query(`SELECT Event_ID,Event_Type,Occurred_At,Details FROM Auth_Session_Event
            WHERE Event_Type IN ('CLINIC_ADMIN_UPDATED','CLINIC_ADMIN_PASSWORD_RESET','CLINIC_ADMIN_TRANSFERRED')
            AND JSON_UNQUOTE(JSON_EXTRACT(Details,'$.clinicID'))=? ORDER BY Occurred_At DESC`, [String(clinicID)]);
        return res.json({ success: true, data: rows.map((row) => ({
            eventID: row.Event_ID, eventType: row.Event_Type, occurredAt: row.Occurred_At,
            details: typeof row.Details === 'string' ? JSON.parse(row.Details) : row.Details,
        })) });
    } catch (error) { return sendApiError(res, 500, 'CLINIC_ADMIN_HISTORY_FAILED', 'Unable to load administrator history'); }
});

const DOCTOR_SELECT = `SELECT Doctor.*, User.First_Name, User.Last_Name, User.Email, User.Contact_Number, User.Created_Date, User.IsActive
    FROM Doctor INNER JOIN User ON Doctor.ID = User.ID`;
const CLINIC_DOCTOR_SCOPE = `(Doctor.Clinic_ID=? OR (Doctor.Clinic_ID IS NULL AND EXISTS (
    SELECT 1 FROM Patient WHERE Patient.Clinic_ID=? AND JSON_CONTAINS(Patient.Doctors, JSON_QUOTE(Doctor.Blockchain_ID))
)))`;
const normalizeDoctor = (row) => ({ doctorID: row.Blockchain_ID, firstName: row.First_Name, lastName: row.Last_Name,
    email: row.Email, contactNumber: row.Contact_Number, worksAt: row.Works_At, speciality: row.Specialty,
    licenseNumber: row.License_Number, emiratesID: row.Emirates_ID, clinicID: row.Clinic_ID,
    createdDate: row.Created_Date, modifiedDate: row.Modified_Date });
const validateDoctorPayload = (body, isCreate = false) => {
    const required = ['firstName','lastName','email','contactNumber','worksAt','speciality','licenseNumber','emiratesID'];
    if (isCreate) required.push('password');
    const missing = required.filter((field) => body[field] === undefined || body[field] === null || String(body[field]).trim() === '');
    if (missing.length) { const error = new Error(`Missing required fields: ${missing.join(', ')}`); error.statusCode = 400; throw error; }
    validatePersonNames(body, 'Doctor', 'DOCTOR_NAME_TOO_LONG'); validateEmail(body.email); validateContactNumber(body.contactNumber); validateEmiratesID(body.emiratesID);
    requireTextLimit(body.worksAt, 'Clinic name', 255, 'DOCTOR_WORKS_AT_TOO_LONG');
    requireTextLimit(body.speciality, 'Specialty', 100, 'DOCTOR_SPECIALTY_TOO_LONG');
    requireTextLimit(body.licenseNumber, 'License number', 100, 'DOCTOR_LICENSE_TOO_LONG');
    if (!/^[A-Za-z0-9][A-Za-z0-9 ./-]{1,99}$/.test(String(body.licenseNumber))) throw validationError('INVALID_DOCTOR_LICENSE', 'License number contains unsupported characters');
    if (isCreate && !validatePassword(body.password)) throw validationError('INVALID_PASSWORD', 'Temporary password must be 12 to 72 UTF-8 bytes and include uppercase, lowercase, number, and symbol');
};
const mutableDoctorProfile = (body) => ({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    contactNumber: body.contactNumber,
    worksAt: body.worksAt,
    speciality: body.speciality,
    licenseNumber: body.licenseNumber,
    emiratesID: body.emiratesID,
});

app.post('/doctors', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection; let operationID;
    try {
        validateDoctorPayload(req.body, true);
        const clinicID = Number(req.user.organizationId);
        if (!clinicID) return sendApiError(res, 403, 'ADMIN_CLINIC_MISSING', 'Authenticated admin has no clinic organization');
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [duplicates] = await connection.query(`SELECT Doctor.ID FROM Doctor INNER JOIN User ON Doctor.ID=User.ID
            WHERE User.Email=? OR Doctor.License_Number=? OR Doctor.Emirates_ID=? LIMIT 1`, [req.body.email, req.body.licenseNumber, req.body.emiratesID]);
        if (duplicates.length) { const error = new Error('Doctor email, license number, or Emirates ID already exists'); error.statusCode = 409; throw error; }
        const passwordHash = await bcrypt.hash(req.body.password, 10);
        const [userResult] = await connection.query(`INSERT INTO User
            (First_Name,Last_Name,Email,Contact_Number,Password,Role_ID,Created_Date,IsActive) VALUES (?,?,?,?,?,?,NOW(),1)`,
            [req.body.firstName, req.body.lastName, req.body.email, req.body.contactNumber, passwordHash, DOCTOR_ROLE_ID]);
        const doctorID = `Doctor-${crypto.randomUUID()}`;
        operationID = await beginLifecycleOperation(req, 'DOCTOR_CREATE', 'doctor', doctorID, clinicID, req.body);
        await connection.query(`INSERT INTO Doctor
            (ID,Works_At,Specialty,Blockchain_ID,License_Number,Emirates_ID,Clinic_ID,Modified_Date) VALUES (?,?,?,?,?,?,?,NOW())`,
            [userResult.insertId, req.body.worksAt, req.body.speciality, doctorID, req.body.licenseNumber, req.body.emiratesID, clinicID]);
        await provisionFabricIdentity(req, 'doctor', doctorID, clinicID);
        await callBlockchain(req, '/addDoctor', 'POST', { ...req.body, doctorID, clinicID, patients: [] });
        await markLifecycleOperation(operationID, 'FABRIC_COMMITTED', 'DOCTOR_LEDGER_CREATED');
        await connection.commit();
        await markLifecycleOperation(operationID, 'COMPLETED', 'MYSQL_COMMITTED');
        return res.status(201).json({ success: true, data: { ...req.body, password: undefined, doctorID, clinicID }, message: 'Doctor created consistently in MySQL and Fabric' });
    } catch (error) { if (connection) await connection.rollback().catch(() => {}); await markLifecycleOperation(operationID, 'FAILED', 'DOCTOR_CREATE_FAILED', error).catch(() => {}); return sendApiError(res, error.statusCode || (error.code === 'ER_DUP_ENTRY' ? 409 : 500), error.code || 'DOCTOR_CREATE_FAILED', error.message); }
    finally { if (connection) connection.release(); }
});

app.get('/doctors', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const rows = await query(`${DOCTOR_SELECT} WHERE ${CLINIC_DOCTOR_SCOPE} AND User.IsActive=1 ORDER BY User.Last_Name,User.First_Name`,
            [req.user.organizationId, req.user.organizationId]);
        return res.json({ success: true, data: rows.map(normalizeDoctor) });
    }
    catch (error) { return sendApiError(res, 500, 'DOCTOR_LIST_FAILED', 'Unable to retrieve doctors'); }
});

app.get('/doctors/:id', authenticateToken, requireRoles('admin','doctor'), async (req, res) => {
    try { const rows = await query(`${DOCTOR_SELECT} WHERE Doctor.Blockchain_ID=? AND User.IsActive=1 LIMIT 1`, [req.params.id]);
        if (!rows.length) return sendApiError(res, 404, 'DOCTOR_NOT_FOUND', 'Doctor not found');
        const doctor = normalizeDoctor(rows[0]); const role = normalizeRole(req.user.role);
        if (role === 'doctor' && req.user.blockchainID !== req.params.id) return sendApiError(res, 403, 'DOCTOR_OWNER_MISMATCH', 'Doctors may retrieve only their own profile');
        if (role === 'admin') requireAdminClinic(req, doctor.clinicID);
        return res.json({ success: true, data: doctor });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'DOCTOR_READ_FAILED', error.message); }
});

app.put('/doctors/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection;
    try {
        if (req.body.doctorID !== undefined && String(req.body.doctorID) !== String(req.params.id)) {
            return sendApiError(res, 400, 'DOCTOR_ID_MISMATCH', 'doctorID is immutable and must match the URL');
        }
        const clinicID = Number(req.user.organizationId);
        if (req.body.clinicID !== undefined && Number(req.body.clinicID) !== clinicID) {
            return sendApiError(res, 403, 'DOCTOR_CLINIC_IMMUTABLE', 'Doctor clinic cannot be changed through a profile update');
        }
        if (req.body.patients !== undefined || (req.body.password !== undefined && String(req.body.password) !== '')) {
            return sendApiError(res, 400, 'DOCTOR_PROTECTED_FIELD', 'Relationships and credentials require their dedicated security workflow');
        }
        const update = mutableDoctorProfile(req.body);
        validateDoctorPayload(update); connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${DOCTOR_SELECT} WHERE Doctor.Blockchain_ID=? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Doctor not found'); error.statusCode = 404; throw error; } requireAdminClinic(req, rows[0].Clinic_ID);
        await connection.query('UPDATE User SET First_Name=?,Last_Name=?,Email=?,Contact_Number=? WHERE ID=?', [update.firstName,update.lastName,update.email,update.contactNumber,rows[0].ID]);
        await connection.query('UPDATE Doctor SET Works_At=?,Specialty=?,License_Number=?,Emirates_ID=?,Modified_Date=NOW() WHERE ID=?', [update.worksAt,update.speciality,update.licenseNumber,update.emiratesID,rows[0].ID]);
        await callBlockchain(req, `/doctor/${encodeURIComponent(req.params.id)}`, 'PUT', { ...update, clinicID });
        await connection.commit(); return res.json({ success:true, data:{ ...update, doctorID:req.params.id, clinicID }, message:'Doctor updated consistently' });
    } catch (error) { if (connection) await connection.rollback().catch(()=>{}); return sendApiError(res,error.statusCode || (error.code==='ER_DUP_ENTRY'?409:500),error.code || 'DOCTOR_UPDATE_FAILED',error.message); }
    finally { if (connection) connection.release(); }
});

app.get('/doctors/:id/deactivation-impact', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const rows = await query(`${DOCTOR_SELECT} WHERE Doctor.Blockchain_ID=? AND User.IsActive=1 LIMIT 1`, [req.params.id]);
        if (!rows.length) return sendApiError(res, 404, 'DOCTOR_NOT_FOUND', 'Doctor not found');
        requireAdminClinic(req, rows[0].Clinic_ID);
        const [patients, appointments, replacements] = await Promise.all([
            query(`${PATIENT_SELECT} WHERE Patient.Clinic_ID=? AND User.IsActive=1 AND JSON_CONTAINS(Patient.Doctors,JSON_QUOTE(?))`, [rows[0].Clinic_ID, req.params.id]),
            query(`SELECT COUNT(*) AS total FROM Appointment WHERE Doctor_ID=? AND LOWER(COALESCE(Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished')`, [rows[0].ID]),
            query(`${DOCTOR_SELECT} WHERE Doctor.Clinic_ID=? AND Doctor.Blockchain_ID<>? AND User.IsActive=1 ORDER BY User.Last_Name,User.First_Name`, [rows[0].Clinic_ID, req.params.id]),
        ]);
        return res.json({ success:true, data:{ doctorID:req.params.id, assignedPatients:patients.map(normalizePatient), activeAppointments:Number(appointments[0]?.total||0), replacementDoctors:replacements.map(normalizeDoctor), cancellationAllowed:replacements.length===0 }, message: replacements.length ? 'Select an active replacement doctor from the same clinic' : 'No replacement doctor remains; active appointments will be cancelled' });
    } catch (error) { return sendApiError(res,error.statusCode||500,error.code||'DOCTOR_DEACTIVATION_IMPACT_FAILED',error.message); }
});

app.delete('/doctors/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection; let operationID;
    try { connection = await db.promise().getConnection(); await connection.beginTransaction(); const [rows] = await connection.query(`${DOCTOR_SELECT} WHERE Doctor.Blockchain_ID=? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Doctor not found'); error.statusCode = 404; throw error; } requireAdminClinic(req, rows[0].Clinic_ID);
        if (!rows[0].IsActive) { await connection.rollback(); return res.json({ success:true, data:{ doctorID:req.params.id, deactivated:true, alreadyInactive:true, idempotent:true }, message:'Doctor is already inactive; no lifecycle changes were repeated' }); }
        const [assigned] = await connection.query(`${PATIENT_SELECT} WHERE Patient.Clinic_ID=? AND User.IsActive=1 AND JSON_CONTAINS(Patient.Doctors,JSON_QUOTE(?)) FOR UPDATE`, [rows[0].Clinic_ID, req.params.id]);
        const [replacementRows] = await connection.query(`${DOCTOR_SELECT} WHERE Doctor.Clinic_ID=? AND Doctor.Blockchain_ID<>? AND User.IsActive=1`, [rows[0].Clinic_ID, req.params.id]);
        const replacementDoctorID = req.body?.replacementDoctorID ? String(req.body.replacementDoctorID) : null;
        if (replacementRows.length && !replacementDoctorID) throw Object.assign(new Error('Select an active replacement doctor from the same clinic'), { statusCode:409, code:'DOCTOR_REASSIGNMENT_REQUIRED' });
        const replacement = replacementDoctorID ? replacementRows.find((doctor) => String(doctor.Blockchain_ID)===replacementDoctorID) : null;
        if (replacementDoctorID && !replacement) throw Object.assign(new Error('Replacement doctor must be active and belong to the same clinic'), { statusCode:400, code:'INVALID_REPLACEMENT_DOCTOR' });
        if (!replacementRows.length && replacementDoctorID) throw Object.assign(new Error('No replacement doctor is available; appointments must be cancelled'), { statusCode:400, code:'DOCTOR_CANCELLATION_REQUIRED' });
        operationID = await beginLifecycleOperation(req, 'DOCTOR_DEACTIVATE', 'doctor', req.params.id, rows[0].Clinic_ID, { replacementDoctorID });
        for (const patientRow of assigned) {
            const patient = normalizePatient(patientRow);
            const doctors = [...new Set(patient.doctors.filter((id) => String(id)!==String(req.params.id)).concat(replacement ? [replacementDoctorID] : []))];
            const updated = { ...patient, doctors };
            const dataHash = patientHash(updated);
            await callBlockchain(req, '/unassignPatientFromDoctor', 'POST', { patientID:patient.patientID, doctorID:req.params.id, dataHash, modifiedDate:new Date().toISOString() });
            if (replacement) await callBlockchain(req, '/assignPatientToDoctor', 'POST', { patientID:patient.patientID, doctorID:replacementDoctorID, dataHash, modifiedDate:new Date().toISOString() });
            await callBlockchain(req, `/patient-metadata/${encodeURIComponent(patient.patientID)}`, 'PUT', { clinicID:Number(rows[0].Clinic_ID), doctors, offChainRef:`mysql:Patient/${patientRow.ID}`, dataHash });
            await connection.query('UPDATE Patient SET Doctors=?,Modified_Date=NOW() WHERE ID=?',[JSON.stringify(doctors),patientRow.ID]);
        }
        let appointmentsAffected;
        if (replacement) {
            [appointmentsAffected] = await connection.query(`UPDATE Appointment SET Doctor_ID=?,Specialty=?,Notes=CONCAT_WS('\n',NULLIF(Notes,''),?),Modified_Date=NOW() WHERE Doctor_ID=? AND LOWER(COALESCE(Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished')`, [replacement.ID,replacement.Specialty,`Reassigned from ${req.params.id} during doctor deactivation.`,rows[0].ID]);
        } else {
            [appointmentsAffected] = await connection.query(`UPDATE Appointment SET Status='cancelled',Notes=CONCAT_WS('\n',NULLIF(Notes,''),?),Cancelled_Date=COALESCE(Cancelled_Date,NOW()),Modified_Date=NOW() WHERE Doctor_ID=? AND LOWER(COALESCE(Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished')`, [`Automatically cancelled because ${req.params.id} was deactivated and no replacement doctor remained.`,rows[0].ID]);
        }
        await callBlockchain(req, `/doctor/${encodeURIComponent(req.params.id)}`, 'DELETE');
        await retireFabricIdentity(req, 'doctor', req.params.id, rows[0].Clinic_ID);
        await markLifecycleOperation(operationID, 'FABRIC_COMMITTED', 'ACTOR_DEACTIVATED_AND_IDENTITY_RETIRED');
        await connection.query(`UPDATE User SET IsActive=0,Security_Version=Security_Version+1,
            Sessions_Invalid_Before=NOW(3) WHERE ID=?`, [rows[0].ID]);
        await connection.query("UPDATE Push_Subscription SET Active=0,Updated_At=NOW(),Last_Error='doctor deactivated' WHERE Recipient_Role='doctor' AND Recipient_ID=?", [req.params.id]);
        await revokeManagedAdminSessions(connection, rows[0].ID, 'doctor deactivated');
        await connection.commit();
        await markLifecycleOperation(operationID, 'COMPLETED', 'MYSQL_DEACTIVATED');
        return res.json({ success:true, data:{ doctorID:req.params.id, deactivated:true, replacementDoctorID, patientsReassigned:assigned.length, appointments:{ action:replacement?'reassigned':'cancelled', count:appointmentsAffected.affectedRows } }, message:replacement?'Doctor deactivated; patients and active appointments reassigned; history preserved':'Doctor deactivated; active appointments cancelled because no replacement remained; history preserved' });
    } catch (error) { if (connection) await connection.rollback().catch(()=>{}); await markLifecycleOperation(operationID, 'FAILED', 'DOCTOR_DEACTIVATE_FAILED', error).catch(()=>{}); return sendApiError(res,error.statusCode||500,error.code||'DOCTOR_DEACTIVATE_FAILED',error.message); }
    finally { if (connection) connection.release(); }
});

const PATIENT_SELECT = `
    SELECT Patient.*, User.First_Name, User.Last_Name, User.Email, User.Contact_Number, User.Created_Date, User.IsActive
    FROM Patient INNER JOIN User ON Patient.ID = User.ID`;

const validatePatientPayload = (body, isCreate = false) => {
    const required = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'contactNumber', 'email', 'emiratesID',
        'nationality', 'address', 'bloodType', 'medicalHistory', 'allergies', 'medications', 'insuranceDetails', 'clinicID'];
    if (isCreate) required.push('password');
    const missing = required.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
    if (missing.length) {
        const error = new Error(`Missing required fields: ${missing.join(', ')}`);
        error.statusCode = 400;
        throw error;
    }
    validatePersonNames(body, 'Patient', 'PATIENT_NAME_TOO_LONG'); validateEmail(body.email); validateContactNumber(body.contactNumber); validateEmiratesID(body.emiratesID);
    requireTextLimit(body.nationality, 'Nationality', 100, 'PATIENT_NATIONALITY_TOO_LONG');
    requireTextLimit(body.address, 'Address', 1000, 'PATIENT_ADDRESS_TOO_LONG');
    if (!['male', 'female', 'other', 'prefer not to say'].includes(String(body.gender).trim().toLowerCase())) throw validationError('INVALID_GENDER', 'Gender must be Male, Female, Other, or Prefer not to say');
    if (!/^(A|B|AB|O)[+-]$/.test(body.bloodType)) {
        const error = new Error('Invalid blood type'); error.statusCode = 400; throw error;
    }
    const dob = new Date(body.dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob >= new Date()) {
        const error = new Error('Date of birth must be a valid past date'); error.statusCode = 400; throw error;
    }
    if (!Array.isArray(body.doctors || [])) {
        const error = new Error('doctors must be an array'); error.statusCode = 400; throw error;
    }
};

// Coordinated hybrid patient creation: MySQL is authoritative for PII; Fabric stores reference/hash only.
app.post('/patients', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection; let operationID;
    try {
        const clinicID = Number(req.user.organizationId);
        if (!clinicID) throw Object.assign(new Error('Authenticated admin has no clinic'), { statusCode: 403, code: 'ADMIN_CLINIC_REQUIRED' });
        if (req.body.clinicID !== undefined) requireAdminClinic(req, req.body.clinicID);
        const createBody = { ...req.body, clinicID };
        validatePatientPayload(createBody, true);
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [duplicates] = await connection.query(
            'SELECT Patient.ID FROM Patient INNER JOIN User ON Patient.ID = User.ID WHERE Patient.Emirates_ID = ? OR User.Email = ? LIMIT 1',
            [createBody.emiratesID, createBody.email]
        );
        if (duplicates.length) { const error = new Error('Patient email or Emirates ID already exists'); error.statusCode = 409; throw error; }
        const requestedDoctors = [...new Set((createBody.doctors || []).map(String))];
        if (requestedDoctors.length) {
            const placeholders = requestedDoctors.map(() => '?').join(',');
            const [doctorRows] = await connection.query(
                `SELECT Doctor.Blockchain_ID FROM Doctor JOIN User ON User.ID=Doctor.ID
                 WHERE Doctor.Blockchain_ID IN (${placeholders}) AND Doctor.Clinic_ID=? AND User.IsActive=1`,
                [...requestedDoctors, clinicID],
            );
            if (doctorRows.length !== requestedDoctors.length) {
                const error = new Error('Every assigned doctor must be active and belong to the patient clinic'); error.statusCode = 400; throw error;
            }
        }

        const passwordHash = await bcrypt.hash(createBody.password, 10);
        const [userResult] = await connection.query(
            'INSERT INTO User (First_Name, Last_Name, Password, Email, Contact_Number, Role_ID, Created_Date, IsActive) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)',
            [createBody.firstName, createBody.lastName, passwordHash, createBody.email, createBody.contactNumber, PATIENT_ROLE_ID]
        );
        const patientID = `Patient-${crypto.randomUUID()}`;
        operationID = await beginLifecycleOperation(req, 'PATIENT_CREATE', 'patient', patientID, clinicID, createBody);
        await connection.query(`INSERT INTO Patient
            (ID, Date_of_Birth, Gender, Emirates_ID, Blockchain_ID, Nationality, Address, Blood_Type, Medical_History, Allergies, Medications, Insurance_Details, Clinic_ID, Doctors, Modified_Date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [
            userResult.insertId, createBody.dateOfBirth, createBody.gender, createBody.emiratesID, patientID, createBody.nationality,
            createBody.address, createBody.bloodType, JSON.stringify(createBody.medicalHistory), JSON.stringify(createBody.allergies),
            JSON.stringify(createBody.medications), JSON.stringify(createBody.insuranceDetails), clinicID,
            JSON.stringify(requestedDoctors)
        ]);
        await connection.query(`INSERT INTO Patient_Clinic_Association (Patient_ID,Clinic_ID,Association_Status)
            VALUES (?,?,'current') ON DUPLICATE KEY UPDATE Association_Status='current',Transferred_At=NULL`, [userResult.insertId, clinicID]);
        const patient = { ...createBody, doctors: requestedDoctors, patientID, password: undefined };
        const dataHash = patientHash(patient);
        await provisionFabricIdentity(req, 'patient', patientID, clinicID);
        await callBlockchain(req, '/patient-metadata', 'POST', {
            patientID, clinicID, doctors: requestedDoctors,
            offChainRef: `mysql:Patient/${userResult.insertId}`, dataHash
        });
        for (const doctorID of requestedDoctors) {
            await callBlockchain(req, '/assignPatientToDoctor', 'POST', {
                patientID,
                doctorID,
                dataHash,
                modifiedDate: new Date().toISOString(),
            });
        }
        await markLifecycleOperation(operationID, 'FABRIC_COMMITTED', 'PATIENT_LEDGER_CREATED');
        await connection.commit();
        await markLifecycleOperation(operationID, 'COMPLETED', 'MYSQL_COMMITTED');
        return res.status(201).json({ success: true, data: { ...patient, dataHash }, message: 'Patient created in MySQL and referenced on-chain' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        await markLifecycleOperation(operationID, 'FAILED', 'PATIENT_CREATE_FAILED', error).catch(() => {});
        const status = error.statusCode || (error.code === 'ER_DUP_ENTRY' ? 409 : 500);
        return sendApiError(res, status, error.code || 'PATIENT_CREATE_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.get('/patients', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const operationalOnly = String(req.query.operationalOnly || '').toLowerCase() === 'true';
        const rows = await query(`${PATIENT_SELECT}
            JOIN Patient_Clinic_Association PCA ON PCA.Patient_ID=Patient.ID AND PCA.Clinic_ID=?
            WHERE User.IsActive=1 ${operationalOnly ? "AND PCA.Association_Status='current' AND Patient.Clinic_ID=?" : ''}
            ORDER BY User.Last_Name, User.First_Name`, operationalOnly ? [req.user.organizationId,req.user.organizationId] : [req.user.organizationId]);
        rows.forEach((row) => { row.Association_Status = Number(row.Clinic_ID) === Number(req.user.organizationId) ? 'current' : 'transferred'; });
        return res.json({ success: true, data: rows.map(normalizePatient) });
    } catch (error) { return sendApiError(res, 500, 'PATIENT_LIST_FAILED', 'Unable to retrieve patients'); }
});

app.get('/doctor/me/assigned-patients', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        if (!req.user.blockchainID) return sendApiError(res, 403, 'DOCTOR_IDENTITY_REQUIRED', 'Authenticated doctor has no blockchain identity');
        // Revalidate the JWT-to-certificate actor binding before returning authoritative MySQL PII.
        await callBlockchain(req, '/doctor/me/assigned-patients', 'GET');
        const rows = await query(`${PATIENT_SELECT} WHERE JSON_CONTAINS(Patient.Doctors, JSON_QUOTE(?)) AND User.IsActive=1
            ORDER BY User.Last_Name, User.First_Name`, [String(req.user.blockchainID)]);
        return res.json({ success: true, data: rows.map(normalizePatient) });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'ASSIGNED_PATIENT_LIST_FAILED', error.message); }
});

app.get('/patients/:id', authenticateToken, requireRoles('admin', 'doctor', 'patient'), async (req, res) => {
    try {
        const rows = await query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID = ? AND User.IsActive=1 LIMIT 1`, [req.params.id]);
        if (!rows.length) return sendApiError(res, 404, 'PATIENT_NOT_FOUND', 'Patient not found');
        const patient = normalizePatient(rows[0]);
        if (normalizeRole(req.user.role) === 'patient' && req.user.blockchainID !== req.params.id) {
            return sendApiError(res, 403, 'PATIENT_OWNER_MISMATCH', 'Patients may retrieve only their own profile');
        }
        if (normalizeRole(req.user.role) === 'admin' && Number(req.user.organizationId) !== Number(patient.clinicID)) {
            const associations = await query('SELECT Association_Status FROM Patient_Clinic_Association WHERE Patient_ID=? AND Clinic_ID=? LIMIT 1', [rows[0].ID, req.user.organizationId]);
            if (!associations.length) return sendApiError(res, 403, 'PATIENT_CLINIC_SCOPE_DENIED', 'Patient has no association with the authenticated clinic');
            patient.associationStatus = 'transferred'; patient.operationalAccess = false;
        }
        if (normalizeRole(req.user.role) === 'doctor') {
            if (!req.user.blockchainID || !patient.doctors.includes(String(req.user.blockchainID))) {
                return sendApiError(res, 403, 'PATIENT_ASSIGNMENT_REQUIRED', 'Doctors may retrieve only patients assigned to them');
            }
        }
        return res.json({ success: true, data: patient });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'PATIENT_READ_FAILED', error.message); }
});

app.put('/patients/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection;
    try {
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID = ? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Patient not found'); error.statusCode = 404; throw error; }
        const current = normalizePatient(rows[0]); requireAdminClinic(req, current.clinicID);
        if (req.body.patientID !== undefined && String(req.body.patientID) !== String(req.params.id)) {
            throw Object.assign(new Error('patientID is immutable and must match the URL'), { statusCode: 400, code: 'PATIENT_ID_MISMATCH' });
        }
        if (req.body.clinicID !== undefined && Number(req.body.clinicID) !== Number(current.clinicID)) {
            throw Object.assign(new Error('Patient clinic requires a dedicated transfer workflow'), { statusCode: 403, code: 'PATIENT_CLINIC_IMMUTABLE' });
        }
        if (req.body.doctors !== undefined || (req.body.password !== undefined && String(req.body.password) !== '')) {
            throw Object.assign(new Error('Assignments and credentials require their dedicated security workflow'), { statusCode: 400, code: 'PATIENT_PROTECTED_FIELD' });
        }
        const update = mutablePatientProfile(req.body);
        validatePatientPayload({ ...update, clinicID: current.clinicID, doctors: current.doctors });
        await connection.query('UPDATE User SET First_Name=?, Last_Name=?, Email=?, Contact_Number=? WHERE ID=?',
            [update.firstName, update.lastName, update.email, update.contactNumber, rows[0].ID]);
        await connection.query(`UPDATE Patient SET Date_of_Birth=?, Gender=?, Emirates_ID=?, Nationality=?, Address=?, Blood_Type=?,
            Medical_History=?, Allergies=?, Medications=?, Insurance_Details=?, Modified_Date=NOW() WHERE ID=?`, [
            update.dateOfBirth, update.gender, update.emiratesID, update.nationality, update.address, update.bloodType,
            JSON.stringify(update.medicalHistory), JSON.stringify(update.allergies), JSON.stringify(update.medications),
            JSON.stringify(update.insuranceDetails), rows[0].ID
        ]);
        const patient = { ...current, ...update, patientID: req.params.id };
        const dataHash = patientHash(patient);
        await callBlockchain(req, `/patient-metadata/${encodeURIComponent(req.params.id)}`, 'PUT', {
            clinicID: Number(current.clinicID), doctors: current.doctors, offChainRef: `mysql:Patient/${rows[0].ID}`, dataHash
        });
        await connection.commit();
        return res.json({ success: true, data: { ...patient, dataHash }, message: 'Patient updated consistently' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || (error.code === 'ER_DUP_ENTRY' ? 409 : 500), error.code || 'PATIENT_UPDATE_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.post('/patients/:id/assign', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection; let operationID;
    try {
        if (!req.body.doctorID) return sendApiError(res, 400, 'VALIDATION_ERROR', 'doctorID is required');
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID = ? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Patient not found'); error.statusCode = 404; throw error; }
        const current = normalizePatient(rows[0]); requireAdminClinic(req, current.clinicID);
        const [doctorRows] = await connection.query(`SELECT Doctor.Blockchain_ID, Doctor.Clinic_ID FROM Doctor
            JOIN User ON User.ID=Doctor.ID WHERE Doctor.Blockchain_ID=? AND User.IsActive=1 FOR UPDATE`, [req.body.doctorID]);
        if (!doctorRows.length) { const error = new Error('Doctor not found'); error.statusCode = 404; throw error; }
        requireAdminClinic(req, doctorRows[0].Clinic_ID);
        if (Number(doctorRows[0].Clinic_ID) !== Number(current.clinicID)) {
            const error = new Error('Doctor and patient must belong to the same clinic');
            error.statusCode = 403;
            throw error;
        }
        const requestedDoctorID = String(req.body.doctorID);
        if ((current.doctors || []).map(String).includes(requestedDoctorID)) {
            const dataHash = patientHash(current);
            await callBlockchain(req, '/assignPatientToDoctor', 'POST', {
                patientID: req.params.id,
                doctorID: requestedDoctorID,
                dataHash,
                modifiedDate: new Date().toISOString(),
            });
            await connection.commit();
            return res.json({
                success: true,
                data: { patientID: req.params.id, doctors: current.doctors, alreadyAssigned: true, idempotent: true },
                message: `Patient is already assigned to doctor ${requestedDoctorID}; no duplicate was created`,
            });
        }
        const doctors = [...new Set([...(current.doctors || []), String(req.body.doctorID)])];
        operationID = await beginLifecycleOperation(req, 'PATIENT_ASSIGN', 'assignment', `${req.params.id}:${req.body.doctorID}`, current.clinicID, req.body);
        await connection.query('UPDATE Patient SET Doctors=?, Modified_Date=NOW() WHERE ID=?', [JSON.stringify(doctors), rows[0].ID]);
        const updated = { ...current, doctors };
        const dataHash = patientHash(updated);
        await callBlockchain(req, `/patient-metadata/${encodeURIComponent(req.params.id)}`, 'PUT', {
            clinicID: Number(current.clinicID),
            doctors,
            offChainRef: `mysql:Patient/${rows[0].ID}`,
            dataHash,
        });
        await callBlockchain(req, '/assignPatientToDoctor', 'POST', {
            patientID: req.params.id,
            doctorID: req.body.doctorID,
            dataHash,
            modifiedDate: new Date().toISOString(),
        });
        await markLifecycleOperation(operationID, 'FABRIC_COMMITTED', 'RELATIONSHIP_UPDATED');
        await connection.commit();
        await markLifecycleOperation(operationID, 'COMPLETED', 'MYSQL_COMMITTED');
        return res.json({ success: true, data: { patientID: req.params.id, doctors }, message: 'Patient assigned to doctor' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        await markLifecycleOperation(operationID, 'FAILED', 'PATIENT_ASSIGN_FAILED', error).catch(() => {});
        return sendApiError(res, error.statusCode || 500, 'PATIENT_ASSIGN_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.get('/patients/:id/deactivation-impact', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const rows = await query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID=? LIMIT 1`, [req.params.id]);
        if (!rows.length) return sendApiError(res, 404, 'PATIENT_NOT_FOUND', 'Patient not found');
        requireAdminClinic(req, rows[0].Clinic_ID);
        if (!rows[0].IsActive) return sendApiError(res, 409, 'PATIENT_ALREADY_INACTIVE', 'Patient is already inactive');
        const [appointmentRows, clinicalRows, labRows] = await Promise.all([
            query(`SELECT COUNT(*) AS total,
                SUM(CASE WHEN LOWER(COALESCE(Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished') THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN LOWER(COALESCE(Status,'scheduled')) IN ('completed','complete','done','finished') THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN LOWER(COALESCE(Status,'scheduled')) IN ('cancelled','canceled') THEN 1 ELSE 0 END) AS cancelled
                FROM Appointment WHERE Patient_ID=?`, [rows[0].ID]),
            query('SELECT COUNT(*) AS total FROM Clinical_Record WHERE Patient_Blockchain_ID=?', [req.params.id]),
            query('SELECT COUNT(*) AS total FROM Lab_Result WHERE Patient_Blockchain_ID=?', [req.params.id]),
        ]);
        const appointments = appointmentRows[0] || {};
        return res.json({ success: true, data: {
            patientID: req.params.id,
            assignedDoctors: normalizePatient(rows[0]).doctors.length,
            appointments: { total: Number(appointments.total || 0), activeToCancel: Number(appointments.active || 0), completedToPreserve: Number(appointments.completed || 0), cancelledToPreserve: Number(appointments.cancelled || 0) },
            clinicalRecordsToPreserve: Number(clinicalRows[0]?.total || 0),
            labResultsToPreserve: Number(labRows[0]?.total || 0),
        }, message: 'Deactivation preserves clinical history and cancels only non-terminal appointments' });
    } catch (error) { return sendApiError(res, error.statusCode || 500, error.code || 'PATIENT_DEACTIVATION_IMPACT_FAILED', error.message); }
});

app.delete('/patients/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection; let operationID;
    try {
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID = ? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Patient not found'); error.statusCode = 404; throw error; }
        requireAdminClinic(req, rows[0].Clinic_ID);
        if (!rows[0].IsActive) { await connection.rollback(); return res.json({ success:true, data:{ patientID:req.params.id, deactivated:true, alreadyInactive:true, idempotent:true }, message:'Patient is already inactive; no lifecycle changes were repeated' }); }
        operationID = await beginLifecycleOperation(req, 'PATIENT_DEACTIVATE', 'patient', req.params.id, rows[0].Clinic_ID, {});
        const [appointmentImpact] = await connection.query('SELECT Appointment_ID,Status FROM Appointment WHERE Patient_ID=? FOR UPDATE', [rows[0].ID]);
        const [clinicalImpact] = await connection.query('SELECT COUNT(*) AS total FROM Clinical_Record WHERE Patient_Blockchain_ID=?', [req.params.id]);
        const [labImpact] = await connection.query('SELECT COUNT(*) AS total FROM Lab_Result WHERE Patient_Blockchain_ID=?', [req.params.id]);
        await callBlockchain(req, `/patient-metadata/${encodeURIComponent(req.params.id)}`, 'DELETE');
        await retireFabricIdentity(req, 'patient', req.params.id, rows[0].Clinic_ID);
        await markLifecycleOperation(operationID, 'FABRIC_COMMITTED', 'ACTOR_DEACTIVATED_AND_IDENTITY_RETIRED');
        const [cancelledAppointments] = await connection.query(`UPDATE Appointment SET Status='cancelled',
            Notes=CONCAT_WS('\n',NULLIF(Notes,''),'Automatically cancelled because the patient was deactivated.'),
            Cancelled_Date=COALESCE(Cancelled_Date,NOW()),Modified_Date=NOW()
            WHERE Patient_ID=? AND LOWER(COALESCE(Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished')`, [rows[0].ID]);
        await connection.query('UPDATE Patient SET Doctors=JSON_ARRAY(),Modified_Date=NOW() WHERE ID=?', [rows[0].ID]);
        await connection.query(`UPDATE User SET IsActive=0,Security_Version=Security_Version+1,
            Sessions_Invalid_Before=NOW(3) WHERE ID=?`, [rows[0].ID]);
        await revokeManagedAdminSessions(connection, rows[0].ID, 'patient deactivated');
        await connection.commit();
        await markLifecycleOperation(operationID, 'COMPLETED', 'MYSQL_DEACTIVATED');
        return res.json({ success: true, data: { patientID: req.params.id, deactivated: true,
            appointments: { total: appointmentImpact.length, cancelled: cancelledAppointments.affectedRows },
            clinicalRecordsPreserved: Number(clinicalImpact[0]?.total || 0), labResultsPreserved: Number(labImpact[0]?.total || 0),
        }, message: 'Patient deactivated; active appointments cancelled; clinical, appointment, and ledger history preserved' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        await markLifecycleOperation(operationID, 'FAILED', 'PATIENT_DEACTIVATE_FAILED', error).catch(() => {});
        return sendApiError(res, error.statusCode || 500, 'PATIENT_DEACTIVATE_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.post(['/clinical-records', '/addMedicalRecord', '/addDentalChartEntry'], authenticateToken, requireRoles('doctor'), async (req, res) => {
    let connection;
    try {
        const recordType = req.path === '/addDentalChartEntry' ? 'dental' : (req.body.recordType || 'medical');
        const normalizedPayload = validateClinicalPayload(recordType, req.body.payload);
        if (!req.body.patientID) return sendApiError(res, 400, 'VALIDATION_ERROR', 'patientID is required');
        if (!req.user.blockchainID) return sendApiError(res, 403, 'DOCTOR_IDENTITY_REQUIRED', 'Authenticated doctor is missing a blockchain identity');
        if (req.body.doctorID !== undefined && String(req.body.doctorID) !== String(req.user.blockchainID)) {
            return sendApiError(res, 400, 'DOCTOR_ID_MISMATCH', 'doctorID is derived from the authenticated doctor and cannot be overridden');
        }
        const authorizedPatients = await query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID=? AND User.IsActive=1
            AND JSON_CONTAINS(Patient.Doctors,JSON_QUOTE(?)) LIMIT 1`, [req.body.patientID, String(req.user.blockchainID)]);
        if (!authorizedPatients.length) return sendApiError(res, 403, 'PATIENT_ASSIGNMENT_REQUIRED', 'Clinical records may be written only for an active assigned patient');
        const idempotencyKey = String(req.get('Idempotency-Key') || req.body.idempotencyKey || '').trim() || null;
        if (idempotencyKey && idempotencyKey.length > 128) return sendApiError(res, 400, 'IDEMPOTENCY_KEY_TOO_LONG', 'Idempotency key must not exceed 128 characters');
        const dataHash = clinicalHash(normalizedPayload);
        const recordID = idempotencyKey
            ? `Clinical-${crypto.createHash('sha256').update(`${req.user.blockchainID}:${req.body.patientID}:${recordType}:${idempotencyKey}`).digest('hex').slice(0, 48)}`
            : `Clinical-${crypto.randomUUID()}`;
        const createdAt = new Date().toISOString();
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [replay] = await connection.query('SELECT * FROM Clinical_Record WHERE Record_ID=? FOR UPDATE', [recordID]);
        if (replay.length) {
            if (String(replay[0].Data_Hash) !== dataHash) throw Object.assign(new Error('This idempotency key was already used for different clinical record content'), { statusCode:409, code:'IDEMPOTENCY_KEY_REUSED' });
            await connection.rollback();
            return res.json({ success:true, data:{ recordID, recordType:replay[0].Record_Type, patientID:replay[0].Patient_Blockchain_ID, payload:typeof replay[0].Payload==='string'?JSON.parse(replay[0].Payload):replay[0].Payload, dataHash:replay[0].Data_Hash, createdAt:replay[0].Created_Date }, alreadyProcessed:true, idempotent:true, message:'This clinical record request was already processed; the existing record was returned' });
        }
        await connection.query('INSERT INTO Clinical_Record (Record_ID, Patient_Blockchain_ID, Record_Type, Payload, Data_Hash, Created_By_Doctor_ID, Created_Date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [recordID, req.body.patientID, recordType, JSON.stringify(normalizedPayload), dataHash, req.user.blockchainID, createdAt.slice(0, 19).replace('T', ' ')]);
        await callBlockchain(req, '/clinical-record-metadata', 'POST', { recordID, recordType, patientID: req.body.patientID, offChainRef: `mysql:Clinical_Record/${recordID}`, dataHash, doctorID: req.user.blockchainID, createdAt });
        await connection.commit();
        return res.status(201).json({ success: true, data: { recordID, recordType, patientID: req.body.patientID, payload: normalizedPayload, dataHash, createdAt } });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, error.code || 'CLINICAL_RECORD_CREATE_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.get(['/patients/:id/clinical-records/:recordType', '/getMedicalRecords/:id', '/getDentalChartData/:id'], authenticateToken, requireRoles('doctor', 'patient'), async (req, res) => {
    try {
        const recordType = req.path.startsWith('/getDentalChartData') ? 'dental' : (req.params.recordType || 'medical');
        const clinicalResult = await callBlockchain(req, `/clinical-records/${encodeURIComponent(req.params.id)}/${recordType}?purpose=${encodeURIComponent(req.query.purpose || 'clinical care')}`, 'GET');
        const metadata = Array.isArray(clinicalResult) ? clinicalResult : clinicalResult.records || [];
        const accessEvidence = Array.isArray(clinicalResult) ? null : clinicalResult.accessLog || null;
        if (!metadata.length) return res.json({ success: true, data: [], accessEvidence });
        const ids = metadata.map((item) => item.recordID);
        const placeholders = ids.map(() => '?').join(',');
        const rows = await query(`SELECT * FROM Clinical_Record WHERE Record_ID IN (${placeholders}) ORDER BY Created_Date DESC`, ids);
        const byID = new Map(metadata.map((item) => [item.recordID, item]));
        const records = rows.map((row) => ({ ...byID.get(row.Record_ID), payload: typeof row.Payload === 'string' ? JSON.parse(row.Payload) : row.Payload, dataHash: row.Data_Hash, createdAt: row.Created_Date }));
        return res.json({ success: true, data: records, accessEvidence });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'CLINICAL_RECORD_READ_FAILED', error.message); }
});

app.get('/clinical-records/:recordID/verify-integrity', authenticateToken, requireRoles('doctor', 'patient'), async (req, res) => {
    const verificationID = crypto.randomUUID();
    const correlationID = req.get('x-correlation-id') || crypto.randomUUID();
    let audit = { recordID:req.params.recordID, currentHash:null, storedHash:null, onChainHash:null };
    try {
        const rows = await query('SELECT * FROM Clinical_Record WHERE Record_ID=? LIMIT 1', [req.params.recordID]);
        if (!rows.length) return sendApiError(res, 404, 'CLINICAL_RECORD_NOT_FOUND', 'Clinical record not found');
        const row = rows[0];
        const payload = typeof row.Payload === 'string' ? JSON.parse(row.Payload) : row.Payload;
        const currentHash = clinicalHash(payload);
        const ledgerResult = await callBlockchain(req,
            `/clinical-records/${encodeURIComponent(row.Patient_Blockchain_ID)}/${encodeURIComponent(row.Record_Type)}?purpose=${encodeURIComponent('clinical record integrity verification')}`, 'GET');
        const ledgerRecords = Array.isArray(ledgerResult) ? ledgerResult : (ledgerResult.records || []);
        const ledgerRecord = ledgerRecords.find((item) => String(item.recordID) === String(row.Record_ID));
        const storedHash = String(row.Data_Hash || '').toLowerCase();
        const onChainHash = String(ledgerRecord?.dataHash || '').toLowerCase() || null;
        const matches = Boolean(onChainHash) && currentHash === storedHash && currentHash === onChainHash;
        audit = { recordID:row.Record_ID, currentHash, storedHash, onChainHash };
        await query(`INSERT INTO Clinical_Record_Integrity_Log
            (Verification_ID,Record_ID,Actor_User_ID,Actor_Blockchain_ID,Actor_Role,Correlation_ID,
             Current_Hash,Stored_Hash,On_Chain_Hash,Result)
            VALUES (?,?,?,?,?,?,?,?,?,?)`, [verificationID, row.Record_ID, req.user.id, req.user.blockchainID || null,
            req.user.role, correlationID, currentHash, storedHash, onChainHash, matches ? 'VERIFIED' : 'MISMATCH']);
        console.info(JSON.stringify({ event:'CLINICAL_RECORD_INTEGRITY_VERIFICATION', verificationID,
            recordID:row.Record_ID, actorID:req.user.id, actorRole:req.user.role, correlationID,
            currentHash, storedHash, onChainHash, result:matches ? 'VERIFIED' : 'MISMATCH' }));
        return res.json({ success: true, data: {
            verificationID, correlationID, recordID: row.Record_ID, algorithm: 'SHA-256', status: matches ? 'verified' : 'mismatch', matches,
            currentHash, storedHash, onChainHash, verifiedAt: new Date().toISOString(),
        }, message: matches
            ? 'Clinical record integrity verified against the on-chain hash'
            : 'Clinical record integrity mismatch detected; the record remains visible for investigation' });
    } catch (error) {
        await query(`INSERT INTO Clinical_Record_Integrity_Log
            (Verification_ID,Record_ID,Actor_User_ID,Actor_Blockchain_ID,Actor_Role,Correlation_ID,
             Current_Hash,Stored_Hash,On_Chain_Hash,Result,Error_Code,Error_Message)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [verificationID, audit.recordID, req.user.id, req.user.blockchainID || null,
            req.user.role, correlationID, audit.currentHash, audit.storedHash, audit.onChainHash, 'ERROR',
            error.code || 'CLINICAL_RECORD_INTEGRITY_CHECK_FAILED', String(error.message || error).slice(0, 1000)]).catch((logError) => {
            console.error(JSON.stringify({ event:'CLINICAL_RECORD_INTEGRITY_AUDIT_WRITE_FAILED', verificationID,
                recordID:audit.recordID, correlationID, error:String(logError.message || logError).slice(0, 1000) }));
        });
        console.error(JSON.stringify({ event:'CLINICAL_RECORD_INTEGRITY_VERIFICATION', verificationID,
            recordID:audit.recordID, actorID:req.user.id, actorRole:req.user.role, correlationID,
            currentHash:audit.currentHash, storedHash:audit.storedHash, onChainHash:audit.onChainHash,
            result:'ERROR', errorCode:error.code || 'CLINICAL_RECORD_INTEGRITY_CHECK_FAILED' }));
        return sendApiError(res, error.statusCode || 500, 'CLINICAL_RECORD_INTEGRITY_CHECK_FAILED', error.message);
    }
});

app.get('/audit/clinical-record-integrity/:recordID', authenticateToken, requireRoles('admin', 'system'), async (req, res) => {
    try {
        const rows = await query(`SELECT Verification_ID AS verificationID,Record_ID AS recordID,
            Actor_User_ID AS actorUserID,Actor_Blockchain_ID AS actorBlockchainID,Actor_Role AS actorRole,
            Correlation_ID AS correlationID,Current_Hash AS currentHash,Stored_Hash AS storedHash,
            On_Chain_Hash AS onChainHash,Result AS result,Error_Code AS errorCode,
            Error_Message AS errorMessage,Verified_At AS verifiedAt
            FROM Clinical_Record_Integrity_Log WHERE Record_ID=? ORDER BY Verified_At DESC`, [req.params.recordID]);
        return res.json({ success:true, data:rows });
    } catch (error) { return sendApiError(res, 500, 'CLINICAL_RECORD_INTEGRITY_AUDIT_READ_FAILED', error.message); }
});

app.post('/patients/:id/unassign', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection; let operationID;
    try {
        if (!req.body.doctorID) return sendApiError(res, 400, 'VALIDATION_ERROR', 'doctorID is required');
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID=? FOR UPDATE`, [req.params.id]);
        if (!rows.length) throw Object.assign(new Error('Patient not found'), { statusCode: 404 });
        const current = normalizePatient(rows[0]); requireAdminClinic(req, current.clinicID);
        const [doctorRows] = await connection.query(`SELECT Doctor.Blockchain_ID,Doctor.Clinic_ID FROM Doctor
            JOIN User ON User.ID=Doctor.ID WHERE Doctor.Blockchain_ID=? FOR UPDATE`, [req.body.doctorID]);
        if (!doctorRows.length) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });
        requireAdminClinic(req, doctorRows[0].Clinic_ID);
        if (!current.doctors.includes(String(req.body.doctorID))) {
            await connection.rollback(); return res.json({ success: true, data: { patientID: req.params.id, doctors: current.doctors }, message: 'Patient was already unassigned' });
        }
        const doctors = current.doctors.filter((id) => String(id) !== String(req.body.doctorID));
        const updated = { ...current, doctors }; const dataHash = patientHash(updated);
        operationID = await beginLifecycleOperation(req, 'PATIENT_UNASSIGN', 'assignment', `${req.params.id}:${req.body.doctorID}`, current.clinicID, req.body);
        await connection.query('UPDATE Patient SET Doctors=?,Modified_Date=NOW() WHERE ID=?', [JSON.stringify(doctors), rows[0].ID]);
        await callBlockchain(req, '/unassignPatientFromDoctor', 'POST', {
            patientID: req.params.id, doctorID: req.body.doctorID, dataHash, modifiedDate: new Date().toISOString(),
        });
        await markLifecycleOperation(operationID, 'FABRIC_COMMITTED', 'RELATIONSHIP_REMOVED');
        await connection.commit();
        await markLifecycleOperation(operationID, 'COMPLETED', 'MYSQL_COMMITTED');
        return res.json({ success: true, data: { patientID: req.params.id, doctors }, message: 'Patient unassigned from doctor' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        await markLifecycleOperation(operationID, 'FAILED', 'PATIENT_UNASSIGN_FAILED', error).catch(() => {});
        return sendApiError(res, error.statusCode || 500, 'PATIENT_UNASSIGN_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

const relayBlockchainJson = async (req, res, path, method = 'GET', body) => {
    try {
        const response = await callBlockchainResponse(req, path, method, body);
        const payload = await response.json().catch(() => ({
            success: false,
            error: { code: 'BLOCKCHAIN_INVALID_RESPONSE', message: 'Blockchain service returned an invalid response' },
        }));
        return res.status(response.status).json(payload);
    } catch (error) {
        return sendApiError(res, error.statusCode || 503, 'BLOCKCHAIN_SERVICE_UNAVAILABLE', error.message);
    }
    for (const [field, values] of [['medicalHistory', body.medicalHistory], ['allergies', body.allergies], ['medications', body.medications]]) {
        if (!Array.isArray(values) || values.length > 50) throw validationError('PATIENT_LIST_INVALID', `${field} must contain at most 50 items`);
        values.forEach((value) => requireTextLimit(value, field, 500, 'PATIENT_LIST_ITEM_TOO_LONG'));
    }
    if (!body.insuranceDetails || typeof body.insuranceDetails !== 'object' || Array.isArray(body.insuranceDetails)) throw validationError('INVALID_INSURANCE_DETAILS', 'insuranceDetails must be an object');
    for (const [field, max] of [['provider', 255], ['policyNumber', 100], ['coverageType', 100]]) requireTextLimit(body.insuranceDetails[field], `Insurance ${field}`, max, 'INSURANCE_FIELD_TOO_LONG');
    if (isCreate && !validatePassword(body.password)) throw validationError('INVALID_PASSWORD', 'Temporary password must be 12 to 72 UTF-8 bytes and include uppercase, lowercase, number, and symbol');
};
const mutablePatientProfile = (body) => ({
    firstName: body.firstName, lastName: body.lastName, dateOfBirth: body.dateOfBirth,
    gender: body.gender, contactNumber: body.contactNumber, email: body.email,
    emiratesID: body.emiratesID, nationality: body.nationality, address: body.address,
    bloodType: body.bloodType, medicalHistory: body.medicalHistory, allergies: body.allergies,
    medications: body.medications, insuranceDetails: body.insuranceDetails,
});

// Public clients use only this application API. These facade routes sanitize
// actor scope before calling the private blockchain service.
app.get('/getRequestsForAdmin/:clinicID', authenticateToken, requireRoles('admin'), (req, res) =>
    relayBlockchainJson(req, res, `/getRequestsForAdmin/${encodeURIComponent(req.user.organizationId)}`));

app.post('/approveRequest', authenticateToken, requireRoles('admin'), (req, res) =>
    relayBlockchainJson(req, res, '/approveRequest', 'POST', {
        ...req.body,
        adminID: req.user.blockchainID || req.user.id,
        adminClinicID: req.user.organizationId,
    }));

app.post('/admin/rejectRequest', authenticateToken, requireRoles('admin'), (req, res) => {
    try {
        const rejectionReason = String(req.body.rejectionReason || '').trim();
        if (!rejectionReason) return sendApiError(res, 400, 'REJECTION_REASON_REQUIRED', 'A rejection reason is required');
        requireTextLimit(rejectionReason, 'Rejection reason', 1000, 'REJECTION_REASON_TOO_LONG');
        return relayBlockchainJson(req, res, '/admin/rejectRequest', 'POST', {
            ...req.body,
            rejectionReason,
            adminID: req.user.blockchainID || req.user.id,
            adminClinicID: req.user.organizationId,
        });
    } catch (error) {
        return sendApiError(res, error.statusCode || 400, error.code || 'INVALID_REJECTION_REASON', error.message);
    }
});

app.post(['/requestDataAccess', '/requestAccess'], authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        if (!req.user.blockchainID) return sendApiError(res, 403, 'DOCTOR_IDENTITY_REQUIRED', 'Authenticated doctor is missing a blockchain identity');
        const lookupType = String(req.body.patientLookupType || '').toLowerCase();
        const lookupValue = String(req.body.patientLookupValue || '').trim();
        if (!req.body.patientID && (!['email','phone','emiratesid'].includes(lookupType) || !lookupValue)) return sendApiError(res,400,'VALIDATION_ERROR','Enter the patient email, phone number, or Emirates ID');
        if (req.body.patientID && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(String(req.body.patientID))) return sendApiError(res,400,'INVALID_PATIENT_ID','Enter a valid Patient ID containing only letters, numbers, hyphens, or underscores');
        if (!req.body.dataType || !req.body.purpose) return sendApiError(res,400,'VALIDATION_ERROR','Data type and clinical purpose are required');
        requireTextLimit(req.body.dataType,'Data type',100,'DATA_TYPE_TOO_LONG');
        requireTextLimit(req.body.purpose,'Clinical purpose',500,'REQUEST_PURPOSE_TOO_LONG');
        requireTextLimit(req.body.notes,'Request notes',1000,'REQUEST_NOTES_TOO_LONG');
        requireTextLimit(lookupValue,'Patient lookup value',254,'PATIENT_LOOKUP_TOO_LONG');
        if (!req.body.patientID && lookupType === 'email') validateEmail(lookupValue);
        if (!req.body.patientID && lookupType === 'phone') validateContactNumber(lookupValue);
        if (!req.body.patientID && lookupType === 'emiratesid') validateEmiratesID(lookupValue);
        const rows = await query(`SELECT Patient.Blockchain_ID,Patient.Clinic_ID,Doctor.Clinic_ID AS Doctor_Clinic_ID
            FROM Patient JOIN User PatientUser ON PatientUser.ID=Patient.ID AND PatientUser.IsActive=1
            JOIN Organization ON Organization.Organization_ID=Patient.Clinic_ID AND Organization.IsActive=1
            JOIN Doctor ON Doctor.Blockchain_ID=? JOIN User DoctorUser ON DoctorUser.ID=Doctor.ID AND DoctorUser.IsActive=1
            WHERE ${req.body.patientID ? 'Patient.Blockchain_ID=?' : lookupType === 'email' ? 'LOWER(PatientUser.Email)=LOWER(?)' : lookupType === 'phone' ? 'PatientUser.Contact_Number=?' : 'Patient.Emirates_ID=?'} LIMIT 2`, [req.user.blockchainID,req.body.patientID || lookupValue]);
        if (rows.length !== 1) return sendApiError(res,404,'PATIENT_NOT_FOUND','No unique active patient matched the supplied details');
        if (Number(rows[0].Clinic_ID) === Number(rows[0].Doctor_Clinic_ID)) return sendApiError(res,409,'DATA_ACCESS_NOT_REQUIRED','This patient belongs to your clinic; use the normal assigned-patient workflow instead');
        const dataOriginClinicID = req.body.dataOriginClinicID === undefined || req.body.dataOriginClinicID === null || req.body.dataOriginClinicID === ''
            ? Number(rows[0].Clinic_ID) : Number(req.body.dataOriginClinicID);
        if (!Number.isSafeInteger(dataOriginClinicID) || dataOriginClinicID <= 0) return sendApiError(res,400,'INVALID_DATA_ORIGIN_CLINIC_ID','dataOriginClinicID must be a positive integer');
        return relayBlockchainJson(req, res, '/requestDataAccess', 'POST', {
            ...req.body, patientID:rows[0].Blockchain_ID, doctorID:req.user.blockchainID, dataOriginClinicID,
            patientLookupType:undefined, patientLookupValue:undefined,
        });
    } catch (error) { return sendApiError(res,error.statusCode||500,error.code||'DATA_ACCESS_REQUEST_FAILED',error.message); }
});

app.get('/referrals', authenticateToken, requireRoles('doctor'), (req, res) =>
    relayBlockchainJson(req, res, '/referrals'));

app.get('/getAllRequestsForPatient/:patientID', authenticateToken, requireRoles('patient'), (req, res) =>
    relayBlockchainJson(req, res, `/getAllRequestsForPatient/${encodeURIComponent(req.user.blockchainID)}`));

app.get(['/getPatientByID/:id', '/readPatient/:id'], authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, `/readPatient/${encodeURIComponent(req.params.id)}`));

app.post('/grantConsent', authenticateToken, requireRoles('patient'), (req, res) =>
    relayBlockchainJson(req, res, '/grantConsent', 'POST', { ...req.body, patientID: req.user.blockchainID }));

app.post('/patient/rejectRequest', authenticateToken, requireRoles('patient'), (req, res) =>
    relayBlockchainJson(req, res, '/patient/rejectRequest', 'POST', { ...req.body, patientID: req.user.blockchainID }));

app.post('/patient/revokeConsent', authenticateToken, requireRoles('patient'), (req, res) =>
    relayBlockchainJson(req, res, '/patient/revokeConsent', 'POST', { ...req.body, patientID: req.user.blockchainID }));

app.post('/referrals/:requestID/complete', authenticateToken, requireRoles('doctor'), (req, res) =>
    relayBlockchainJson(req, res, `/referrals/${encodeURIComponent(req.params.requestID)}/complete`, 'POST', req.body));

app.get(['/audit/clinical-access/:patientID', '/getAccessAuditLogs/:patientID'], authenticateToken, requireRoles('admin', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, `/audit/clinical-access/${encodeURIComponent(req.params.patientID)}`));

app.get('/notifications', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) => {
    const status = req.query.status ? `?status=${encodeURIComponent(req.query.status)}` : '';
    return relayBlockchainJson(req, res, `/notifications${status}`);
});

app.post('/notifications/:notificationID/read', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, `/notifications/${encodeURIComponent(req.params.notificationID)}/read`, 'POST', req.body));

app.get('/push/config', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, '/push/config'));
app.get('/push/subscriptions', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, '/push/subscriptions'));
app.post('/push/subscriptions', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, '/push/subscriptions', 'POST', req.body));
app.delete('/push/subscriptions', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, '/push/subscriptions', 'DELETE', req.body));
app.delete('/push/subscriptions/:subscriptionID', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, `/push/subscriptions/${encodeURIComponent(req.params.subscriptionID)}`, 'DELETE'));

app.get('/patients/:patientID/radiographic-files', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, `/patients/${encodeURIComponent(req.params.patientID)}/radiographic-files`));

app.get('/radiographic-files/:fileID/verify-integrity', authenticateToken, requireRoles('admin', 'doctor', 'patient'), (req, res) =>
    relayBlockchainJson(req, res, `/radiographic-files/${encodeURIComponent(req.params.fileID)}/verify-integrity`));

app.post('/radiographic-files', authenticateToken, requireRoles('doctor'),
    express.raw({ type: 'application/octet-stream', limit: Number(process.env.RADIOGRAPHIC_MAX_FILE_BYTES || 536870912) }),
    async (req, res) => {
        try {
            const patientID = String(req.get('x-patient-id') || '');
            if (!patientID) return sendApiError(res, 400, 'PATIENT_REQUIRED', 'x-patient-id is required');
            const fileValidation = validateRadiographicFile({
                bytes: req.body,
                fileName: req.get('x-file-name'),
                mediaType: req.get('x-file-media-type'),
            });
            if (!fileValidation.valid) return sendApiError(res, 415, fileValidation.code || 'UNSUPPORTED_RADIOGRAPHIC_FILE_TYPE', fileValidation.reason);
            const authorizedPatients = await query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID=? AND User.IsActive=1
                AND JSON_CONTAINS(Patient.Doctors,JSON_QUOTE(?)) LIMIT 1`, [patientID, String(req.user.blockchainID || '')]);
            if (!authorizedPatients.length) return sendApiError(res, 403, 'PATIENT_ASSIGNMENT_REQUIRED', 'Radiographic files may be uploaded only for an active assigned patient');
            const response = await callBlockchainResponse(req, '/radiographic-files', 'POST', req.body, 'application/octet-stream', {
                'x-patient-id': patientID,
                'x-file-name': req.get('x-file-name') || '',
                'x-file-media-type': fileValidation.mediaType,
                'idempotency-key': req.get('Idempotency-Key') || '',
            });
            const payload = await response.json().catch(() => ({}));
            return res.status(response.status).json(payload);
        } catch (error) {
            return sendApiError(res, error.statusCode || 503, 'BLOCKCHAIN_SERVICE_UNAVAILABLE', error.message);
        }
    });

app.get('/radiographic-files/:fileID/content', authenticateToken, requireRoles('doctor', 'patient'), async (req, res) => {
    try {
        const query = req.query.purpose ? `?purpose=${encodeURIComponent(req.query.purpose)}` : '';
        const response = await callBlockchainResponse(
            req,
            `/radiographic-files/${encodeURIComponent(req.params.fileID)}/content${query}`,
            'GET',
            undefined,
            null,
        );
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            return res.status(response.status).json(payload);
        }
        res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        res.set('Content-Disposition', response.headers.get('content-disposition') || 'inline');
        if (response.headers.get('x-access-transaction-id')) res.set('X-Access-Transaction-ID', response.headers.get('x-access-transaction-id'));
        return res.send(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        return sendApiError(res, error.statusCode || 503, 'BLOCKCHAIN_SERVICE_UNAVAILABLE', error.message);
    }
});

const APPOINTMENT_SELECT = `SELECT Appointment.Appointment_ID, Appointment.Meeting_For,
    COALESCE(Appointment.Appointment_Date_Time, Appointment.Date) AS Appointment_Date_Time,
    Appointment.Appointment_End_Date_Time, Appointment.Duration_Minutes,
    Appointment.Date, Appointment.Specialty, Appointment.Status, Appointment.Notes,
    Doctor.Blockchain_ID AS Doctor_ID, Patient.Blockchain_ID AS Patient_ID,
    CONCAT(DoctorUser.First_Name, ' ', DoctorUser.Last_Name) AS Doctor_Name,
    CONCAT(PatientUser.First_Name, ' ', PatientUser.Last_Name) AS Patient_Name
    FROM Appointment
    INNER JOIN Doctor ON Appointment.Doctor_ID = Doctor.ID
    INNER JOIN User DoctorUser ON Doctor.ID = DoctorUser.ID
    INNER JOIN Patient ON Appointment.Patient_ID = Patient.ID
    INNER JOIN User PatientUser ON Patient.ID = PatientUser.ID`;

const appointmentDurationBounds = { min: 30, max: 480 };
const configuredAppointmentDuration = async (runQuery = query) => {
    const environmentDefault = Number(process.env.APPOINTMENT_DEFAULT_DURATION_MINUTES || 30);
    const safeEnvironmentDefault = Number.isInteger(environmentDefault) && environmentDefault >= appointmentDurationBounds.min && environmentDefault <= appointmentDurationBounds.max ? environmentDefault : 30;
    const rows = await runQuery("SELECT Configuration_Value FROM System_Configuration WHERE Configuration_Key='appointment.defaultDurationMinutes' LIMIT 1");
    const databaseDefault = Number(rows[0]?.Configuration_Value);
    return Number.isInteger(databaseDefault) && databaseDefault >= appointmentDurationBounds.min && databaseDefault <= appointmentDurationBounds.max ? databaseDefault : safeEnvironmentDefault;
};

const resolveAppointmentDuration = async (requestedDuration, runQuery = query) => {
    const duration = requestedDuration === undefined || requestedDuration === null || requestedDuration === ''
        ? await configuredAppointmentDuration(runQuery) : Number(requestedDuration);
    if (!Number.isInteger(duration) || duration < appointmentDurationBounds.min || duration > appointmentDurationBounds.max) {
        throw validationError('INVALID_APPOINTMENT_DURATION', `Appointment duration must be a whole number between ${appointmentDurationBounds.min} and ${appointmentDurationBounds.max} minutes`);
    }
    return duration;
};

app.get('/appointment-options/doctors', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const rows = await query(`${DOCTOR_SELECT} WHERE ${CLINIC_DOCTOR_SCOPE} AND User.IsActive=1 ORDER BY User.Last_Name,User.First_Name`,
            [req.user.organizationId, req.user.organizationId]);
        return res.json({ success: true, data: rows.map(normalizeDoctor) });
    } catch (error) { return sendApiError(res, 500, 'APPOINTMENT_DOCTOR_OPTIONS_FAILED', 'Unable to retrieve clinic appointment doctors'); }
});

const listAppointments = async (req, res) => {
    try {
        const role = normalizeRole(req.user.role);
        let whereClause;
        let params;
        if (role === 'admin') {
            whereClause = 'Patient.Clinic_ID = ?';
            params = [req.user.organizationId];
        } else if (role === 'doctor') {
            if (!req.user.blockchainID) return sendApiError(res, 403, 'DOCTOR_IDENTITY_REQUIRED', 'Authenticated doctor has no blockchain identity');
            whereClause = 'Doctor.Blockchain_ID = ?';
            params = [req.user.blockchainID];
        } else {
            if (!req.user.blockchainID) return sendApiError(res, 403, 'PATIENT_IDENTITY_REQUIRED', 'Authenticated patient has no blockchain identity');
            whereClause = 'Patient.Blockchain_ID = ?';
            params = [req.user.blockchainID];
        }
        const period = String(req.query.period || '').toLowerCase();
        if (role !== 'patient' && period) return sendApiError(res, 400, 'INVALID_PERIOD', 'period is supported only for patient appointment history');
        if (role === 'patient' && period === 'upcoming') whereClause += " AND Appointment.Status <> 'cancelled' AND COALESCE(Appointment.Appointment_Date_Time, Appointment.Date) >= NOW()";
        if (role === 'patient' && period === 'past') whereClause += " AND (Appointment.Status = 'cancelled' OR COALESCE(Appointment.Appointment_Date_Time, Appointment.Date) < NOW())";
        if (role === 'patient' && period && !['upcoming', 'past'].includes(period)) return sendApiError(res, 400, 'INVALID_PERIOD', 'period must be upcoming or past');
        const rows = await query(`${APPOINTMENT_SELECT} WHERE ${whereClause}
            ORDER BY Appointment.Specialty, COALESCE(Appointment.Appointment_Date_Time, Appointment.Date)`, params);
        return res.json({ success: true, data: rows });
    } catch (error) { return sendApiError(res, 500, 'APPOINTMENT_LIST_FAILED', 'Unable to retrieve appointments'); }
};

app.get('/appointments', authenticateToken, requireRoles('admin', 'doctor', 'patient'), listAppointments);

app.post('/appointments', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection; let scheduleLock = false;
    try {
        const { patientID, doctorID, appointmentDateTime, specialty, meetingFor, notes, durationMinutes } = req.body;
        const idempotencyKey = String(req.get('Idempotency-Key') || req.body.idempotencyKey || '').trim() || null;
        if (idempotencyKey && idempotencyKey.length > 128) return sendApiError(res, 400, 'IDEMPOTENCY_KEY_TOO_LONG', 'Idempotency key must not exceed 128 characters');
        const storedIdempotencyKey = idempotencyKey ? crypto.createHash('sha256').update(`${req.user.organizationId}:${req.user.id}:${idempotencyKey}`).digest('hex') : null;
        if (![patientID, doctorID, appointmentDateTime, meetingFor].every(Boolean)) return sendApiError(res, 400, 'VALIDATION_ERROR', 'patientID, doctorID, appointmentDateTime, and meetingFor are required');
        requireTextLimit(meetingFor, 'Appointment reason', 255, 'APPOINTMENT_REASON_TOO_LONG');
        requireTextLimit(notes, 'Appointment notes', 2000, 'APPOINTMENT_NOTES_TOO_LONG');
        const scheduledAt = new Date(appointmentDateTime);
        if (req.body.appointmentDateTime !== undefined && (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) throw validationError('INVALID_APPOINTMENT_DATE', 'Appointment date and time must be valid and in the future');
        connection = await db.promise().getConnection();
        const runQuery = async (sql, params = []) => (await connection.query(sql, params))[0];
        const lockRows = await runQuery("SELECT GET_LOCK('edr:appointment-schedule',5) AS Acquired");
        if (Number(lockRows[0]?.Acquired) !== 1) throw Object.assign(new Error('Appointment scheduling is busy; please retry'), { statusCode:503, code:'APPOINTMENT_SCHEDULE_BUSY' });
        scheduleLock = true;
        const resolvedDuration = await resolveAppointmentDuration(durationMinutes, runQuery);
        const scheduledEnd = new Date(scheduledAt.getTime() + resolvedDuration * 60 * 1000);
        const rows = await runQuery(`SELECT Patient.ID AS Patient_DB_ID, Patient.Clinic_ID AS Patient_Clinic_ID, Patient.Doctors AS Patient_Doctors,
            Doctor.ID AS Doctor_DB_ID, Doctor.Clinic_ID AS Doctor_Clinic_ID, Doctor.Specialty AS Doctor_Specialty
            FROM Patient JOIN User PatientUser ON PatientUser.ID=Patient.ID
            JOIN Doctor ON Doctor.Blockchain_ID=? JOIN User DoctorUser ON DoctorUser.ID=Doctor.ID
            WHERE Patient.Blockchain_ID=? AND PatientUser.IsActive=1 AND DoctorUser.IsActive=1 LIMIT 1`, [doctorID, patientID]);
        if (!rows.length) return sendApiError(res, 404, 'APPOINTMENT_PARTY_NOT_FOUND', 'Patient or doctor not found');
        if (rows[0].Doctor_Clinic_ID !== null && Number(rows[0].Doctor_Clinic_ID) !== Number(rows[0].Patient_Clinic_ID)) return sendApiError(res, 403, 'APPOINTMENT_CLINIC_MISMATCH', 'Patient and doctor must belong to the same current clinic');
        requireAdminClinic(req, rows[0].Patient_Clinic_ID);
        if (rows[0].Doctor_Clinic_ID === null) {
            const assignedDoctors = typeof rows[0].Patient_Doctors === 'string' ? JSON.parse(rows[0].Patient_Doctors || '[]') : (rows[0].Patient_Doctors || []);
            if (!assignedDoctors.map(String).includes(String(doctorID))) return sendApiError(res, 403, 'APPOINTMENT_DOCTOR_SCOPE_DENIED', 'Doctor must be assigned to the patient in the admin clinic');
        } else requireAdminClinic(req, rows[0].Doctor_Clinic_ID);
        const authoritativeSpecialty = rows[0].Doctor_Specialty;
        if (!authoritativeSpecialty) return sendApiError(res, 409, 'DOCTOR_SPECIALTY_REQUIRED', 'Selected doctor has no configured specialty');
        if (specialty !== undefined && String(specialty) !== String(authoritativeSpecialty)) return sendApiError(res, 400, 'APPOINTMENT_SPECIALTY_MISMATCH', 'Appointment specialty must match the selected doctor');
        if (idempotencyKey) {
            const replay = await runQuery(`${APPOINTMENT_SELECT} WHERE Appointment.Idempotency_Key=? LIMIT 1`, [storedIdempotencyKey]);
            if (replay.length) {
                const sameRequest = String(replay[0].Patient_ID) === String(patientID)
                    && String(replay[0].Doctor_ID) === String(doctorID)
                    && new Date(replay[0].Appointment_Date_Time).getTime() === scheduledAt.getTime()
                    && Number(replay[0].Duration_Minutes) === resolvedDuration
                    && String(replay[0].Meeting_For) === String(meetingFor);
                if (!sameRequest) return sendApiError(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different appointment request');
                return res.json({ success:true, data:replay[0], alreadyProcessed:true, idempotent:true, message:'This appointment request was already processed; the existing appointment was returned' });
            }
        }
        const conflicts = await runQuery(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_Date_Time < ?
            AND Appointment.Appointment_End_Date_Time > ?
            AND (Appointment.Doctor_ID=? OR Appointment.Patient_ID=?)
            AND LOWER(COALESCE(Appointment.Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished') LIMIT 1`,
            [scheduledEnd, scheduledAt, rows[0].Doctor_DB_ID, rows[0].Patient_DB_ID]);
        if (conflicts.length) return sendApiError(res, 409, 'APPOINTMENT_TIME_CONFLICT', `The selected doctor or patient already has an appointment from ${conflicts[0].Appointment_Date_Time} to ${conflicts[0].Appointment_End_Date_Time}`);
        const result = await runQuery(`INSERT INTO Appointment (Meeting_For, Doctor_ID, Patient_ID, Date, Appointment_Date_Time, Duration_Minutes, Appointment_End_Date_Time, Specialty, Status, Notes, Modified_Date, Idempotency_Key)
            VALUES (?, ?, ?, DATE(?), ?, ?, ?, ?, 'scheduled', ?, NOW(), ?)`, [meetingFor, rows[0].Doctor_DB_ID, rows[0].Patient_DB_ID, scheduledAt, scheduledAt, resolvedDuration, scheduledEnd, authoritativeSpecialty, notes || null, storedIdempotencyKey]);
        const created = await runQuery(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [result.insertId]);
        return res.status(201).json({ success: true, data: created[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return sendApiError(res, 409, 'DUPLICATE_APPOINTMENT', 'This appointment request or active booking slot already exists');
        return sendApiError(res, error.statusCode || 500, error.code || 'APPOINTMENT_CREATE_FAILED', error.message);
    } finally {
        if (connection) {
            if (scheduleLock) await connection.query("SELECT RELEASE_LOCK('edr:appointment-schedule')").catch(()=>{});
            connection.release();
        }
    }
});

app.put('/appointments/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection; let scheduleLock = false;
    try {
        connection = await db.promise().getConnection();
        const runQuery = async (sql, params = []) => (await connection.query(sql, params))[0];
        const lockRows = await runQuery("SELECT GET_LOCK('edr:appointment-schedule',5) AS Acquired");
        if (Number(lockRows[0]?.Acquired) !== 1) throw Object.assign(new Error('Appointment scheduling is busy; please retry'), { statusCode:503, code:'APPOINTMENT_SCHEDULE_BUSY' });
        scheduleLock = true;
        const existing = await runQuery(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [req.params.id]);
        if (!existing.length) return sendApiError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
        if (['cancelled','canceled','completed','complete','done','finished'].includes(String(existing[0].Status || '').toLowerCase())) return sendApiError(res, 409, 'APPOINTMENT_TERMINAL_STATE', 'Cancelled or completed appointments cannot be edited; create a new appointment to reschedule');
        const scope = await runQuery('SELECT Patient.Clinic_ID AS Patient_Clinic_ID,Appointment.Doctor_ID,Appointment.Patient_ID FROM Appointment JOIN Patient ON Appointment.Patient_ID=Patient.ID WHERE Appointment.Appointment_ID=?', [req.params.id]);
        requireAdminClinic(req, scope[0].Patient_Clinic_ID);
        if (['patientID', 'doctorID', 'clinicID'].some((field) => req.body[field] !== undefined)) return sendApiError(res, 400, 'APPOINTMENT_CONTEXT_IMMUTABLE', 'Patient, doctor, and clinic require a dedicated rescheduling workflow');
        if (req.body.specialty !== undefined && String(req.body.specialty) !== String(existing[0].Specialty)) return sendApiError(res, 400, 'APPOINTMENT_SPECIALTY_IMMUTABLE', 'Appointment specialty is derived from the selected doctor');
        const appointmentDateTime = req.body.appointmentDateTime || existing[0].Appointment_Date_Time;
        const resolvedDuration = await resolveAppointmentDuration(req.body.durationMinutes ?? existing[0].Duration_Minutes, runQuery);
        requireTextLimit(req.body.meetingFor ?? existing[0].Meeting_For, 'Appointment reason', 255, 'APPOINTMENT_REASON_TOO_LONG');
        requireTextLimit(req.body.notes ?? existing[0].Notes, 'Appointment notes', 2000, 'APPOINTMENT_NOTES_TOO_LONG');
        const scheduledAt = new Date(appointmentDateTime);
        if (req.body.appointmentDateTime !== undefined && (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) throw validationError('INVALID_APPOINTMENT_DATE', 'Appointment date and time must be valid and in the future');
        const scheduledEnd = new Date(scheduledAt.getTime() + resolvedDuration * 60 * 1000);
        const conflicts = await runQuery(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID<>?
            AND Appointment.Appointment_Date_Time < ? AND Appointment.Appointment_End_Date_Time > ?
            AND (Appointment.Doctor_ID=? OR Appointment.Patient_ID=?)
            AND LOWER(COALESCE(Appointment.Status,'scheduled')) NOT IN ('cancelled','canceled','completed','complete','done','finished') LIMIT 1`,
            [req.params.id,scheduledEnd,scheduledAt,scope[0].Doctor_ID,scope[0].Patient_ID]);
        if (conflicts.length) return sendApiError(res, 409, 'APPOINTMENT_TIME_CONFLICT', `The selected doctor or patient already has an appointment from ${conflicts[0].Appointment_Date_Time} to ${conflicts[0].Appointment_End_Date_Time}`);
        await runQuery(`UPDATE Appointment SET Meeting_For=?, Date=DATE(?), Appointment_Date_Time=?, Duration_Minutes=?, Appointment_End_Date_Time=?, Notes=?, Modified_Date=NOW() WHERE Appointment_ID=?`,
            [req.body.meetingFor || existing[0].Meeting_For, scheduledAt, scheduledAt, resolvedDuration, scheduledEnd, req.body.notes ?? existing[0].Notes, req.params.id]);
        const updated = await runQuery(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [req.params.id]);
        return res.json({ success: true, data: updated[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return sendApiError(res, 409, 'APPOINTMENT_TIME_CONFLICT', 'The selected doctor or patient already has an active appointment at this time');
        return sendApiError(res, error.statusCode || 500, error.code || 'APPOINTMENT_UPDATE_FAILED', error.message);
    }
    finally {
        if (connection) {
            if (scheduleLock) await connection.query("SELECT RELEASE_LOCK('edr:appointment-schedule')").catch(()=>{});
            connection.release();
        }
    }
});

app.patch('/appointments/:id/cancel', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        requireTextLimit(req.body.reason, 'Cancellation reason', 1000, 'CANCELLATION_REASON_TOO_LONG');
        const rows = await query(`SELECT Patient.Clinic_ID,Appointment.Status,Appointment.Cancelled_Date FROM Appointment JOIN Patient ON Appointment.Patient_ID=Patient.ID WHERE Appointment.Appointment_ID=?`, [req.params.id]);
        if (!rows.length) return sendApiError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
        requireAdminClinic(req, rows[0].Clinic_ID);
        if (['cancelled','canceled'].includes(String(rows[0].Status || '').toLowerCase())) {
            const cancelled = await query(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [req.params.id]);
            return res.json({ success:true, data:cancelled[0], alreadyCancelled:true, idempotent:true, message:'Appointment was already cancelled; the original cancellation was preserved' });
        }
        if (['completed','complete','done','finished'].includes(String(rows[0].Status || '').toLowerCase())) return sendApiError(res, 409, 'APPOINTMENT_ALREADY_COMPLETED', 'Completed appointments cannot be cancelled');
        await query("UPDATE Appointment SET Status='cancelled', Notes=COALESCE(?, Notes), Cancelled_Date=NOW(), Modified_Date=NOW() WHERE Appointment_ID=?", [req.body.reason || null, req.params.id]);
        const cancelled = await query(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [req.params.id]);
        return res.json({ success: true, data: cancelled[0] });
    } catch (error) { return sendApiError(res, error.statusCode || 500, error.code || 'APPOINTMENT_CANCEL_FAILED', error.message); }
});

const LAB_RESULT_SELECT = `SELECT Lab_Result.*, PatientUser.First_Name AS Patient_First_Name,
    PatientUser.Last_Name AS Patient_Last_Name, DoctorUser.First_Name AS Doctor_First_Name,
    DoctorUser.Last_Name AS Doctor_Last_Name
    FROM Lab_Result
    JOIN Patient ON Patient.Blockchain_ID=Lab_Result.Patient_Blockchain_ID
    JOIN User PatientUser ON PatientUser.ID=Patient.ID
    LEFT JOIN Doctor ON Doctor.Blockchain_ID=Lab_Result.Ordering_Doctor_ID
    LEFT JOIN User DoctorUser ON DoctorUser.ID=Doctor.ID`;
const parseJsonColumn = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return null; }
};
const labOperationalMetadata = (row) => ({
    labResultID: row.Lab_Result_ID, orderID: row.Order_ID,
    patientID: row.Patient_Blockchain_ID, patientName: `${row.Patient_First_Name} ${row.Patient_Last_Name}`.trim(),
    status: row.Status, discipline: row.Discipline, testName: row.Test_Name,
    orderingDoctorID: row.Ordering_Doctor_ID,
    orderingDoctorName: [row.Doctor_First_Name, row.Doctor_Last_Name].filter(Boolean).join(' ') || null,
    orderedAt: row.Ordered_At, collectedAt: row.Collected_At, completedAt: row.Completed_At,
});
const labClinicalResult = (row) => ({
    ...labOperationalMetadata(row), testCode: row.Test_Code,
    resultData: parseJsonColumn(row.Result_Data), interpretation: row.Interpretation,
    referenceRanges: parseJsonColumn(row.Reference_Ranges), notes: row.Notes,
    dataHash: row.Data_Hash, correctedFromID: row.Corrected_From_ID,
});

const listLabResults = async (req, res) => {
    try {
        const role = normalizeRole(req.user.role);
        let where; let params;
        if (role === 'patient') {
            if (!req.user.blockchainID) return sendApiError(res, 403, 'PATIENT_IDENTITY_REQUIRED', 'Patient identity is required');
            where = 'Lab_Result.Patient_Blockchain_ID=?';
            params = [req.user.blockchainID];
        } else if (role === 'doctor') {
            const patientID = String(req.query.patientID || '');
            if (!patientID) return sendApiError(res, 400, 'PATIENT_REQUIRED', 'Select an authorized patient');
            await callBlockchain(req, `/clinical-records/${encodeURIComponent(patientID)}/medical?purpose=${encodeURIComponent('lab result listing')}`, 'GET');
            where = 'Lab_Result.Patient_Blockchain_ID=?';
            params = [patientID];
        } else {
            where = 'Lab_Result.Clinic_ID=?';
            params = [req.user.organizationId];
            if (req.query.patientID) { where += ' AND Lab_Result.Patient_Blockchain_ID=?'; params.push(String(req.query.patientID)); }
        }
        const rows = await query(`${LAB_RESULT_SELECT} WHERE ${where} ORDER BY Lab_Result.Ordered_At DESC`, params);
        if (role === 'admin') {
            await query(`INSERT INTO Auth_Session_Event (Session_ID,User_ID,Event_Type,Details) VALUES (?,?,?,?)`, [
                req.user.sid, req.user.id, 'LAB_METADATA_VIEWED',
                JSON.stringify({ clinicID: Number(req.user.organizationId), patientID: req.query.patientID || null, resultCount: rows.length }),
            ]);
        }
        return res.json({ success: true, data: rows.map(role === 'admin' ? labOperationalMetadata : labClinicalResult),
            access: role === 'admin' ? 'operational-metadata' : 'clinical' });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'LAB_RESULTS_READ_FAILED', error.message); }
};
app.get(['/lab-results', '/Lab_Results'], authenticateToken, requireRoles('admin', 'doctor', 'patient'), listLabResults);

// Route to fetch all users
app.get('/users', authenticateToken, requireRoles('admin'), (req, res) => {
    const sql = `
        SELECT 
            ID, First_Name, Last_Name, Email, Contact_Number, Role_ID, Created_Date, IsActive, Last_Login_Date 
        FROM User
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }
        return res.json(results);
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`listening on port ${PORT}`);
});
