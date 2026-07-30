const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');
const chaincode = fs.readFileSync(path.resolve(__dirname, '..', '..', 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');
const webRequests = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'Pages', 'DataRequests.jsx'), 'utf8');
const webRequestForm = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Patients', 'RequestPatientCard.jsx'), 'utf8');
const mobileRequests = fs.readFileSync(path.resolve(__dirname, '..', '..', 'BC-Dentistry-Mobile-App', 'app', '(tabs)', 'requests.jsx'), 'utf8');
const mobileApproved = fs.readFileSync(path.resolve(__dirname, '..', '..', 'BC-Dentistry-Mobile-App', 'app', 'proceedRequests.jsx'), 'utf8');

test('access requests capture who, what, when, why, and notify admins', () => {
  assert.match(api, /requireFields\(req\.body, \['doctorID', 'patientID', 'dataOriginClinicID', 'dataType', 'purpose'\]\)/);
  assert.match(api, /'RequestDataAccess'[\s\S]*String\(req\.body\.dataType\)[\s\S]*String\(req\.body\.purpose\)[\s\S]*JSON\.stringify\(accessRequestDetails\(req\.body\)\)/);
  assert.match(chaincode, /async RequestDataAccess\(ctx, doctorID, patientID, dataOriginClinicID, dataType, purpose, detailsJson\)/);
  assert.match(chaincode, /dataType = dataType \|\| 'Dental and Medical Records'/);
  assert.match(chaincode, /purpose = purpose \|\| 'clinical consultation'/);
  assert.match(chaincode, /requestedAt/);
  assert.match(chaincode, /purpose: String\(purpose/);
  assert.match(chaincode, /ACCESS_REQUEST_PENDING_ADMIN/);
  assert.match(webRequestForm, /dataType/);
  assert.match(webRequestForm, /purpose/);
  assert.match(webRequestForm, /notes/);
});

test('admin and patient decisions create notifications and support revocation', () => {
  assert.match(chaincode, /ACCESS_REQUEST_PENDING_PATIENT/);
  assert.match(chaincode, /consentTxID/);
  assert.match(chaincode, /consentMSPID/);
  assert.match(chaincode, /async RevokeConsent\(ctx, patientID, requestID, revocationReason\)/);
  assert.match(chaincode, /revocationReason = revocationReason \|\| 'Patient revoked consent'/);
  assert.match(chaincode, /CONSENT_REVOKED/);
  assert.match(chaincode, /ACCESS_REQUEST_CONSENT_REVOKED/);
  assert.match(api, /app\.post\('\/patient\/revokeConsent'/);
  assert.match(api, /submitTransaction\(\s*'RevokeConsent'/);
  assert.match(mobileApproved, /revokeConsent/);
  assert.match(mobileApproved, /\/patient\/revokeConsent/);
});

test('notification and audit APIs are exposed to authenticated owners', () => {
  assert.match(chaincode, /async GetNotificationsForActor\(ctx, recipientRole, recipientID, statusFilter\)/);
  assert.match(chaincode, /statusFilter = statusFilter \|\| 'ALL'/);
  assert.match(chaincode, /async MarkNotificationRead/);
  assert.match(api, /app\.get\('\/notifications'/);
  assert.match(api, /app\.post\('\/notifications\/:notificationID\/read'/);
  assert.match(chaincode, /accessBasis/);
  assert.match(chaincode, /requestID/);
  assert.match(api, /\/audit\/clinical-access\/:patientID/);
  assert.match(webRequests, /Access Audit/);
  assert.match(webRequests, /audit\/clinical-access/);
});

test('patient-facing request details are sourced from request data', () => {
  assert.match(mobileRequests, /request\.purpose \|\| request\.reason \|\| request\.dataType/);
  assert.match(mobileRequests, /request\.requestedAt/);
  assert.match(webRequests, /Purpose:/);
  assert.doesNotMatch(webRequests, /DataRequestsData/);
});
