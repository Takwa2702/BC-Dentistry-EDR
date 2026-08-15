const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('database API suppresses the Express technology header', () => {
    assert.match(read('server.js'), /app\.disable\('x-powered-by'\)/);
});

test('double-submit CSRF cookie stays readable but strictly scoped', () => {
    const sessions = read('sessionService.js');
    assert.match(sessions, /const CSRF_COOKIE = '__Host-edr_csrf'/);
    assert.match(sessions, /'Path=\/'/);
    assert.match(sessions, /'SameSite=Strict'/);
    assert.match(sessions, /parts\.push\('Secure'\)/);
    assert.match(sessions, /cookie\(CSRF_COOKIE, session\.csrfToken,[\s\S]*false\)/);
    assert.match(sessions, /cookie\(ACCESS_COOKIE,[\s\S]*cookie\(REFRESH_COOKIE/);
});
