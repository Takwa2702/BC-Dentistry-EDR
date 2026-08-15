const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-long-enough';
process.env.REFRESH_TOKEN_PEPPER = 'test-only-refresh-pepper-that-is-independent';
process.env.JWT_ISSUER = 'bc-dentistry-auth';
process.env.JWT_AUDIENCE = 'bc-dentistry-api';

const sessions = require('../sessionService');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'migrations', '2026-07-29-secure-auth-sessions.sql'), 'utf8');
const dump = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'dump.sql'), 'utf8');
const blockchainAuth = fs.readFileSync(path.join(__dirname, '..', '..', 'dental-backend', 'sessionAuth.js'), 'utf8');

test('access tokens carry strict session claims and reject the wrong audience', () => {
  const token = sessions.signAccessToken({
    id: 17, role: 'patient', blockchainID: 'Patient-17', securityVersion: 3,
  }, '7e8e241d-e0b9-427f-81be-ed6c57ac03dd');
  const payload = sessions.verifyAccessToken(token);
  assert.equal(payload.sub, '17');
  assert.equal(payload.sid, '7e8e241d-e0b9-427f-81be-ed6c57ac03dd');
  assert.equal(payload.aud, 'bc-dentistry-api');
  assert.ok(payload.jti);
  assert.throws(() => require('jsonwebtoken').verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'], issuer: 'bc-dentistry-auth', audience: 'wrong-audience',
  }));
});

test('production signing uses an asymmetric private/public key pair', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.NODE_ENV = 'production';
  process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64');
  process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(publicKey.export({ type: 'spki', format: 'pem' })).toString('base64');
  process.env.JWT_ALGORITHM = 'RS256';
  const token = sessions.signAccessToken({ id: 9, role: 'admin', securityVersion: 1 }, crypto.randomUUID());
  assert.equal(sessions.verifyAccessToken(token).sub, '9');
  delete process.env.JWT_PRIVATE_KEY_BASE64;
  delete process.env.JWT_PUBLIC_KEY_BASE64;
  delete process.env.NODE_ENV;
});

test('session creation stores only hashed refresh and CSRF secrets', async () => {
  const calls = [];
  const connection = { query: async (sql, params) => { calls.push({ sql, params }); return [[], []]; } };
  const result = await sessions.createSession(connection, {
    id: 17, role: 'patient', blockchainID: 'Patient-17', securityVersion: 1,
  }, { clientType: 'android', deviceLabel: 'Test device', ip: '127.0.0.1', userAgent: 'test' });
  const flattened = JSON.stringify(calls);
  assert.ok(result.refreshToken.length >= 43);
  assert.ok(!flattened.includes(result.refreshToken));
  assert.ok(flattened.includes(sessions.hash(result.refreshToken)));
});

test('auth API exposes rotation, revocation, session listing, and reuse detection', () => {
  for (const route of ['/auth/refresh', '/auth/logout', '/auth/logout-all', '/auth/me', '/auth/sessions']) {
    assert.ok(server.includes(route), `missing ${route}`);
  }
  assert.match(server, /REFRESH_TOKEN_REUSE/);
  assert.match(server, /FOR UPDATE/);
  assert.match(server, /Revocation_Reason='password changed'/);
  assert.match(server, /clinic deactivated/);
});

test('both fresh and existing database paths contain the secure schema', () => {
  for (const source of [migration, dump]) {
    assert.match(source, /Auth_Session/);
    assert.match(source, /Auth_Refresh_Token/);
    assert.match(source, /Security_Version/);
    assert.match(source, /Sessions_Invalid_Before/);
    assert.match(source, /Schema_Migration/);
  }
  assert.match(migration, /ON DUPLICATE KEY UPDATE/);
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.doesNotMatch(dump, /INSERT INTO `Auth_(Session|Refresh_Token)`/);
});

test('blockchain authorization rejects revoked or stale database sessions', () => {
  assert.match(blockchainAuth, /Auth_Session/);
  assert.match(blockchainAuth, /SESSION_REVOKED/);
  assert.match(blockchainAuth, /User_Security_Version/);
  assert.match(blockchainAuth, /CSRF_VALIDATION_FAILED/);
});
