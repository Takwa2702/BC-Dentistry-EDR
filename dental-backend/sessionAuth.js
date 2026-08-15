const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const ACCESS_COOKIE = '__Host-edr_access';
let pool;

const getPool = () => {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'mydatabase',
            waitForConnections: true,
            connectionLimit: Number(process.env.DB_POOL_SIZE || 5),
        });
    }
    return pool;
};

const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
}));

const bearerToken = (header = '') => {
    const [scheme, token] = header.split(' ');
    return /^Bearer$/i.test(scheme) ? token : null;
};

const verification = () => {
    const publicKey = process.env.JWT_PUBLIC_KEY_BASE64
        ? Buffer.from(process.env.JWT_PUBLIC_KEY_BASE64, 'base64').toString('utf8')
        : null;
    if (!publicKey && process.env.NODE_ENV === 'production') return { key: null, algorithms: [] };
    return publicKey
        ? { key: publicKey, algorithms: [process.env.JWT_ALGORITHM || 'RS256'] }
        : { key: process.env.JWT_SECRET, algorithms: ['HS256'] };
};

const hash = (value) => crypto.createHmac(
    'sha256',
    process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_SECRET || '',
).update(String(value)).digest('hex');

const verifyToken = (token) => {
    const settings = verification();
    if (!settings.key) throw Object.assign(new Error('Token verification key is not configured'), { statusCode: 500, code: 'AUTH_CONFIGURATION_ERROR' });
    const payload = jwt.verify(token, settings.key, {
        algorithms: settings.algorithms,
        issuer: process.env.JWT_ISSUER || 'bc-dentistry-auth',
        audience: process.env.JWT_AUDIENCE || 'bc-dentistry-api',
        clockTolerance: 5,
    });
    payload.id = Number(payload.sub);
    if (!payload.sub || !payload.sid || !payload.jti || !payload.exp) {
        throw Object.assign(new Error('Token is missing required claims'), { statusCode: 403, code: 'INVALID_TOKEN' });
    }
    return payload;
};

const createSessionAuthenticator = (sendApiError) => async (req, res, next) => {
    const bearer = bearerToken(req.headers.authorization);
    const token = bearer || parseCookies(req.headers.cookie || '')[ACCESS_COOKIE];
    if (!token) return sendApiError(res, 401, 'AUTH_REQUIRED', 'Access denied');
    try {
        const user = verifyToken(token);
        const [rows] = await getPool().execute(`SELECT s.Security_Version,s.Csrf_Token_Hash,s.Idle_Expires_At,
            s.Absolute_Expires_At,s.Revoked_At,u.IsActive,u.Security_Version AS User_Security_Version,
            u.Sessions_Invalid_Before,ur.Name AS Current_Role,COALESCE(o.IsActive,1) AS Clinic_IsActive
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
        if (String(session.Current_Role || '').toLowerCase().replace(/[\s_-]+/g, '') !== String(user.role || '').toLowerCase()) {
            return sendApiError(res, 401, 'SESSION_STALE', 'Session claims are no longer current');
        }
        if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            const allowedOrigins = String(process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
            if (!allowedOrigins.includes(req.get('origin'))) {
                return sendApiError(res, 403, 'ORIGIN_VALIDATION_FAILED', 'Request origin is not permitted');
            }
            const csrf = req.get('x-csrf-token');
            if (!csrf || hash(csrf) !== session.Csrf_Token_Hash) {
                return sendApiError(res, 403, 'CSRF_VALIDATION_FAILED', 'CSRF validation failed');
            }
        }
        req.user = user;
        req.authMode = bearer ? 'bearer' : 'cookie';
        res.set('Cache-Control', 'private, no-store');
        return next();
    } catch (error) {
        return sendApiError(res, error.statusCode || 403, error.code || 'INVALID_TOKEN', 'Invalid or expired session');
    }
};

const verifySessionSchema = async () => {
    const [rows] = await getPool().execute(`SELECT (
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
            AND TABLE_NAME IN ('Auth_Session','Auth_Refresh_Token','Auth_Session_Event','Schema_Migration'))=4
        AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='User'
            AND COLUMN_NAME IN ('Security_Version','Sessions_Invalid_Before'))=2
        AND EXISTS (SELECT 1 FROM Schema_Migration WHERE Migration_ID='2026-07-29-secure-auth-sessions')
    ) AS ready`);
    return Boolean(rows[0]?.ready);
};

module.exports = { createSessionAuthenticator, verifySessionSchema };
