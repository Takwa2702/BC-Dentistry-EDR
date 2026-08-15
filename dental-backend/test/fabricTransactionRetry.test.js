'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isMvccReadConflict, submitWithMvccRetry } = require('../fabricTransactionRetry');

const mvccError = () => Object.assign(new Error('Commit failed with status MVCC_READ_CONFLICT'), {
    transactionCode: 'MVCC_READ_CONFLICT',
});

const contractWithOutcomes = (outcomes) => {
    const transactionIds = [];
    let created = 0;
    return {
        transactionIds,
        createTransaction(operation) {
            created += 1;
            const transactionId = `${operation}-tx-${created}`;
            transactionIds.push(transactionId);
            return {
                getTransactionId: () => transactionId,
                submit: async () => {
                    const outcome = outcomes.shift();
                    if (outcome instanceof Error) throw outcome;
                    return outcome;
                },
            };
        },
    };
};

const captureLogger = () => {
    const entries = [];
    return {
        entries,
        warn: (line) => entries.push(JSON.parse(line)),
        error: (line) => entries.push(JSON.parse(line)),
        info: (line) => entries.push(JSON.parse(line)),
    };
};

test('recognizes only MVCC read conflicts as retryable', () => {
    assert.equal(isMvccReadConflict(mvccError()), true);
    assert.equal(isMvccReadConflict(new Error('status MVCC_READ_CONFLICT')), true);
    assert.equal(isMvccReadConflict(new Error('ENDORSEMENT_POLICY_FAILURE')), false);
});

test('MVCC conflict retries with a fresh transaction and logs the final transaction ID', async () => {
    const contract = contractWithOutcomes([mvccError(), Buffer.from('committed')]);
    const logger = captureLogger();
    const delays = [];
    const result = await submitWithMvccRetry(
        contract,
        'assignPatientToDoctor',
        ['Patient-secret', 'Doctor-secret'],
        { correlationId: 'reconciliation-123', actorRole: 'admin', clinicId: 2 },
        {
            maxAttempts: 3,
            baseDelayMs: 100,
            random: () => 0.5,
            sleep: async (delayMs) => delays.push(delayMs),
            logger,
            now: () => new Date('2026-08-10T07:22:20.969Z'),
        },
    );

    assert.equal(result.toString(), 'committed');
    assert.deepEqual(contract.transactionIds, ['assignPatientToDoctor-tx-1', 'assignPatientToDoctor-tx-2']);
    assert.deepEqual(delays, [100]);
    assert.equal(logger.entries[0].event, 'FABRIC_TRANSACTION_RETRY');
    assert.equal(logger.entries[0].transactionId, 'assignPatientToDoctor-tx-1');
    assert.equal(logger.entries[1].event, 'FABRIC_TRANSACTION_COMMITTED_AFTER_RETRY');
    assert.equal(logger.entries[1].transactionId, 'assignPatientToDoctor-tx-2');
    assert.equal(logger.entries[1].correlationId, 'reconciliation-123');
    assert.equal(logger.entries[1].clinicId, '2');

    const serializedLogs = JSON.stringify(logger.entries);
    assert.doesNotMatch(serializedLogs, /Patient-secret|Doctor-secret/);
    assert.doesNotMatch(serializedLogs, /token|certificate|wallet|clinical/i);
});

test('non-MVCC errors fail immediately without retry logging', async () => {
    const error = new Error('ENDORSEMENT_POLICY_FAILURE');
    const contract = contractWithOutcomes([error, Buffer.from('must-not-run')]);
    const logger = captureLogger();

    await assert.rejects(
        submitWithMvccRetry(contract, 'UpdatePatientMetadata', [], {}, { logger, sleep: async () => {} }),
        error,
    );
    assert.equal(contract.transactionIds.length, 1);
    assert.deepEqual(logger.entries, []);
});

test('retry exhaustion logs the failed outcome and rethrows the Fabric error', async () => {
    const finalError = mvccError();
    const contract = contractWithOutcomes([mvccError(), mvccError(), finalError]);
    const logger = captureLogger();

    await assert.rejects(
        submitWithMvccRetry(contract, 'addDoctor', [], {}, {
            maxAttempts: 3,
            baseDelayMs: 0,
            sleep: async () => {},
            logger,
        }),
        finalError,
    );
    assert.equal(contract.transactionIds.length, 3);
    assert.equal(logger.entries.at(-1).event, 'FABRIC_TRANSACTION_RETRY_EXHAUSTED');
    assert.equal(logger.entries.at(-1).outcome, 'failed');
    assert.equal(logger.entries.at(-1).attempt, 3);
});
