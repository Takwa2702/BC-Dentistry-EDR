const crypto = require('crypto');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const encodeBase32 = (buffer) => {
    let bits = '';
    for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
    let output = '';
    for (let index = 0; index < bits.length; index += 5) output += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
    return output;
};
const decodeBase32 = (value) => {
    const normalized = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = '';
    for (const character of normalized) {
        const index = ALPHABET.indexOf(character);
        if (index < 0) throw new Error('Invalid base32 secret');
        bits += index.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
    return Buffer.from(bytes);
};
const generateSecret = () => encodeBase32(crypto.randomBytes(20));
const totpAt = (secret, timestamp = Date.now(), period = 30, digits = 6) => {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(Math.floor(timestamp / 1000 / period)));
    const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(message).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    return String((digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).padStart(digits, '0');
};
const matchingTotpStep = (secret, token, options = {}) => {
    const candidate = String(token || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(candidate)) return null;
    const now = options.timestamp ?? Date.now();
    for (let step = -(options.window ?? 1); step <= (options.window ?? 1); step += 1) {
        const expected = totpAt(secret, now + step * 30000);
        if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))) return Math.floor(now / 1000 / 30) + step;
    }
    return null;
};
const verifyTotp = (secret, token, options = {}) => matchingTotpStep(secret, token, options) !== null;
const provisioningUri = ({ secret, email, issuer = 'EDR' }) => `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
const encryptionKey = () => {
    const key = Buffer.from(process.env.MFA_SECRET_ENCRYPTION_KEY || '', 'base64');
    if (key.length !== 32) throw Object.assign(new Error('MFA_SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key'), { code: 'MFA_CONFIGURATION_ERROR', statusCode: 500 });
    return key;
};
const encryptSecret = (secret) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return { ciphertext, iv, tag: cipher.getAuthTag() };
};
const decryptSecret = ({ ciphertext, iv, tag }) => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};
const generateRecoveryCodes = (count = 10) => Array.from({ length: count }, () => {
    const value = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12)}`;
});
const hashRecoveryCode = (value) => crypto.createHash('sha256').update(String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()).digest('hex');

module.exports = { generateSecret, totpAt, verifyTotp, matchingTotpStep, provisioningUri, encryptSecret, decryptSecret, generateRecoveryCodes, hashRecoveryCode };
