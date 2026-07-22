/*
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
    env: {
        node: true,
        mocha: true,
        es6: true
    },
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script'
    },
    extends: "eslint:recommended",
    // Keep the standard gate focused on correctness. Formatting is intentionally
    // handled separately so inherited whitespace does not mask executable tests.
    rules: {
        'no-console': 'off',
        'no-unused-vars': ['error', { args: 'none' }]
    }
};
