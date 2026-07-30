import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const login = fs.readFileSync(new URL('../src/assets/Sections/LoginSection.jsx', import.meta.url), 'utf8');
const clinics = fs.readFileSync(new URL('../src/assets/Pages/Clinics.jsx', import.meta.url), 'utf8');

test('system users have a protected clinic management route', () => {
  assert.match(app, /path="\/clinics"/);
  assert.match(app, /roles=\{\['system'\]\}/);
});

test('forced password change takes precedence after login', () => {
  assert.match(login, /user\.mustChangePassword \? '\/change-password'/);
});

test('clinic form requires the clinic and exactly one initial admin payload', () => {
  assert.match(clinics, /Required Clinic Admin/);
  assert.match(clinics, /Create clinic and admin/);
  assert.doesNotMatch(clinics, /Add another admin/);
});
