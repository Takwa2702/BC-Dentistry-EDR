const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const applicationApi = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
const chaincode = fs.readFileSync(path.join(root, 'fabric-samples', 'dental-record-sharing', 'chaincode-javascript', 'lib', 'dentalRecordSharing.js'), 'utf8');

test('duplicate patient assignment is idempotent across database API and ledger', () => {
  const routeStart = applicationApi.indexOf("app.post('/patients/:id/assign'");
  const routeEnd = applicationApi.indexOf("app.get('/patients/:id/deactivation-impact'", routeStart);
  const route = applicationApi.slice(routeStart, routeEnd);

  assert.match(route, /includes\(requestedDoctorID\)/);
  assert.match(route, /alreadyAssigned: true, idempotent: true/);
  assert.match(route, /no duplicate was created/);
  assert.match(chaincode, /alreadyAssigned: true/);
  assert.match(chaincode, /idempotent: true/);
  assert.match(chaincode, /no duplicate was created/);
});
