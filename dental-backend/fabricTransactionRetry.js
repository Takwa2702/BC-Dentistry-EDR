'use strict';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 100;
const MAX_ATTEMPTS_LIMIT = 5;
const MAX_BASE_DELAY_MS = 2000;

const boundedInteger = (value, fallback, minimum, maximum) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
};

const isMvccReadConflict = (error) => {
    const code = String(error?.transactionCode || error?.code || '');
    const message = String(error?.message || error || '');
    return code === 'MVCC_READ_CONFLICT' || /\bMVCC_READ_CONFLICT\b/.test(message);
};

const safeContext = (context = {}) => ({
    correlationId: String(context.correlationId || 'fabric-operation'),
    actorRole: String(context.actorRole || 'system'),
    ...(context.clinicId === undefined || context.clinicId === null
        ? {}
        : { clinicId: String(context.clinicId) }),
});

const writeLog = (logger, level, entry) => {
    const method = typeof logger?.[level] === 'function' ? logger[level].bind(logger) : console[level].bind(console);
    method(JSON.stringify(entry));
};

const submitWithMvccRetry = async (contract, transactionName, args = [], context = {}, options = {}) => {
    const maxAttempts = boundedInteger(
        options.maxAttempts ?? process.env.FABRIC_MVCC_MAX_ATTEMPTS,
        DEFAULT_MAX_ATTEMPTS,
        1,
        MAX_ATTEMPTS_LIMIT,
    );
    const baseDelayMs = boundedInteger(
        options.baseDelayMs ?? process.env.FABRIC_MVCC_BASE_DELAY_MS,
        DEFAULT_BASE_DELAY_MS,
        0,
        MAX_BASE_DELAY_MS,
    );
    const logger = options.logger || console;
    const sleep = options.sleep || ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    const random = options.random || Math.random;
    const now = options.now || (() => new Date());
    const startedAt = Date.now();
    const logContext = safeContext(context);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const transaction = contract.createTransaction(transactionName);
        const transactionId = transaction.getTransactionId();
        try {
            const result = await transaction.submit(...args);
            if (attempt > 1) {
                writeLog(logger, 'info', {
                    timestamp: now().toISOString(),
                    level: 'info',
                    event: 'FABRIC_TRANSACTION_COMMITTED_AFTER_RETRY',
                    operation: transactionName,
                    transactionId,
                    attempt,
                    maxAttempts,
                    durationMs: Date.now() - startedAt,
                    outcome: 'committed',
                    ...logContext,
                });
            }
            return result;
        } catch (error) {
            if (!isMvccReadConflict(error)) throw error;

            const exhausted = attempt >= maxAttempts;
            const backoffMs = exhausted ? 0 : Math.round(baseDelayMs * (2 ** (attempt - 1)) * (0.5 + random()));
            writeLog(logger, exhausted ? 'error' : 'warn', {
                timestamp: now().toISOString(),
                level: exhausted ? 'error' : 'warn',
                event: exhausted ? 'FABRIC_TRANSACTION_RETRY_EXHAUSTED' : 'FABRIC_TRANSACTION_RETRY',
                operation: transactionName,
                transactionId,
                errorCode: 'MVCC_READ_CONFLICT',
                attempt,
                maxAttempts,
                backoffMs,
                durationMs: Date.now() - startedAt,
                outcome: exhausted ? 'failed' : 'retrying',
                ...logContext,
            });
            if (exhausted) throw error;
            await sleep(backoffMs);
        }
    }

    throw new Error('Fabric transaction retry loop exited unexpectedly');
};

module.exports = { isMvccReadConflict, submitWithMvccRetry };
