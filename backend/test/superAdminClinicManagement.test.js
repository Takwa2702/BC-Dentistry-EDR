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
  assert.match(server, /Must_Change_Password\s*=\s*0/);
  assert.match(server, /Security_Version\s*=\s*\?/);
  assert.match(server, /Revocation_Reason='password changed'/);
});

test('clinic lifecycle provisions a scoped admin identity without creating Fabric organizations', () => {
  const clinicBlock = server.slice(server.indexOf("app.post('/clinics'"), server.indexOf("app.patch('/clinics/:id'"));
  assert.match(clinicBlock, /provisionFabricIdentity\(req, 'admin', `AdminClinic\$\{clinicID\}`/);
  assert.doesNotMatch(clinicBlock, /createChannel|joinChannel|createOrganization/);
});

test('inactive clinics prevent their clinic admin from logging in', () => {
  assert.match(server, /Organization\.IsActive AS Clinic_IsActive/);
  assert.match(server, /Clinic is inactive/);
});

test('clinic administrator lifecycle is system-only, transactional, and revokes transferred ownership', () => {
  for (const route of [
    "app.patch('/clinics/:clinicID/admin'",
    "app.post('/clinics/:clinicID/admin/reset-password'",
    "app.post('/clinics/:clinicID/admin/transfer'",
    "app.get('/clinics/:clinicID/admin-history'",
  ]) assert.ok(server.includes(route), `missing ${route}`);
  assert.match(server, /CLINIC_ADMIN_TRANSFERRED/);
  assert.match(server, /clinic ownership transferred/);
  assert.match(server, /UPDATE Admin SET User_ID=\?/);
  assert.match(server, /UPDATE User SET IsActive=0,Security_Version=Security_Version\+1/);
  assert.match(server, /await connection\.rollback\(\)\.catch/);
});

test('clinic deactivation cancels active dependencies and preserves historical records', () => {
  assert.match(server, /app\.get\('\/clinics\/:id\/deactivation-impact'/);
  const route = server.match(/app\.patch\('\/clinics\/:id'[\s\S]*?\n\}\);/)[0];
  assert.match(route, /Appointment\.Status='cancelled'/);
  assert.match(route, /UPDATE Request SET Status='cancelled'/);
  assert.match(route, /Push_Subscription SET Active=0/);
  assert.match(route, /internal\/clinics\/\$\{clinicID\}\/deactivate/);
  assert.doesNotMatch(route, /DELETE FROM (Clinical_Record|Lab_Result|Patient|Doctor)/);
});
