'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = fs.readFileSync(path.resolve(__dirname, '..', 'index.js'), 'utf8');

test('Fabric list routes aggregate bounded bookmark pages', () => {
  assert.match(api, /const FABRIC_QUERY_PAGE_SIZE = 100/);
  assert.match(api, /const FABRIC_QUERY_MAX_PAGES = 100/);
  assert.match(api, /seenBookmarks\.has\(nextBookmark\)/);
  for (const transaction of [
    'GetAllPatientsPage', 'GetPatientsByClinicPage', 'GetRequestsForAdminPage',
    'GetRequestsForDoctorPage', 'GetPendingRequestsForPatientPage',
    'GetProcessedRequestsForPatientPage', 'GetAllRequestsForPatientPage',
  ]) {
    assert.match(api, new RegExp(`evaluateAllFabricPages\\(\\s*contract,\\s*'${transaction}'`));
  }
  assert.doesNotMatch(api, /evaluateTransaction\('(GetAllPatients|GetPatientsByClinic|GetRequestsForAdmin|GetRequestsForDoctor|GetPendingRequestsForPatient|GetProcessedRequestsForPatient|GetAllRequestsForPatient)'/);
});

test('clinic deactivation follows all returned bookmark streams', () => {
  assert.match(api, /submitClinicDeactivationBatches/);
  assert.match(api, /'DeactivateClinicActors'[\s\S]*bookmarks\.doctor[\s\S]*bookmarks\.patient[\s\S]*bookmarks\.originRequest[\s\S]*bookmarks\.requestingRequest/);
  assert.match(api, /result\.complete === true \|\| !Object\.values\(bookmarks\)\.some\(Boolean\)/);
});

test('system-only query-index backfill repeats until complete', () => {
  assert.match(api, /app\.post\('\/internal\/indexes\/backfill', authenticateToken, requireRoles\('system'\)/);
  assert.match(api, /submitQueryIndexBackfill/);
  assert.match(api, /'BackfillQueryIndexes', String\(FABRIC_QUERY_PAGE_SIZE\), bookmark/);
  assert.match(api, /result\.complete === true \|\| !nextBookmark/);
});
