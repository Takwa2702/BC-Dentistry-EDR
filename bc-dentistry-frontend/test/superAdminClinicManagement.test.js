import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const login = fs.readFileSync(new URL('../src/assets/Sections/LoginSection.jsx', import.meta.url), 'utf8');
const clinics = fs.readFileSync(new URL('../src/assets/Pages/Clinics.jsx', import.meta.url), 'utf8');
const labResults = fs.readFileSync(new URL('../src/assets/Pages/LabResults.jsx', import.meta.url), 'utf8');
const navbar = fs.readFileSync(new URL('../src/assets/Sections/Navbar.jsx', import.meta.url), 'utf8');

test('system users have a protected clinic management route', () => {
  assert.match(app, /path="\/clinics"/);
  assert.match(app, /roles=\{\['system'\]\}/);
});

test('lab results provide patient self-service and clinic-admin metadata notice', () => {
  assert.match(app, /roles=\{\['admin','doctor','patient'\]\}/);
  assert.match(navbar, /normalizedRole === 'patient'[\s\S]*Lab Results/);
  assert.match(labResults, /Operational metadata only/);
  assert.match(labResults, /doctor\/me\/assigned-patients/);
  assert.match(labResults, /No lab results have been recorded/);
});

test('forced password change takes precedence after login', () => {
  assert.match(login, /user\.mustChangePassword \? '\/change-password'/);
});

test('clinic form requires the clinic and exactly one initial admin payload', () => {
  assert.match(clinics, /Required Clinic Admin/);
  assert.match(clinics, /Create clinic and admin/);
  assert.doesNotMatch(clinics, /Add another admin/);
});

test('clinic page manages the current admin and supports guarded ownership transfer', () => {
  assert.match(clinics, /Manage admin/);
  assert.match(clinics, /Save administrator/);
  assert.match(clinics, /Reset password and revoke sessions/);
  assert.match(clinics, /Transfer ownership/);
  assert.match(clinics, /transferConfirmed/);
  assert.match(clinics, /current administrator will be deactivated and immediately signed out/);
  assert.match(clinics, /admin-history/);
});
