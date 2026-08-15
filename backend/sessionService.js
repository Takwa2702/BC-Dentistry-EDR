const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_COOKIE = '__Host-edr_access';
const REFRESH_COOKIE = '__Host-edr_refresh';
const CSRF_COOKIE = '__Host-edr_csrf';

const durationMs = (value, fallback) => {
    const match = /^(\d+)(s|m|h|d)$/i.exec(String(value || ''));
    if (!match) return fallback;
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return Number(match[1]) * units[match[2].toLowerCase()];
};

const config = {
    accessTtlMs: durationMs(process.env.ACCESS_TOKEN_TTL, 10 * 60000),
    webIdleTtlMs: durationMs(process.env.WEB_SESSION_IDLE_TTL, 30 * 60000),
    webAbsoluteTtlMs: durationMs(process.env.WEB_SESSION_ABSOLUTE_TTL, 8 * 3600000),
    mobileIdleTtlMs: durationMs(process.env.MOBILE_SESSION_IDLE_TTL, 7 * 86400000),
    mobileAbsoluteTtlMs: durationMs(process.env.MOBILE_SESSION_ABSOLUTE_TTL, 30 * 86400000),
    issuer: process.env.JWT_ISSUER || 'bc-dentistry-auth',
    audience: process.env.JWT_AUDIENCE || 'bc-dentistry-api',
    refreshPepper: process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_SECRET || '',
    metadataPepper: process.env.SESSION_METADATA_PEPPER || process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_SECRET || '',
};

const base64UrlSecret = () => crypto.randomBytes(32).toString('base64url');
const hash = (value, pepper = config.refreshPepper) => crypto.createHmac('sha256', pepper).update(String(value)).digest('hex');
const metadataHash = (value) => value ? hash(value, config.metadataPepper) : null;
const sqlDate = (date) => date.toISOString().slice(0, 23).replace('T', ' ');

const signingOptions = () => {
    const privateKey = process.env.JWT_PRIVATE_KEY_BASE64
        ? Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
        : null;
    if (privateKey) return { key: privateKey, algorithm: process.env.JWT_ALGORITHM || 'RS256' };
    if (process.env.NODE_ENV === 'production') return { key: null, algorithm: null };
    return { key: process.env.JWT_SECRET, algorithm: 'HS256' };
};

const verificationOptions = () => {
    const publicKey = process.env.JWT_PUBLIC_KEY_BASE64
        ? Buffer.from(process.env.JWT_PUBLIC_KEY_BASE64, 'base64').toString('utf8')
        : null;
    if (publicKey) return { key: publicKey, algorithms: [process.env.JWT_ALGORITHM || 'RS256'] };
    if (process.env.NODE_ENV === 'production') return { key: null, algorithms: [] };
    return { key: process.env.JWT_SECRET, algorithms: ['HS256'] };
};

const signAccessToken = (user, sessionID) => {
    const signing = signingOptions();
    if (!signing.key) throw Object.assign(new Error('Token signing key is not configured'), { code: 'AUTH_CONFIGURATION_ERROR', statusCode: 500 });
    return jwt.sign({
        sid: sessionID,
        role: user.role,
        organizationId: user.organizationId || null,
        worksAt: user.worksAt || null,
        specialty: user.specialty || null,
        blockchainID: user.blockchainID || null,
        mustChangePassword: Boolean(user.mustChangePassword),
        securityVersion: Number(user.securityVersion || 1),
        mfa: Boolean(user.mfa),
    }, signing.key, {
        algorithm: signing.algorithm,
        expiresIn: Math.floor(config.accessTtlMs / 1000),
        issuer: config.issuer,
        audience: config.audience,
        subject: String(user.id),
        jwtid: crypto.randomUUID(),
        keyid: process.env.JWT_ACTIVE_KID || 'primary',
        noTimestamp: false,
    });
};

const verifyAccessToken = (token) => {
    const verification = verificationOptions();
    if (!verification.key) throw Object.assign(new Error('Token verification key is not configured'), { code: 'AUTH_CONFIGURATION_ERROR', statusCode: 500 });
    const payload = jwt.verify(token, verification.key, {
        algorithms: verification.algorithms,
        issuer: config.issuer,
        audience: config.audience,
        clockTolerance: 5,
    });
    if (!payload.sub || !payload.sid || !payload.jti || !payload.exp) {
        throw Object.assign(new Error('Token is missing required claims'), { code: 'INVALID_TOKEN', statusCode: 403 });
    }
    payload.id = Number(payload.sub);
    return payload;
};

const sessionTtls = (clientType) => clientType === 'web'
    ? { idle: config.webIdleTtlMs, absolute: config.webAbsoluteTtlMs }
    : { idle: config.mobileIdleTtlMs, absolute: config.mobileAbsoluteTtlMs };

const createSession = async (connection, user, details) => {
    if (!config.refreshPepper) throw Object.assign(new Error('REFRESH_TOKEN_PEPPER is not configured'), { code: 'AUTH_CONFIGURATION_ERROR', statusCode: 500 });
    const now = new Date();
    const clientType = ['web', 'ios', 'android'].includes(details.clientType) ? details.clientType : 'web';
    const ttl = sessionTtls(clientType);
    const sessionID = crypto.randomUUID();
    const familyID = crypto.randomUUID();
    const tokenID = crypto.randomUUID();
    const refreshToken = base64UrlSecret();
    const csrfToken = clientType === 'web' ? base64UrlSecret() : null;
    const absoluteExpires = new Date(now.getTime() + ttl.absolute);
    const refreshExpires = absoluteExpires;
    const idleExpires = new Date(Math.min(now.getTime() + ttl.idle, absoluteExpires.getTime()));
    await connection.query(`INSERT INTO Auth_Session
        (Session_ID,User_ID,Client_Type,Device_Label,Token_Family_ID,Security_Version,Csrf_Token_Hash,Idle_Expires_At,Absolute_Expires_At,Created_IP_Hash,Last_IP_Hash,User_Agent_Hash)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [
        sessionID, user.id, clientType, details.deviceLabel || null, familyID, Number(user.securityVersion || 1),
        csrfToken ? hash(csrfToken) : null, sqlDate(idleExpires), sqlDate(absoluteExpires),
        metadataHash(details.ip), metadataHash(details.ip), metadataHash(details.userAgent),
    ]);
    await connection.query(`INSERT INTO Auth_Refresh_Token
        (Token_ID,Session_ID,Token_Hash,Expires_At) VALUES (?,?,?,?)`,
    [tokenID, sessionID, hash(refreshToken), sqlDate(refreshExpires)]);
    await connection.query(`INSERT INTO Auth_Session_Event
        (Session_ID,User_ID,Event_Type,Details) VALUES (?,?,?,?)`,
    [sessionID, user.id, 'SESSION_CREATED', JSON.stringify({ clientType, deviceLabel: details.deviceLabel || null })]);
    return { sessionID, accessToken: signAccessToken(user, sessionID), refreshToken, csrfToken, refreshExpires };
};

const cookie = (name, value, maxAge, httpOnly = true) => {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}`, 'SameSite=Strict'];
    parts.push('Secure');
    if (httpOnly) parts.push('HttpOnly');
    return parts.join('; ');
};

const setWebSessionCookies = (res, session) => {
    res.append('Set-Cookie', cookie(ACCESS_COOKIE, session.accessToken, config.accessTtlMs));
    res.append('Set-Cookie', cookie(REFRESH_COOKIE, session.refreshToken, session.refreshExpires.getTime() - Date.now()));
    // The double-submit CSRF token must be readable by the web client so it can
    // echo the value in X-CSRF-Token. It contains no session credential; the
    // access and refresh cookies remain HttpOnly. cookie() still enforces the
    // __Host- prefix requirements, Secure, SameSite=Strict, and Path=/.
    res.append('Set-Cookie', cookie(CSRF_COOKIE, session.csrfToken, session.refreshExpires.getTime() - Date.now(), false));
};

const clearWebSessionCookies = (res) => {
    for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
        res.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; Secure; SameSite=Strict${name === CSRF_COOKIE ? '' : '; HttpOnly'}`);
    }
};

const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
}));

module.exports = {
    ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE, config, hash, metadataHash, sqlDate, sessionTtls,
    signAccessToken, verifyAccessToken, createSession, setWebSessionCookies, clearWebSessionCookies, parseCookies,
    base64UrlSecret,
};
