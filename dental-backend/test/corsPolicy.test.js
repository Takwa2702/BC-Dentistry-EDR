const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const applicationApi = fs.readFileSync(path.resolve(__dirname, '..', '..', 'backend', 'server.js'), 'utf8');
const compose = fs.readFileSync(path.resolve(__dirname, '..', '..', 'docker-compose.yml'), 'utf8');

test('production CORS uses an explicit credentialed origin allow-list', () => {
  assert.match(applicationApi, /Production CORS_ORIGIN must be an explicit allow-list/);
  assert.match(applicationApi, /credentials: true/);
  assert.match(applicationApi, /allowedWebOrigins\.includes\(req\.get\('origin'\)\)/);
  assert.match(compose, /CORS_ORIGIN: \$\{CORS_ORIGIN:-http:\/\/localhost:5173\}/);
});

test('unlisted browser origins are rejected before route handling', () => {
  const guard = applicationApi.indexOf("'CORS_ORIGIN_DENIED'");
  const corsMiddleware = applicationApi.indexOf('app.use(cors(corsOptions))');
  const firstBusinessRoute = applicationApi.indexOf("app.post('/login'");
  assert.ok(guard > -1, 'missing explicit denied-origin response');
  assert.ok(guard < corsMiddleware, 'origin guard must run before CORS headers are emitted');
  assert.ok(corsMiddleware < firstBusinessRoute, 'CORS policy must run before business routes');
  assert.match(applicationApi, /requestOrigin && !hasAllowedWebOrigin\(req\)/);
  assert.match(applicationApi, /403, 'CORS_ORIGIN_DENIED', 'Cross-origin request is not permitted'/);
});
