const admin = require('firebase-admin');
const mysql = require('mysql2/promise');

let firebaseApp;
let pool;
let schemaReady;

const normalizeRole = (value) => String(value || '').trim().toLowerCase();
const normalizePlatform = (value) => String(value || '').trim().toLowerCase();

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

const ensureSchema = async () => {
    if (!schemaReady) {
        schemaReady = getPool().execute(`
            CREATE TABLE IF NOT EXISTS Push_Subscription (
                Push_Subscription_ID BIGINT NOT NULL AUTO_INCREMENT,
                Recipient_Role VARCHAR(32) NOT NULL,
                Recipient_ID VARCHAR(255) NOT NULL,
                Platform ENUM('web', 'android', 'ios') NOT NULL,
                Push_Token VARCHAR(512) NOT NULL,
                Device_Label VARCHAR(255) NULL,
                Active BOOLEAN NOT NULL DEFAULT TRUE,
                Created_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                Updated_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                Last_Error VARCHAR(500) NULL,
                PRIMARY KEY (Push_Subscription_ID),
                UNIQUE KEY uq_push_token (Push_Token),
                KEY idx_push_recipient (Recipient_Role, Recipient_ID, Active)
            )
        `).catch((error) => {
            schemaReady = undefined;
            throw error;
        });
    }
    return schemaReady;
};

const getFirebaseApp = () => {
    if (firebaseApp !== undefined) return firebaseApp;

    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            && !process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
            && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            firebaseApp = null;
            return firebaseApp;
        }
        const inlineCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            || (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
                ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
                : '');
        const options = inlineCredentials
            ? { credential: admin.credential.cert(JSON.parse(inlineCredentials)) }
            : { credential: admin.credential.applicationDefault() };
        if (process.env.FIREBASE_PROJECT_ID) options.projectId = process.env.FIREBASE_PROJECT_ID;
        firebaseApp = admin.apps.length ? admin.app() : admin.initializeApp(options);
    } catch (error) {
        firebaseApp = null;
        console.warn(`Firebase push is disabled: ${error.message}`);
    }
    return firebaseApp;
};

const pushStatus = () => ({
    configured: Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
        || process.env.GOOGLE_APPLICATION_CREDENTIALS
    ),
    projectId: process.env.FIREBASE_PROJECT_ID || null,
});

const registerPushSubscription = async ({ role, recipientID, platform, token, deviceLabel }) => {
    const normalizedRole = normalizeRole(role);
    const normalizedPlatform = normalizePlatform(platform);
    if (!['admin', 'doctor', 'patient'].includes(normalizedRole)) throw new Error('Unsupported push recipient role');
    if (!['web', 'android', 'ios'].includes(normalizedPlatform)) throw new Error('Unsupported push platform');
    if (!recipientID || !token) throw new Error('Recipient identity and push token are required');

    await ensureSchema();
    const [existingRows] = await getPool().execute(
        'SELECT Push_Subscription_ID,Active FROM Push_Subscription WHERE Push_Token=? LIMIT 1',
        [String(token)]
    );
    const [result] = await getPool().execute(
        `INSERT INTO Push_Subscription
            (Recipient_Role, Recipient_ID, Platform, Push_Token, Device_Label, Active, Last_Error)
         VALUES (?, ?, ?, ?, ?, TRUE, NULL)
         ON DUPLICATE KEY UPDATE
            Push_Subscription_ID = LAST_INSERT_ID(Push_Subscription_ID),
            Recipient_Role = VALUES(Recipient_Role),
            Recipient_ID = VALUES(Recipient_ID),
            Platform = VALUES(Platform),
            Device_Label = VALUES(Device_Label),
            Active = TRUE,
            Last_Error = NULL`,
        [normalizedRole, String(recipientID), normalizedPlatform, String(token), deviceLabel ? String(deviceLabel) : null]
    );
    const existed = existingRows.length > 0;
    const reactivated = existed && !Boolean(existingRows[0].Active);
    return { subscriptionID:result.insertId, existing:existed && !reactivated, reactivated, created:!existed };
};

const unregisterPushSubscription = async ({ role, recipientID, token }) => {
    await ensureSchema();
    await getPool().execute(
        `UPDATE Push_Subscription
         SET Active = FALSE
         WHERE Recipient_Role = ? AND Recipient_ID = ? AND Push_Token = ?`,
        [normalizeRole(role), String(recipientID), String(token)]
    );
};

const listPushSubscriptions = async ({ role, recipientID }) => {
    await ensureSchema();
    const [subscriptions] = await getPool().execute(
        `SELECT
            Push_Subscription_ID AS id,
            Platform AS platform,
            Device_Label AS deviceLabel,
            Active AS active,
            Created_At AS createdAt,
            Updated_At AS updatedAt
         FROM Push_Subscription
         WHERE Recipient_Role = ? AND Recipient_ID = ? AND Active = TRUE
         ORDER BY Updated_At DESC`,
        [normalizeRole(role), String(recipientID)]
    );
    return subscriptions.map((subscription) => ({ ...subscription, active: Boolean(subscription.active) }));
};

const removePushSubscription = async ({ role, recipientID, subscriptionID }) => {
    await ensureSchema();
    const [result] = await getPool().execute(
        `UPDATE Push_Subscription
         SET Active = FALSE
         WHERE Push_Subscription_ID = ? AND Recipient_Role = ? AND Recipient_ID = ?`,
        [Number(subscriptionID), normalizeRole(role), String(recipientID)]
    );
    return result.affectedRows > 0;
};

const pruneStaleSubscriptions = async (staleDays = Number(process.env.PUSH_TOKEN_STALE_DAYS || 60)) => {
    await ensureSchema();
    const safeDays = Math.max(1, Math.floor(Number(staleDays) || 60));
    const [result] = await getPool().execute(
        `UPDATE Push_Subscription
         SET Active = FALSE, Last_Error = 'stale-registration'
         WHERE Active = TRUE AND Updated_At < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`,
        [safeDays]
    );
    return result.affectedRows;
};

const invalidTokenCodes = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
]);

const sendPushNotification = async ({ role, recipientID, title, body, data = {} }) => {
    const app = getFirebaseApp();
    if (!app) return { delivered: 0, failed: 0, skipped: 'firebase-not-configured' };

    await ensureSchema();
    const [subscriptions] = await getPool().execute(
        `SELECT Push_Token
         FROM Push_Subscription
         WHERE Recipient_Role = ? AND Recipient_ID = ? AND Active = TRUE`,
        [normalizeRole(role), String(recipientID)]
    );
    if (!subscriptions.length) return { delivered: 0, failed: 0, skipped: 'no-active-subscriptions' };

    const tokens = subscriptions.map(({ Push_Token }) => Push_Token);
    const stringData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, String(value)])
    );
    const webBaseUrl = String(process.env.WEB_APP_URL || 'http://localhost:5173').replace(/\/$/, '');
    const webLink = `${webBaseUrl}${stringData.deepLink?.startsWith('/') ? stringData.deepLink : '/'}`;
    const response = await admin.messaging(app).sendEachForMulticast({
        tokens,
        notification: { title: String(title), body: String(body) },
        data: stringData,
        webpush: {
            fcmOptions: { link: webLink },
        },
        android: { notification: { clickAction: 'OPEN_NOTIFICATION' } },
        apns: { payload: { aps: { sound: 'default' } } },
    });

    await Promise.all(response.responses.map(async (result, index) => {
        if (result.success) return;
        const token = tokens[index];
        const code = result.error?.code || 'messaging/unknown-error';
        await getPool().execute(
            `UPDATE Push_Subscription
             SET Active = ?, Last_Error = ?
             WHERE Push_Token = ?`,
            [invalidTokenCodes.has(code) ? false : true, String(code).slice(0, 500), token]
        );
    }));

    return { delivered: response.successCount, failed: response.failureCount };
};

module.exports = {
    pushStatus,
    registerPushSubscription,
    unregisterPushSubscription,
    listPushSubscriptions,
    removePushSubscription,
    pruneStaleSubscriptions,
    sendPushNotification,
};
