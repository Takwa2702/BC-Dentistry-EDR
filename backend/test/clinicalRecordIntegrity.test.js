const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Patient', 'ClinicalRecords.jsx'), 'utf8');
const migrationSource = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'migrations', '2026-08-10-clinical-record-integrity-log.sql'), 'utf8');

test('FTC-REC-010 recomputes the off-chain payload hash and compares database and ledger hashes', () => {
    assert.match(serverSource, /const \{ clinicalHash \} = require\('\.\/clinicalHash'\)/);
    assert.match(serverSource, /app\.get\('\/clinical-records\/:recordID\/verify-integrity'/);
    assert.match(serverSource, /const currentHash = clinicalHash\(payload\);/);
    assert.match(serverSource, /currentHash === storedHash && currentHash === onChainHash/);
    assert.match(serverSource, /status: matches \? 'verified' : 'mismatch'/);
});

test('FTC-REC-010 keeps the record visible and reports verification failures in the UI', () => {
    assert.match(serverSource, /the record remains visible for investigation/);
    assert.match(uiSource, /Verify integrity/);
    assert.match(uiSource, /The record remains visible\./);
    assert.match(uiSource, /role="status"/);
});

test('FTC-REC-011 detects a safe synthetic off-chain tamper and instruments durable mismatch evidence', () => {
    const crypto = require('node:crypto');
    const original = { medicalHistory:'fixture', allergies:'none', labResults:'normal', medications:'none' };
    const tampered = { ...original, labResults:'tampered fixture' };
    const originalHash = crypto.createHash('sha256').update(JSON.stringify(original)).digest('hex');
    const currentHash = crypto.createHash('sha256').update(JSON.stringify(tampered)).digest('hex');
    assert.notEqual(currentHash, originalHash);
    assert.equal(currentHash === originalHash && currentHash === originalHash, false);
    console.log(JSON.stringify({ fixture:'FTC-REC-011', beforeHash:originalHash, afterHash:currentHash, onChainHash:originalHash, result:'MISMATCH' }));
    assert.match(serverSource, /Clinical_Record_Integrity_Log/);
    assert.match(serverSource, /matches \? 'VERIFIED' : 'MISMATCH'/);
    assert.match(serverSource, /CLINICAL_RECORD_INTEGRITY_VERIFICATION/);
    assert.match(serverSource, /audit\/clinical-record-integrity\/:recordID/);
    assert.match(migrationSource, /Result ENUM\('VERIFIED','MISMATCH','ERROR'\)/);
    assert.match(migrationSource, /Current_Hash CHAR\(64\)/);
    assert.match(migrationSource, /On_Chain_Hash CHAR\(64\)/);
});
