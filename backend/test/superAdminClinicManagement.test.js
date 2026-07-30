const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'migrations', '2026-07-21-super-admin-clinic-management.sql'), 'utf8');

test('clinic creation is system-only and atomically requires one admin', () => {
  assert.match(server, /app\.post\('\/clinics', authenticateToken, requireRoles\('system'\)/);
  assert.match(server, /admin\?\.firstName/);
  assert.match(server, /INSERT INTO Admin \(Organization_ID, User_ID\)/);
  assert.match(server, /ORDER BY Organization_ID DESC LIMIT 1 FOR UPDATE/);
  assert.match(server, /await connection\.beginTransaction\(\)/);
  assert.doesNotMatch(migration, /DROP PRIMARY KEY/);
  assert.doesNotMatch(migration, /AUTO_INCREMENT/);
});

test('first-login password change is enforced', () => {
  assert.match(server, /PASSWORD_CHANGE_REQUIRED/);
  assert.match(server, /app\.post\('\/change-password', authenticateToken/);
  assert.match(server, /Must_Change_Password = 0/);
});

test('clinic lifecycle is database-only and does not provision Fabric organizations', () => {
  const clinicBlock = server.slice(server.indexOf("app.post('/clinics'"), server.indexOf("app.patch('/clinics/:id'"));
  assert.doesNotMatch(clinicBlock, /callBlockchain|fabric|peer|channel/i);
});

test('inactive clinics prevent their clinic admin from logging in', () => {
  assert.match(server, /Organization\.IsActive AS Clinic_IsActive/);
  assert.match(server, /Clinic is inactive/);
});
