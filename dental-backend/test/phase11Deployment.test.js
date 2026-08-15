'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readSourceTree = (relativePath) => {
    const absolute = path.join(root, relativePath);
    return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
        const child = path.join(relativePath, entry.name);
        if (entry.isDirectory()) return readSourceTree(child);
        return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [read(child)] : [];
    }).join('\n');
};

test('Compose contains every non-Fabric server service and excludes the mobile client', () => {
    const compose = read('docker-compose.yml');
    for (const service of ['mysql:', 'database-api:', 'blockchain-api:', 'web-frontend:']) {
        assert.match(compose, new RegExp(`^  ${service}`, 'm'));
    }
    assert.doesNotMatch(compose, /^  mobile[^:]*:/m);
    assert.match(compose, /BLOCKCHAIN_API_URL: http:\/\/blockchain-api:8081/);
    assert.match(compose, /BLOCKCHAIN_INTERNAL_TOKEN:/);
    assert.doesNotMatch(compose, /BLOCKCHAIN_API_PORT/);
    assert.doesNotMatch(read('bc-dentistry-frontend/nginx.conf'), /blockchain-api/);
    assert.match(read('bc-dentistry-frontend/nginx.conf'), /location \^~ \/api\/blockchain[\s\S]*return 404/);
    assert.match(read('bc-dentistry-frontend/nginx.conf'), /proxy_pass http:\/\/database-api:8080\//);
});

test('public clients cannot address the private blockchain service', () => {
    const webSource = readSourceTree('bc-dentistry-frontend/src');
    const mobileSource = [
        'app', 'components', 'Context', 'services', 'utils',
    ].map((directory) => readSourceTree(`BC-Dentistry-Mobile-App/${directory}`)).join('\n');
    const webDockerfile = read('bc-dentistry-frontend/Dockerfile');
    const vite = read('bc-dentistry-frontend/vite.config.js');
    for (const source of [webSource, mobileSource, webDockerfile, vite]) {
        assert.doesNotMatch(source, /BLOCKCHAIN_API_URL|\/api\/blockchain|localhost:8081|peer0\.|orderer\./);
    }
});

test('blockchain business routes require internal application-service authentication', () => {
    const blockchainApi = read('dental-backend/index.js');
    const databaseApi = read('backend/server.js');
    assert.match(blockchainApi, /const requireInternalService =/);
    assert.match(blockchainApi, /app\.use\(requireInternalService\)/);
    assert.match(databaseApi, /'X-EDR-Internal-Token'/);
    assert.match(databaseApi, /BLOCKCHAIN_INTERNAL_TOKEN is required in production/);
});

test('Fabric credentials remain external mounts with a container-safe profile', () => {
    const compose = read('docker-compose.yml');
    const prepare = read('dental-backend/prepareContainerConnectionProfile.js');
    assert.match(compose, /fabric-connection:ro/);
    assert.match(compose, /FABRIC_WALLET_DIR[^\n]+:\/fabric-wallet(?!:ro)/);
    assert.match(compose, /FABRIC_DISCOVERY_AS_LOCALHOST: "false"/);
    assert.match(prepare, /host\.docker\.internal/);
    assert.match(prepare, /localhost\|127\\\.0\\\.0\\\.1/);
    assert.match(prepare, /https\?/);
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
