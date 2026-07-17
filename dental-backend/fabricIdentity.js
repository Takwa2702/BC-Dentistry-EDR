'use strict';

const normalizeRole = (role) => String(role || '')
    .trim().toLowerCase().replace(/[\s_-]+/g, '');

const fabricIdentityForUser = (user = {}) => {
    const role = normalizeRole(user.role);

    if ((role === 'admin' || role === 'administrator') && user.organizationId) {
        return `admin-${user.organizationId}`;
    }
    if (role === 'system' || role === 'sysadmin') {
        return 'role-system';
    }
    if ((role === 'doctor' || role === 'patient') && user.blockchainID) {
        return `${role}-${user.blockchainID}`;
    }

    const error = new Error('No user-specific Fabric identity is mapped to this JWT.');
    error.statusCode = 403;
    throw error;
};

module.exports = { fabricIdentityForUser };
