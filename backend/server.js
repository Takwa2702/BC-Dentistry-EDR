const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

require('dotenv').config();

const app = express();
const SECRET_KEY = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN;
const BLOCKCHAIN_API_URL = process.env.BLOCKCHAIN_API_URL?.replace(/\/+$/, '');
const PATIENT_ROLE_ID = 4;
const DOCTOR_ROLE_ID = 3;

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
    modifiedDate: row.Modified_Date
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

const clinicalHash = (payload) => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const validateClinicalPayload = (recordType, payload) => {
    if (!['medical', 'dental'].includes(recordType)) { const error = new Error('recordType must be medical or dental'); error.statusCode = 400; throw error; }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { const error = new Error('payload must be an object'); error.statusCode = 400; throw error; }
    const required = recordType === 'medical' ? ['medicalHistory', 'allergies', 'labResults', 'medications']
        : ['treatmentPhase', 'procedureCode', 'tooth', 'ceramicType', 'prescriptions', 'diagnostics'];
    const missing = required.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
    if (missing.length) { const error = new Error(`Missing required clinical fields: ${missing.join(', ')}`); error.statusCode = 400; throw error; }
};

const callBlockchain = async (req, path, method, body) => {
    if (!BLOCKCHAIN_API_URL) {
        const error = new Error('Blockchain API URL is not configured');
        error.statusCode = 503;
        throw error;
    }
    const response = await fetch(`${BLOCKCHAIN_API_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload?.error?.message || payload?.error || 'Blockchain operation failed');
        error.statusCode = response.status;
        throw error;
    }
    return payload.data ?? payload;
};

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
    optionsSuccessStatus: 200
};

if (!SECRET_KEY) {
    console.warn('JWT_SECRET is not configured. Login and protected endpoints will return a configuration error.');
}

if (!BLOCKCHAIN_API_URL) {
    console.warn('BLOCKCHAIN_API_URL is not configured. /syncOnChainPatients will return a configuration error.');
}

if (!ADMIN_BOOTSTRAP_TOKEN) {
    console.warn('ADMIN_BOOTSTRAP_TOKEN is not configured. /register requires an Admin/System JWT.');
}

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



app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Input check
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    console.log('🔐 Login attempt:', email);

    const sql = `
        SELECT 
            User.ID, User.First_Name, User.Last_Name, User.Email, User.Password, 
            UserRole.Name AS Role_Name,
            COALESCE(Admin.Organization_ID, NULL) AS Organization_ID,
            COALESCE(Doctor.Works_At, NULL) AS WorksAt,
            COALESCE(Doctor.Specialty, NULL) AS Specialty,
            COALESCE(Doctor.Blockchain_ID, Patient.Blockchain_ID, NULL) AS BlockchainID
        FROM User 
        INNER JOIN UserRole ON User.Role_ID = UserRole.Role_ID
        LEFT JOIN Admin ON User.ID = Admin.User_ID
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
        const match = await bcrypt.compare(password, user.Password);

        if (!match) {
            console.log('❌ Password mismatch for:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        db.query("UPDATE User SET Last_Login_Date = NOW() WHERE ID = ?", [user.ID], (updateErr) => {
            if (updateErr) console.warn('⚠️ Failed to update last login date:', updateErr);
        });

        // JWT payload
        const tokenPayload = {
            id: user.ID,
            role: user.Role_Name,
            organizationId: user.Organization_ID || null,
            worksAt: user.WorksAt || null,
            specialty: user.Specialty || null,
            blockchainID: user.BlockchainID || null
        };

        if (!SECRET_KEY) {
            return res.status(500).json({ error: 'JWT secret is not configured' });
        }

        const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });

        // User data to return
        const userData = {
            id: user.ID,
            name: `${user.First_Name} ${user.Last_Name}`,
            email: user.Email,
            role: user.Role_Name,
            organizationId: user.Organization_ID || null,
            worksAt: user.WorksAt || null,
            specialty: user.Specialty || null,
            blockchainID: user.BlockchainID || null
        };

        res.status(200).json({ token, user: userData });
    });
});

const getBearerToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(' ');
    return /^Bearer$/i.test(scheme) ? token : null;
};

const safeTokenEquals = (receivedToken, expectedToken) => {
    const received = Buffer.from(String(receivedToken || ''), 'utf8');
    const expected = Buffer.from(String(expectedToken || ''), 'utf8');

    if (received.length !== expected.length) return false;
    return crypto.timingSafeEqual(received, expected);
};

const authenticateToken = (req, res, next) => {
    const token = getBearerToken(req);

    if (!token) return sendApiError(res, 401, 'AUTH_REQUIRED', 'Access denied');
    if (!SECRET_KEY) {
        return sendApiError(res, 500, 'AUTH_CONFIGURATION_ERROR', 'JWT secret is not configured');
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return sendApiError(res, 403, 'INVALID_TOKEN', 'Invalid token');
        req.user = user;
        next();
    });
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

const authorizeAdminRegistration = (req, res, next) => {
    const bootstrapToken = req.headers['x-bootstrap-token'];

    if (bootstrapToken) {
        if (!ADMIN_BOOTSTRAP_TOKEN || !safeTokenEquals(bootstrapToken, ADMIN_BOOTSTRAP_TOKEN)) {
            return res.status(403).json({ error: 'Invalid admin bootstrap token' });
        }
        req.user = { role: 'system', bootstrap: true };
        return next();
    }

    const token = getBearerToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Admin registration requires an Admin/System token or configured bootstrap token' });
    }
    if (!SECRET_KEY) {
        return res.status(500).json({ error: 'JWT secret is not configured' });
    }

    try {
        const user = jwt.verify(token, SECRET_KEY);
        if (!['admin', 'system'].includes(normalizeRole(user?.role))) {
            return res.status(403).json({ error: 'Forbidden: admin registration requires Admin/System permissions' });
        }
        req.user = user;
        return next();
    } catch {
        return res.status(403).json({ error: 'Invalid token' });
    }
};


app.post('/register', authorizeAdminRegistration, async (req, res) => {
    const { firstName, lastName, username, contactNumber, password, organizationId } = req.body;
    const roleId = 2; // Hardcoded for Admin role (Only Admins can register)

    // Validate required fields
    if (!firstName || !lastName || !username || !contactNumber || !password || !organizationId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

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

            const existingAdmins = await query(
                "SELECT User_ID FROM Admin WHERE Organization_ID = ? LIMIT 1",
                [organizationId]
            );
            if (existingAdmins.length > 0) {
                await rollback();
                return res.status(400).json({ error: 'An admin is already registered for this organization' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const insertUserSQL = `
                INSERT INTO User 
                (First_Name, Last_Name, Email, Contact_Number, Password, Role_ID, Created_Date, IsActive) 
                VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)
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
                [userResult.insertId, organizationId]
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

const DOCTOR_SELECT = `SELECT Doctor.*, User.First_Name, User.Last_Name, User.Email, User.Contact_Number, User.Created_Date
    FROM Doctor INNER JOIN User ON Doctor.ID = User.ID`;
const normalizeDoctor = (row) => ({ doctorID: row.Blockchain_ID, firstName: row.First_Name, lastName: row.Last_Name,
    email: row.Email, contactNumber: row.Contact_Number, worksAt: row.Works_At, speciality: row.Specialty,
    licenseNumber: row.License_Number, emiratesID: row.Emirates_ID, clinicID: row.Clinic_ID,
    createdDate: row.Created_Date, modifiedDate: row.Modified_Date });
const validateDoctorPayload = (body, isCreate = false) => {
    const required = ['firstName','lastName','email','contactNumber','worksAt','speciality','licenseNumber','emiratesID'];
    if (isCreate) required.push('password');
    const missing = required.filter((field) => body[field] === undefined || body[field] === null || String(body[field]).trim() === '');
    if (missing.length) { const error = new Error(`Missing required fields: ${missing.join(', ')}`); error.statusCode = 400; throw error; }
    if (!/^\S+@\S+\.\S+$/.test(body.email)) { const error = new Error('Invalid email address'); error.statusCode = 400; throw error; }
};

app.post('/doctors', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection;
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
        await connection.query(`INSERT INTO Doctor
            (ID,Works_At,Specialty,Blockchain_ID,License_Number,Emirates_ID,Clinic_ID,Modified_Date) VALUES (?,?,?,?,?,?,?,NOW())`,
            [userResult.insertId, req.body.worksAt, req.body.speciality, doctorID, req.body.licenseNumber, req.body.emiratesID, clinicID]);
        await callBlockchain(req, '/addDoctor', 'POST', { ...req.body, doctorID, clinicID, patients: [] });
        await connection.commit();
        return res.status(201).json({ success: true, data: { ...req.body, password: undefined, doctorID, clinicID }, message: 'Doctor created consistently in MySQL and Fabric' });
    } catch (error) { if (connection) await connection.rollback().catch(() => {}); return sendApiError(res, error.statusCode || (error.code === 'ER_DUP_ENTRY' ? 409 : 500), 'DOCTOR_CREATE_FAILED', error.message); }
    finally { if (connection) connection.release(); }
});

app.get('/doctors', authenticateToken, requireRoles('admin'), async (req, res) => {
    try { const rows = await query(`${DOCTOR_SELECT} WHERE Doctor.Clinic_ID=? ORDER BY User.Last_Name,User.First_Name`, [req.user.organizationId]); return res.json({ success: true, data: rows.map(normalizeDoctor) }); }
    catch (error) { return sendApiError(res, 500, 'DOCTOR_LIST_FAILED', 'Unable to retrieve doctors'); }
});

app.get('/doctors/:id', authenticateToken, requireRoles('admin','doctor'), async (req, res) => {
    try { const rows = await query(`${DOCTOR_SELECT} WHERE Doctor.Blockchain_ID=? LIMIT 1`, [req.params.id]);
        if (!rows.length) return sendApiError(res, 404, 'DOCTOR_NOT_FOUND', 'Doctor not found');
        const doctor = normalizeDoctor(rows[0]); const role = normalizeRole(req.user.role);
        if (role === 'doctor' && req.user.blockchainID !== req.params.id) return sendApiError(res, 403, 'DOCTOR_OWNER_MISMATCH', 'Doctors may retrieve only their own profile');
        if (role === 'admin') requireAdminClinic(req, doctor.clinicID);
        return res.json({ success: true, data: doctor });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'DOCTOR_READ_FAILED', error.message); }
});

app.put('/doctors/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection;
    try { validateDoctorPayload(req.body); const clinicID = Number(req.user.organizationId); connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${DOCTOR_SELECT} WHERE Doctor.Blockchain_ID=? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Doctor not found'); error.statusCode = 404; throw error; } requireAdminClinic(req, rows[0].Clinic_ID);
        await connection.query('UPDATE User SET First_Name=?,Last_Name=?,Email=?,Contact_Number=? WHERE ID=?', [req.body.firstName,req.body.lastName,req.body.email,req.body.contactNumber,rows[0].ID]);
        await connection.query('UPDATE Doctor SET Works_At=?,Specialty=?,License_Number=?,Emirates_ID=?,Modified_Date=NOW() WHERE ID=?', [req.body.worksAt,req.body.speciality,req.body.licenseNumber,req.body.emiratesID,rows[0].ID]);
        await callBlockchain(req, `/doctor/${encodeURIComponent(req.params.id)}`, 'PUT', { ...req.body, clinicID, patients: req.body.patients || [] });
        await connection.commit(); return res.json({ success:true, data:{ ...req.body, doctorID:req.params.id, clinicID }, message:'Doctor updated consistently' });
    } catch (error) { if (connection) await connection.rollback().catch(()=>{}); return sendApiError(res,error.statusCode || (error.code==='ER_DUP_ENTRY'?409:500),'DOCTOR_UPDATE_FAILED',error.message); }
    finally { if (connection) connection.release(); }
});

app.delete('/doctors/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection;
    try { connection = await db.promise().getConnection(); await connection.beginTransaction(); const [rows] = await connection.query(`${DOCTOR_SELECT} WHERE Doctor.Blockchain_ID=? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Doctor not found'); error.statusCode = 404; throw error; } requireAdminClinic(req, rows[0].Clinic_ID);
        const [assigned] = await connection.query('SELECT ID FROM Patient WHERE JSON_CONTAINS(Doctors, JSON_QUOTE(?)) LIMIT 1', [req.params.id]);
        if (assigned.length) { const error = new Error('Reassign or remove this doctor from assigned patients before deletion'); error.statusCode = 409; throw error; }
        await callBlockchain(req, `/doctor/${encodeURIComponent(req.params.id)}`, 'DELETE'); await connection.query('DELETE FROM Doctor WHERE ID=?',[rows[0].ID]); await connection.query('DELETE FROM User WHERE ID=?',[rows[0].ID]);
        await connection.commit(); return res.json({ success:true, data:{ doctorID:req.params.id, deleted:true }, message:'Doctor deleted from Fabric and MySQL' });
    } catch (error) { if (connection) await connection.rollback().catch(()=>{}); return sendApiError(res,error.statusCode||500,'DOCTOR_DELETE_FAILED',`${error.message}; no MySQL deletion was committed`); }
    finally { if (connection) connection.release(); }
});

const PATIENT_SELECT = `
    SELECT Patient.*, User.First_Name, User.Last_Name, User.Email, User.Contact_Number, User.Created_Date
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
    if (!/^\S+@\S+\.\S+$/.test(body.email)) {
        const error = new Error('Invalid email address'); error.statusCode = 400; throw error;
    }
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
    let connection;
    try {
        validatePatientPayload(req.body, true);
        requireAdminClinic(req, req.body.clinicID);
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [duplicates] = await connection.query(
            'SELECT Patient.ID FROM Patient INNER JOIN User ON Patient.ID = User.ID WHERE Patient.Emirates_ID = ? OR User.Email = ? LIMIT 1',
            [req.body.emiratesID, req.body.email]
        );
        if (duplicates.length) { const error = new Error('Patient email or Emirates ID already exists'); error.statusCode = 409; throw error; }

        const passwordHash = await bcrypt.hash(req.body.password, 10);
        const [userResult] = await connection.query(
            'INSERT INTO User (First_Name, Last_Name, Password, Email, Contact_Number, Role_ID, Created_Date, IsActive) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1)',
            [req.body.firstName, req.body.lastName, passwordHash, req.body.email, req.body.contactNumber, PATIENT_ROLE_ID]
        );
        const patientID = `Patient-${crypto.randomUUID()}`;
        await connection.query(`INSERT INTO Patient
            (ID, Date_of_Birth, Gender, Emirates_ID, Blockchain_ID, Nationality, Address, Blood_Type, Medical_History, Allergies, Medications, Insurance_Details, Clinic_ID, Doctors, Modified_Date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [
            userResult.insertId, req.body.dateOfBirth, req.body.gender, req.body.emiratesID, patientID, req.body.nationality,
            req.body.address, req.body.bloodType, JSON.stringify(req.body.medicalHistory), JSON.stringify(req.body.allergies),
            JSON.stringify(req.body.medications), JSON.stringify(req.body.insuranceDetails), Number(req.body.clinicID),
            JSON.stringify(req.body.doctors || [])
        ]);
        const patient = { ...req.body, patientID, password: undefined };
        const dataHash = patientHash(patient);
        await callBlockchain(req, '/patient-metadata', 'POST', {
            patientID, clinicID: Number(req.body.clinicID), doctors: req.body.doctors || [],
            offChainRef: `mysql:Patient/${userResult.insertId}`, dataHash
        });
        await connection.commit();
        return res.status(201).json({ success: true, data: { ...patient, dataHash }, message: 'Patient created in MySQL and referenced on-chain' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        const status = error.statusCode || (error.code === 'ER_DUP_ENTRY' ? 409 : 500);
        return sendApiError(res, status, 'PATIENT_CREATE_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.get('/patients', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const rows = await query(`${PATIENT_SELECT} WHERE Patient.Clinic_ID = ? ORDER BY User.Last_Name, User.First_Name`, [req.user.organizationId]);
        return res.json({ success: true, data: rows.map(normalizePatient) });
    } catch (error) { return sendApiError(res, 500, 'PATIENT_LIST_FAILED', 'Unable to retrieve patients'); }
});

app.get('/doctor/me/assigned-patients', authenticateToken, requireRoles('doctor'), async (req, res) => {
    try {
        if (!req.user.blockchainID) return sendApiError(res, 403, 'DOCTOR_IDENTITY_REQUIRED', 'Authenticated doctor has no blockchain identity');
        // Revalidate the JWT-to-certificate actor binding before returning authoritative MySQL PII.
        await callBlockchain(req, '/doctor/me/assigned-patients', 'GET');
        const rows = await query(`${PATIENT_SELECT} WHERE JSON_CONTAINS(Patient.Doctors, JSON_QUOTE(?))
            ORDER BY User.Last_Name, User.First_Name`, [String(req.user.blockchainID)]);
        return res.json({ success: true, data: rows.map(normalizePatient) });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'ASSIGNED_PATIENT_LIST_FAILED', error.message); }
});

app.get('/patients/:id', authenticateToken, requireRoles('admin', 'doctor', 'patient'), async (req, res) => {
    try {
        const rows = await query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID = ? LIMIT 1`, [req.params.id]);
        if (!rows.length) return sendApiError(res, 404, 'PATIENT_NOT_FOUND', 'Patient not found');
        const patient = normalizePatient(rows[0]);
        if (normalizeRole(req.user.role) === 'patient' && req.user.blockchainID !== req.params.id) {
            return sendApiError(res, 403, 'PATIENT_OWNER_MISMATCH', 'Patients may retrieve only their own profile');
        }
        if (normalizeRole(req.user.role) === 'admin') requireAdminClinic(req, patient.clinicID);
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
        validatePatientPayload(req.body);
        requireAdminClinic(req, req.body.clinicID);
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID = ? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Patient not found'); error.statusCode = 404; throw error; }
        requireAdminClinic(req, rows[0].Clinic_ID);
        await connection.query('UPDATE User SET First_Name=?, Last_Name=?, Email=?, Contact_Number=? WHERE ID=?',
            [req.body.firstName, req.body.lastName, req.body.email, req.body.contactNumber, rows[0].ID]);
        await connection.query(`UPDATE Patient SET Date_of_Birth=?, Gender=?, Emirates_ID=?, Nationality=?, Address=?, Blood_Type=?,
            Medical_History=?, Allergies=?, Medications=?, Insurance_Details=?, Clinic_ID=?, Doctors=?, Modified_Date=NOW() WHERE ID=?`, [
            req.body.dateOfBirth, req.body.gender, req.body.emiratesID, req.body.nationality, req.body.address, req.body.bloodType,
            JSON.stringify(req.body.medicalHistory), JSON.stringify(req.body.allergies), JSON.stringify(req.body.medications),
            JSON.stringify(req.body.insuranceDetails), Number(req.body.clinicID), JSON.stringify(req.body.doctors || []), rows[0].ID
        ]);
        const patient = { ...req.body, patientID: req.params.id };
        const dataHash = patientHash(patient);
        await callBlockchain(req, `/patient-metadata/${encodeURIComponent(req.params.id)}`, 'PUT', {
            clinicID: Number(req.body.clinicID), doctors: req.body.doctors || [], offChainRef: `mysql:Patient/${rows[0].ID}`, dataHash
        });
        await connection.commit();
        return res.json({ success: true, data: { ...patient, dataHash }, message: 'Patient updated consistently' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || (error.code === 'ER_DUP_ENTRY' ? 409 : 500), 'PATIENT_UPDATE_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.post('/patients/:id/assign', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection;
    try {
        if (!req.body.doctorID) return sendApiError(res, 400, 'VALIDATION_ERROR', 'doctorID is required');
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID = ? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Patient not found'); error.statusCode = 404; throw error; }
        const current = normalizePatient(rows[0]); requireAdminClinic(req, current.clinicID);
        const doctors = [...new Set([...(current.doctors || []), String(req.body.doctorID)])];
        await connection.query('UPDATE Patient SET Doctors=?, Modified_Date=NOW() WHERE ID=?', [JSON.stringify(doctors), rows[0].ID]);
        const updated = { ...current, doctors };
        await callBlockchain(req, `/patient-metadata/${encodeURIComponent(req.params.id)}`, 'PUT', {
            clinicID: Number(current.clinicID), doctors, offChainRef: `mysql:Patient/${rows[0].ID}`, dataHash: patientHash(updated)
        });
        await connection.commit();
        return res.json({ success: true, data: { patientID: req.params.id, doctors }, message: 'Patient assigned to doctor' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, 'PATIENT_ASSIGN_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.delete('/patients/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    let connection;
    try {
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        const [rows] = await connection.query(`${PATIENT_SELECT} WHERE Patient.Blockchain_ID = ? FOR UPDATE`, [req.params.id]);
        if (!rows.length) { const error = new Error('Patient not found'); error.statusCode = 404; throw error; }
        requireAdminClinic(req, rows[0].Clinic_ID);
        await callBlockchain(req, `/patient-metadata/${encodeURIComponent(req.params.id)}`, 'DELETE');
        await connection.query('DELETE FROM Patient WHERE ID=?', [rows[0].ID]);
        await connection.query('DELETE FROM User WHERE ID=?', [rows[0].ID]);
        await connection.commit();
        return res.json({ success: true, data: { patientID: req.params.id, deleted: true }, message: 'Patient deleted from Fabric and MySQL' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, 'PATIENT_DELETE_FAILED', `${error.message}; no MySQL deletion was committed`);
    } finally { if (connection) connection.release(); }
});

app.post(['/clinical-records', '/addMedicalRecord', '/addDentalChartEntry'], authenticateToken, requireRoles('doctor'), async (req, res) => {
    let connection;
    try {
        const recordType = req.path === '/addDentalChartEntry' ? 'dental' : (req.body.recordType || 'medical');
        validateClinicalPayload(recordType, req.body.payload);
        if (!req.body.patientID) return sendApiError(res, 400, 'VALIDATION_ERROR', 'patientID is required');
        if (!req.user.blockchainID) return sendApiError(res, 403, 'DOCTOR_IDENTITY_REQUIRED', 'Authenticated doctor is missing a blockchain identity');
        const recordID = `Clinical-${crypto.randomUUID()}`;
        const dataHash = clinicalHash(req.body.payload);
        const createdAt = new Date().toISOString();
        connection = await db.promise().getConnection(); await connection.beginTransaction();
        await connection.query('INSERT INTO Clinical_Record (Record_ID, Patient_Blockchain_ID, Record_Type, Payload, Data_Hash, Created_By_Doctor_ID, Created_Date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [recordID, req.body.patientID, recordType, JSON.stringify(req.body.payload), dataHash, req.user.blockchainID, createdAt.slice(0, 19).replace('T', ' ')]);
        await callBlockchain(req, '/clinical-record-metadata', 'POST', { recordID, recordType, patientID: req.body.patientID, offChainRef: `mysql:Clinical_Record/${recordID}`, dataHash, doctorID: req.user.blockchainID, createdAt });
        await connection.commit();
        return res.status(201).json({ success: true, data: { recordID, recordType, patientID: req.body.patientID, payload: req.body.payload, dataHash, createdAt } });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        return sendApiError(res, error.statusCode || 500, 'CLINICAL_RECORD_CREATE_FAILED', error.message);
    } finally { if (connection) connection.release(); }
});

app.get(['/patients/:id/clinical-records/:recordType', '/getMedicalRecords/:id', '/getDentalChartData/:id'], authenticateToken, requireRoles('doctor', 'patient'), async (req, res) => {
    try {
        const recordType = req.path.startsWith('/getDentalChartData') ? 'dental' : (req.params.recordType || 'medical');
        const metadata = await callBlockchain(req, `/clinical-records/${encodeURIComponent(req.params.id)}/${recordType}?purpose=${encodeURIComponent(req.query.purpose || 'clinical care')}`, 'GET');
        if (!metadata.length) return res.json({ success: true, data: [] });
        const ids = metadata.map((item) => item.recordID);
        const placeholders = ids.map(() => '?').join(',');
        const rows = await query(`SELECT * FROM Clinical_Record WHERE Record_ID IN (${placeholders}) ORDER BY Created_Date DESC`, ids);
        const byID = new Map(metadata.map((item) => [item.recordID, item]));
        const records = rows.map((row) => ({ ...byID.get(row.Record_ID), payload: typeof row.Payload === 'string' ? JSON.parse(row.Payload) : row.Payload, dataHash: row.Data_Hash, createdAt: row.Created_Date }));
        return res.json({ success: true, data: records });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'CLINICAL_RECORD_READ_FAILED', error.message); }
});

const APPOINTMENT_SELECT = `SELECT Appointment.Appointment_ID, Appointment.Meeting_For,
    COALESCE(Appointment.Appointment_Date_Time, Appointment.Date) AS Appointment_Date_Time,
    Appointment.Date, Appointment.Specialty, Appointment.Status, Appointment.Notes,
    Doctor.Blockchain_ID AS Doctor_ID, Patient.Blockchain_ID AS Patient_ID,
    CONCAT(DoctorUser.First_Name, ' ', DoctorUser.Last_Name) AS Doctor_Name,
    CONCAT(PatientUser.First_Name, ' ', PatientUser.Last_Name) AS Patient_Name
    FROM Appointment
    INNER JOIN Doctor ON Appointment.Doctor_ID = Doctor.ID
    INNER JOIN User DoctorUser ON Doctor.ID = DoctorUser.ID
    INNER JOIN Patient ON Appointment.Patient_ID = Patient.ID
    INNER JOIN User PatientUser ON Patient.ID = PatientUser.ID`;

app.get('/appointment-options/doctors', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const rows = await query(`${DOCTOR_SELECT} WHERE Doctor.Clinic_ID=? OR (Doctor.Clinic_ID IS NULL AND EXISTS (
            SELECT 1 FROM Patient WHERE Patient.Clinic_ID=? AND JSON_CONTAINS(Patient.Doctors, JSON_QUOTE(Doctor.Blockchain_ID))
        )) ORDER BY User.Last_Name,User.First_Name`, [req.user.organizationId, req.user.organizationId]);
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
    try {
        const { patientID, doctorID, appointmentDateTime, specialty, meetingFor, notes } = req.body;
        if (![patientID, doctorID, appointmentDateTime, specialty, meetingFor].every(Boolean)) return sendApiError(res, 400, 'VALIDATION_ERROR', 'patientID, doctorID, appointmentDateTime, specialty, and meetingFor are required');
        const rows = await query(`SELECT Patient.ID AS Patient_DB_ID, Patient.Clinic_ID AS Patient_Clinic_ID, Patient.Doctors AS Patient_Doctors,
            Doctor.ID AS Doctor_DB_ID, Doctor.Clinic_ID AS Doctor_Clinic_ID
            FROM Patient JOIN Doctor ON Doctor.Blockchain_ID=? WHERE Patient.Blockchain_ID=? LIMIT 1`, [doctorID, patientID]);
        if (!rows.length) return sendApiError(res, 404, 'APPOINTMENT_PARTY_NOT_FOUND', 'Patient or doctor not found');
        requireAdminClinic(req, rows[0].Patient_Clinic_ID);
        if (rows[0].Doctor_Clinic_ID === null) {
            const assignedDoctors = typeof rows[0].Patient_Doctors === 'string' ? JSON.parse(rows[0].Patient_Doctors || '[]') : (rows[0].Patient_Doctors || []);
            if (!assignedDoctors.map(String).includes(String(doctorID))) return sendApiError(res, 403, 'APPOINTMENT_DOCTOR_SCOPE_DENIED', 'Doctor must be assigned to the patient in the admin clinic');
        } else requireAdminClinic(req, rows[0].Doctor_Clinic_ID);
        const result = await query(`INSERT INTO Appointment (Meeting_For, Doctor_ID, Patient_ID, Date, Appointment_Date_Time, Specialty, Status, Notes, Modified_Date)
            VALUES (?, ?, ?, DATE(?), ?, ?, 'scheduled', ?, NOW())`, [meetingFor, rows[0].Doctor_DB_ID, rows[0].Patient_DB_ID, appointmentDateTime, appointmentDateTime, specialty, notes || null]);
        const created = await query(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [result.insertId]);
        return res.status(201).json({ success: true, data: created[0] });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'APPOINTMENT_CREATE_FAILED', error.message); }
});

app.put('/appointments/:id', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const existing = await query(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [req.params.id]);
        if (!existing.length) return sendApiError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
        const scope = await query('SELECT Patient.Clinic_ID AS Patient_Clinic_ID FROM Appointment JOIN Patient ON Appointment.Patient_ID=Patient.ID WHERE Appointment.Appointment_ID=?', [req.params.id]);
        requireAdminClinic(req, scope[0].Patient_Clinic_ID);
        const appointmentDateTime = req.body.appointmentDateTime || existing[0].Appointment_Date_Time;
        await query(`UPDATE Appointment SET Meeting_For=?, Date=DATE(?), Appointment_Date_Time=?, Specialty=?, Notes=?, Status='scheduled', Modified_Date=NOW() WHERE Appointment_ID=?`,
            [req.body.meetingFor || existing[0].Meeting_For, appointmentDateTime, appointmentDateTime, req.body.specialty || existing[0].Specialty, req.body.notes ?? existing[0].Notes, req.params.id]);
        const updated = await query(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [req.params.id]);
        return res.json({ success: true, data: updated[0] });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'APPOINTMENT_UPDATE_FAILED', error.message); }
});

app.patch('/appointments/:id/cancel', authenticateToken, requireRoles('admin'), async (req, res) => {
    try {
        const rows = await query(`SELECT Patient.Clinic_ID FROM Appointment JOIN Patient ON Appointment.Patient_ID=Patient.ID WHERE Appointment.Appointment_ID=?`, [req.params.id]);
        if (!rows.length) return sendApiError(res, 404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
        requireAdminClinic(req, rows[0].Clinic_ID);
        await query("UPDATE Appointment SET Status='cancelled', Notes=COALESCE(?, Notes), Cancelled_Date=NOW(), Modified_Date=NOW() WHERE Appointment_ID=?", [req.body.reason || null, req.params.id]);
        const cancelled = await query(`${APPOINTMENT_SELECT} WHERE Appointment.Appointment_ID=?`, [req.params.id]);
        return res.json({ success: true, data: cancelled[0] });
    } catch (error) { return sendApiError(res, error.statusCode || 500, 'APPOINTMENT_CANCEL_FAILED', error.message); }
});

// Route to fetch Lab Results
app.get('/Lab_Results', authenticateToken, requireRoles('admin', 'doctor'), (req, res) => {
    return sendApiError(res, 501, 'LAB_RESULTS_NOT_IMPLEMENTED', 'Lab results are unavailable until a scoped clinical data source is configured');
});

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
