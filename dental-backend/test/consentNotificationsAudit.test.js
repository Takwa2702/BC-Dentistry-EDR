const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');
const chaincode = fs.readFileSync(path.resolve(__dirname, '..', '..', 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');
const webRequests = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'Pages', 'DataRequests.jsx'), 'utf8');
const patientWebRequests = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'Pages', 'PatientDataRequests.jsx'), 'utf8');
const mobileRequests = fs.readFileSync(path.resolve(__dirname, '..', '..', 'BC-Dentistry-Mobile-App', 'app', '(tabs)', 'requests.jsx'), 'utf8');
const mobileApproved = fs.readFileSync(path.resolve(__dirname, '..', '..', 'BC-Dentistry-Mobile-App', 'app', 'proceedRequests.jsx'), 'utf8');
const mobileRequestCard = fs.readFileSync(path.resolve(__dirname, '..', '..', 'BC-Dentistry-Mobile-App', 'components', 'DataRequest.jsx'), 'utf8');
const doctorRequest = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Patients', 'RequestDataAccessDialog.jsx'), 'utf8');
const applicationApi = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'server.js'), 'utf8');
const adminReview = fs.readFileSync(path.resolve(__dirname, '..', '..', 'bc-dentistry-frontend', 'src', 'assets', 'Sections', 'DataRequests', 'DataRequestsOrders.jsx'), 'utf8');

test('access requests capture who, what, when, why, and notify admins', () => {
  assert.match(api, /requireFields\(req\.body, \['doctorID', 'patientID', 'dataOriginClinicID', 'dataType', 'purpose', 'expiresAt'\]\)/);
  assert.match(api, /'RequestDataAccess'[\s\S]*String\(req\.body\.dataType\)[\s\S]*String\(req\.body\.purpose\)[\s\S]*JSON\.stringify\(accessRequestDetails\(req\.body\)\)/);
  assert.match(chaincode, /async RequestDataAccess\(ctx, doctorID, patientID, dataOriginClinicID, dataType, purpose, detailsJson\)/);
  assert.match(chaincode, /dataType = dataType \|\| 'Dental and Medical Records'/);
  assert.match(chaincode, /purpose = purpose \|\| 'clinical consultation'/);
  assert.match(chaincode, /requestedAt/);
  assert.match(chaincode, /purpose: String\(purpose/);
  assert.match(chaincode, /ACCESS_REQUEST_PENDING_ADMIN/);
  assert.match(api, /accessRequestDetails\(req\.body\)/);
  assert.match(applicationApi, /app\.post\(\['\/requestDataAccess', '\/requestAccess'\]/);
  assert.match(applicationApi, /doctorID:req\.user\.blockchainID/);
  assert.match(applicationApi, /INVALID_DATA_ORIGIN_CLINIC_ID|PATIENT_HAS_NO_DATA_IN_REQUESTED_CLINIC/);
  assert.match(doctorRequest, /databaseUrl\('\/requestDataAccess'\)/);
  assert.match(doctorRequest, /Find patient by/);
  assert.match(doctorRequest, /Patient identifier/);
  assert.match(doctorRequest, /patientLookupType/);
  assert.match(doctorRequest, /patientLookupValue/);
  assert.doesNotMatch(doctorRequest, /Patient blockchain ID/);
  assert.doesNotMatch(doctorRequest, /Data-origin clinic ID/);
  assert.match(doctorRequest, /Clinical purpose/);
  assert.match(doctorRequest, /Referral access expires/);
});

test('admin and patient decisions create notifications and support revocation', () => {
  assert.match(api, /response\.requestID !== requestID \|\| response\.status !== 'PENDING_PATIENT_CONSENT'/);
  assert.match(api, /response\.status !== 'REJECTED' \|\| response\.accessGranted !== false/);
  assert.match(applicationApi, /REJECTION_REASON_REQUIRED/);
  assert.match(chaincode, /accessGranted: false/);
  assert.match(chaincode, /cannot be rejected at this stage/);
  assert.match(chaincode, /requestID: request\.requestID,[\s\S]*status: request\.status,[\s\S]*adminApprovedAt: request\.adminApprovedAt/);
  assert.match(chaincode, /ACCESS_REQUEST_PENDING_PATIENT/);
  assert.match(chaincode, /consentTxID/);
  assert.match(chaincode, /decisionActorID/);
  assert.match(chaincode, /decisionActorRole/);
  assert.match(chaincode, /decisionTransactionID/);
  assert.match(chaincode, /decisionTimestamp/);
  assert.match(chaincode, /rejectionTxID/);
  assert.match(chaincode, /consentMSPID/);
  assert.match(chaincode, /request\.status = 'ACTIVE'/);
  assert.match(chaincode, /operationalOwnerChanged: false/);
  assert.match(chaincode, /async RevokeConsent\(ctx, patientID, requestID, revocationReason\)/);
  assert.match(chaincode, /revocationReason = revocationReason \|\| 'Patient revoked consent'/);
  assert.match(chaincode, /request\.status = 'REVOKED'/);
  assert.match(chaincode, /ACCESS_REQUEST_CONSENT_REVOKED/);
  assert.match(api, /app\.post\('\/patient\/revokeConsent'/);
  assert.match(api, /response\.status !== 'REVOKED' \|\| response\.accessGranted !== false/);
  assert.match(chaincode, /status: request\.status,[\s\S]*accessGranted: false,[\s\S]*revokedAt: request\.revokedAt/);
  assert.match(api, /notification\.recipientRole === 'patient' && notification\.relatedRequestID\) return `\/patient-requests/);
  assert.match(api, /submitTransaction\(\s*'RevokeConsent'/);
  assert.match(mobileRequestCard, /revokeConsent/);
  assert.match(mobileRequestCard, /\/patient\/revokeConsent/);
});

test('admin referral decisions remain visible and failures produce actionable notifications', () => {
  assert.match(webRequests, /requests=\{allRequests\}/);
  assert.match(webRequests, /requestState\.error/);
  assert.match(adminReview, /Previously loaded requests remain visible and unchanged/);
  assert.match(adminReview, /request\?\.status === 'PENDING_ADMIN_APPROVAL'/);
  assert.match(adminReview, /onApprove=\{\(\) => handleApproveRequest/);
  assert.match(adminReview, /onReject=\{\(\) =>/);
  assert.match(adminReview, /remains pending/);
  assert.match(adminReview, /role="alert"/);
  assert.doesNotMatch(adminReview, /setOnHoldRequests/);
});

test('direct patient reads and patient consent history use one protected ledger boundary', () => {
  assert.match(api, /\['\/getPatientByID\/:id', '\/readPatient\/:id'\].*authenticateToken.*requireRoles\('admin', 'doctor', 'patient', 'system'\).*requirePatientSelfParam\('id'\)/);
  assert.match(applicationApi, /\['\/getPatientByID\/:id', '\/readPatient\/:id'\].*authenticateToken.*requireRoles\('admin', 'doctor', 'patient'\)/);
  assert.match(chaincode, /async ReadPatient\(ctx, id\)[\s\S]*?_requirePatientRecordAccess\(ctx, id, patient, null, 'admin', 'doctor', 'patient', 'system'\)/);
  assert.match(api, /evaluateAllFabricPages\([\s\S]*?'GetAllRequestsForPatientPage'[\s\S]*?sendSuccess\(res, result\)/);
  assert.match(patientWebRequests, /Ledger decision evidence/);
  assert.match(patientWebRequests, /decisionTransactionID/);
  assert.match(patientWebRequests, /window\.addEventListener\('focus', refresh\)/);
});

test('referrals are scoped, expiring, and closable by the receiving doctor', () => {
  assert.match(chaincode, /workflowType: 'REFERRAL'/);
  assert.match(chaincode, /requestedRecordTypes/);
  assert.match(chaincode, /expiresAt/);
  assert.match(chaincode, /async CompleteReferral/);
  assert.match(chaincode, /request\.status = 'COMPLETED'/);
  assert.match(chaincode, /originClinicID:doctor\.clinicID/);
  assert.match(chaincode, /referralID:access\.requestID/);
  assert.match(api, /app\.post\('\/referrals\/:requestID\/complete'/);
  assert.match(applicationApi, /app\.post\('\/referrals\/:requestID\/complete'/);
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
  assert.match(chaincode, /status:'CONSENT_GRANTED', lifecycleStatus:'ACTIVE'/);
});
