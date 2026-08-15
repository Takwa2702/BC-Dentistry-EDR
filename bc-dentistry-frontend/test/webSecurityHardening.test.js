import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('nginx applies nonce-based CSP and browser hardening headers', () => {
  const nginx = read('nginx.conf');
  assert.match(nginx, /server_tokens off/);
  assert.match(nginx, /proxy_hide_header X-Powered-By/);
  assert.match(nginx, /style-src 'self' 'nonce-\$request_id'/);
  assert.doesNotMatch(nginx, /style-src 'self' 'unsafe-inline'/);
  assert.match(nginx, /Cross-Origin-Opener-Policy "same-origin-allow-popups"/);
  assert.match(nginx, /Cross-Origin-Embedder-Policy "credentialless"/);
  assert.match(nginx, /Cross-Origin-Resource-Policy "same-site"/);
  assert.match(nginx, /Permissions-Policy/);
  assert.match(nginx, /sub_filter '__CSP_NONCE__' '\$request_id'/);
});

test('Emotion style elements receive the per-response CSP nonce', () => {
  const html = read('index.html');
  const main = read('src/main.jsx');
  assert.match(html, /meta name="csp-nonce" content="__CSP_NONCE__"/);
  assert.match(main, /createCache\(\{ key: 'edr', nonce: cspNonce \}\)/);
  assert.match(main, /<CacheProvider value=\{emotionCache\}>/);
});

test('component source has no unnonced style element', () => {
  const appointment = read('src/assets/components/Appointments/SetNewAppointmentForm2.jsx');
  assert.doesNotMatch(appointment, /<style[\s>]/);
});
