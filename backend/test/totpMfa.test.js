const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
process.env.MFA_SECRET_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const service = require('../totpService');

test('TOTP matches RFC 6238 SHA-1 vectors', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(service.totpAt(secret, 59000, 30, 8), '94287082');
  assert.equal(service.totpAt(secret, 1111111109000, 30, 8), '07081804');
});
test('Google Authenticator URI and bounded clock skew work', () => {
  const secret = service.generateSecret(); const now = 1760000000000;
  assert.match(service.provisioningUri({ secret, email: 'admin@example.test' }), /^otpauth:\/\/totp\/EDR%3Aadmin%40example\.test\?/);
  assert.equal(service.verifyTotp(secret, service.totpAt(secret, now), { timestamp: now }), true);
  assert.equal(service.verifyTotp(secret, service.totpAt(secret, now - 30000), { timestamp: now }), true);
  assert.equal(service.matchingTotpStep(secret, service.totpAt(secret, now), { timestamp: now }), Math.floor(now / 30000));
});
test('secrets are authenticated-encrypted and recovery codes are one-way hashed', () => {
  const secret = service.generateSecret(); const encrypted = service.encryptSecret(secret);
  assert.equal(service.decryptSecret(encrypted), secret);
  const codes = service.generateRecoveryCodes();
  assert.equal(codes.length, 10); assert.equal(new Set(codes.map(service.hashRecoveryCode)).size, 10);
  assert.equal(service.hashRecoveryCode(codes[0]), service.hashRecoveryCode(codes[0].toLowerCase().replaceAll('-', '')));
});
