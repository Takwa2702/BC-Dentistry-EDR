const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sha256File, verifyFileIntegrity } = require('../radiographicIntegrity');
const { validateRadiographicFile } = require('../radiographicFileValidation');

const dicomBytes = () => Buffer.concat([Buffer.alloc(128), Buffer.from('DICM'), Buffer.from('test data')]);

test('radiographic upload validation accepts only matching DICOM, JPEG, and PNG content', () => {
  assert.deepEqual(validateRadiographicFile({ bytes: dicomBytes(), fileName: 'scan.dcm', mediaType: 'application/dicom' }),
    { valid: true, format: 'dicom', mediaType: 'application/dicom' });
  assert.equal(validateRadiographicFile({ bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), fileName: 'x.jpg', mediaType: 'image/jpeg' }).valid, true);
  assert.equal(validateRadiographicFile({ bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), fileName: 'x.png', mediaType: 'image/png' }).valid, true);
});

test('radiographic upload validation rejects executables and spoofed metadata', () => {
  const executable = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(256)]);
  assert.equal(validateRadiographicFile({ bytes: executable, fileName: 'test.exe', mediaType: 'application/octet-stream' }).valid, false);
  assert.equal(validateRadiographicFile({ bytes: executable, fileName: 'test.dcm', mediaType: 'application/dicom' }).valid, false);
  assert.equal(validateRadiographicFile({ bytes: dicomBytes(), fileName: 'test.exe', mediaType: 'application/dicom' }).valid, false);
  assert.equal(validateRadiographicFile({ bytes: dicomBytes(), fileName: 'test.dcm', mediaType: 'image/png' }).valid, false);
});

test('corrupt DICOM returns a controlled, readable validation error', () => {
  const result = validateRadiographicFile({
    bytes: Buffer.from('not a readable DICOM file'),
    fileName: 'corrupt.dcm',
    mediaType: 'application/dicom',
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'CORRUPT_OR_UNREADABLE_DICOM');
  assert.match(result.reason, /corrupt, unreadable/);
});

test('upload hash generation and successful verification use SHA-256 file bytes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edr-dicom-'));
  const file = path.join(dir, 'scan.dcm');
  fs.writeFileSync(file, Buffer.from('DICOM test bytes'));
  const hash = await sha256File(file);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(await verifyFileIntegrity(file, hash), { status: 'verified', actualSha256: hash });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('verification detects mismatch, missing file, and unknown metadata', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edr-dicom-'));
  const file = path.join(dir, 'scan.dcm');
  fs.writeFileSync(file, 'changed bytes');
  assert.equal((await verifyFileIntegrity(file, '0'.repeat(64))).status, 'mismatch');
  fs.unlinkSync(file);
  assert.equal((await verifyFileIntegrity(file, '0'.repeat(64))).status, 'missing file');
  assert.equal((await verifyFileIntegrity(file, '')).status, 'unknown');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('upload, on-chain metadata and access routes are source guarded', () => {
  const api = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');
  const chaincode = fs.readFileSync(path.resolve(__dirname, '..', '..', 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');
  assert.match(api, /app\.post\('\/radiographic-files', authenticateToken, requireRoles\('doctor'\)/);
  assert.match(api, /submitTransaction\(\s*'AddDentalFileMetadata'/);
  assert.match(api, /storageReference: `filesystem:\$\{fileID\}`/);
  assert.match(chaincode, /_requirePatientRecordAccess\(ctx, patientID, patient, 'dicom', 'doctor'\)/);
  assert.match(chaincode, /sha256: sha256\.toLowerCase\(\)/);
  assert.match(chaincode, /CONTENT_REFERENCE_REQUIRED/);
  assert.match(chaincode, /normalizedReference !== `filesystem:\$\{normalizedFileID\}`/);
  const metadataTransaction = chaincode.match(/async AddDentalFileMetadata[\s\S]*?async addDentalFile/)[0];
  assert.doesNotMatch(metadataTransaction, /fileContent|fileBytes|base64/);
});

test('web proxy accepts normal DICOM study sizes without bypassing API validation', () => {
  const nginx = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'nginx.conf'), 'utf8');
  assert.match(nginx, /location \/api\/database\/ \{[\s\S]*client_max_body_size 512m;/);
  assert.match(nginx, /proxy_request_buffering off;/);
  assert.match(nginx, /proxy_read_timeout 300s;/);
});

test('authorized content streaming verifies integrity and refuses unsafe storage', () => {
  const api = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');
  assert.match(api, /app\.get\('\/radiographic-files\/:fileID\/content', authenticateToken, requireRoles\('doctor', 'patient'\)/);
  assert.match(api, /evaluateTransaction\('GetDentalFile', fileID\)/);
  assert.match(api, /verification\.status !== 'verified'/);
  assert.match(api, /INTEGRITY_CHECK_FAILED/);
  assert.match(api, /submitTransaction\('LogClinicalAccess', String\(metadata\.patientID\), 'radiographic'/);
  assert.match(api, /Cache-Control', 'private, no-store'/);
  assert.match(api, /X-Content-Type-Options', 'nosniff'/);
  assert.match(api, /fs\.createReadStream\(filePath\)/);
});
