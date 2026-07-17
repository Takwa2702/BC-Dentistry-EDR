'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fabricIdentityForUser } = require('../fabricIdentity');

test('maps an admin JWT to its clinic-bound wallet identity', () => {
    assert.equal(fabricIdentityForUser({ role: 'Admin', organizationId: 2 }), 'admin-2');
});

test('maps doctor and patient JWTs to actor-bound wallet identities', () => {
    assert.equal(fabricIdentityForUser({ role: 'Doctor', blockchainID: 'Doctor1' }), 'doctor-Doctor1');
    assert.equal(fabricIdentityForUser({ role: 'Patient', blockchainID: 'Patient1' }), 'patient-Patient1');
});

test('maps a system JWT to the service identity', () => {
    assert.equal(fabricIdentityForUser({ role: 'System' }), 'role-system');
});

test('rejects JWT claims without required identity context', () => {
    assert.throws(
        () => fabricIdentityForUser({ role: 'Doctor' }),
        /No user-specific Fabric identity is mapped/
    );
});
