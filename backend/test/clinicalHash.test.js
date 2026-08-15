const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalizeJson, clinicalHash } = require('../clinicalHash');

test('clinical hash is stable when MySQL JSON normalization reorders object keys', () => {
    const submitted = {
        medicalHistory: 'Synthetic integrity fixture',
        allergies: 'none',
        labResults: 'normal',
        medications: 'none',
        nested: { z: 1, a: 2 },
    };
    const mysqlNormalized = {
        allergies: 'none',
        labResults: 'normal',
        medicalHistory: 'Synthetic integrity fixture',
        medications: 'none',
        nested: { a: 2, z: 1 },
    };
    assert.deepEqual(canonicalizeJson(submitted), canonicalizeJson(mysqlNormalized));
    assert.equal(clinicalHash(submitted), clinicalHash(mysqlNormalized));
});

test('clinical hash still detects changed values and array order', () => {
    const original = { values: ['a', 'b'], result: 'normal' };
    assert.notEqual(clinicalHash(original), clinicalHash({ ...original, result: 'tampered' }));
    assert.notEqual(clinicalHash(original), clinicalHash({ ...original, values: ['b', 'a'] }));
});
