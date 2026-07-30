'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Compose contains every non-Fabric server service and excludes the mobile client', () => {
    const compose = read('docker-compose.yml');
    for (const service of ['mysql:', 'database-api:', 'blockchain-api:', 'web-frontend:']) {
        assert.match(compose, new RegExp(`^  ${service}`, 'm'));
    }
    assert.doesNotMatch(compose, /^  mobile[^:]*:/m);
    assert.match(compose, /BLOCKCHAIN_API_URL: http:\/\/blockchain-api:8081/);
    assert.match(read('bc-dentistry-frontend/nginx.conf'), /proxy_pass http:\/\/blockchain-api:8081\//);
});

test('Fabric credentials remain external read-only mounts with a container-safe profile', () => {
    const compose = read('docker-compose.yml');
    const prepare = read('dental-backend/prepareContainerConnectionProfile.js');
    assert.match(compose, /fabric-connection:ro/);
    assert.match(compose, /fabric-wallet:ro/);
    assert.match(compose, /FABRIC_DISCOVERY_AS_LOCALHOST: "false"/);
    assert.match(prepare, /host\.docker\.internal/);
    assert.match(prepare, /localhost\|127\\\.0\\\.0\\\.1/);
});

test('APIs and Nginx define runtime health checks', () => {
    assert.match(read('backend/server.js'), /app\.get\('\/health'/);
    assert.match(read('dental-backend/index.js'), /app\.get\('\/health'/);
    const compose = read('docker-compose.yml');
    assert.equal((compose.match(/healthcheck:/g) || []).length, 4);
});

test('deployment guide states the accepted test topology and Fabric production gap', () => {
    const guide = read('docs/PHASE11_DEPLOYMENT.md');
    assert.match(guide, /accepted development\/test topology/);
    assert.match(guide, /one peer per organization and one orderer/);
    assert.match(guide, /two peers per organization and at least three Raft orderers/);
    assert.match(guide, /Additional clinic onboarding/);
});
