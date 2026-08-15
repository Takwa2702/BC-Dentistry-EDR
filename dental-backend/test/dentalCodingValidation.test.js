const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const api = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
const coding = require(path.join(root, 'backend', 'dentalCoding.js'));
const codingSource = fs.readFileSync(path.join(root, 'backend', 'dentalCoding.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Patient', 'ClinicalRecords.jsx'), 'utf8');

test('API enforces explicit FDI tooth and dental-surface allowlists', () => {
  assert.throws(() => coding.normalizeDentalCoding({ site:0 }), (error) => error.code === 'INVALID_DENTAL_TOOTH' && /two-digit FDI/.test(error.message));
  assert.throws(() => coding.normalizeDentalCoding({ Site:99, Suf:'M' }), (error) => error.code === 'INVALID_DENTAL_TOOTH');
  assert.throws(() => coding.normalizeDentalCoding({ teeth:['11'], surfaces:['@'] }), (error) => error.code === 'INVALID_DENTAL_SURFACE' && /Allowed values/.test(error.message));
  assert.throws(() => coding.normalizeDentalCoding({ teeth:['11#'], surfaces:['M'] }), (error) => error.code === 'INVALID_DENTAL_TOOTH');
  assert.throws(() => coding.normalizeDentalCoding({ teeth:['11'], Site:'99', surfaces:['M'] }), (error) => error.code === 'DENTAL_CODING_CONFLICT');
  assert.match(codingSource, /DENTAL_TOOTH_REQUIRED/);
  assert.match(codingSource, /DENTAL_SURFACE_REQUIRED/);
  assert.match(codingSource, /DENTAL_SURFACE_CONFLICT/);
  assert.match(codingSource, /teeth:\[\.\.\.new Set\(teeth\)\]\.sort/);
  assert.match(codingSource, /surfaces:\[\.\.\.new Set\(surfaces\)\]\.sort/);
});

test('legacy valid singular tooth input normalizes to whole-tooth coding', () => {
  assert.deepEqual(coding.normalizeDentalCoding({ Site:11 }).teeth, ['11']);
  assert.deepEqual(coding.normalizeDentalCoding({ Site:11 }).surfaces, ['W']);
});

test('doctor UI uses searchable multi-selects instead of free text coding', () => {
  assert.match(ui, /import Select from 'react-select'/);
  assert.match(ui, /isMulti isSearchable required/);
  assert.match(ui, /Teeth \(FDI notation\)/);
  assert.match(ui, /Whole tooth/);
  assert.match(ui, /Select at least one tooth and one surface/);
  assert.match(ui, /exactly 2 characters/);
  assert.match(ui, /Surfaces accept only W, M, D, O, I, B, L, P or F/);
});
