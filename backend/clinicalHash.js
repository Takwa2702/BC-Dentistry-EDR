const crypto = require('node:crypto');

const canonicalizeJson = (value) => {
    if (Array.isArray(value)) return value.map(canonicalizeJson);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalizeJson(value[key])]));
    }
    return value;
};

const clinicalHash = (payload) => crypto.createHash('sha256')
    .update(JSON.stringify(canonicalizeJson(payload)))
    .digest('hex');

module.exports = { canonicalizeJson, clinicalHash };
