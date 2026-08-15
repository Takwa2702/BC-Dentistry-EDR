import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('web uses cookies, CSRF, refresh, me, and server logout without bearer storage', () => {
  const api = read('src/assets/config/api.js');
  const login = read('src/assets/Sections/LoginSection.jsx');
  const logout = read('src/assets/Sections/Topbar.jsx');
  const auth = read('src/assets/utils/auth.js');
  assert.match(api, /X-CSRF-Token/);
  assert.match(api, /\/auth\/refresh/);
  assert.match(api, /\/auth\/me/);
  assert.match(login, /clientType: 'web'/);
  assert.match(login, /withCredentials: true/);
  assert.match(logout, /\/auth\/logout/);
  assert.doesNotMatch(`${api}\n${login}\n${auth}`, /localStorage\.(getItem|setItem)\(['"]token/);
});

test('web session channel initializes before use and production HTML is self-hosted', () => {
  const auth = read('src/assets/utils/auth.js');
  const html = read('index.html');
  const css = read('src/index.css');
  const login = read('src/assets/Sections/LoginSection.jsx');
  const app = read('src/App.jsx');
  const declaration = auth.indexOf('const sessionChannel');
  const listener = auth.indexOf("sessionChannel?.addEventListener");
  assert.ok(declaration >= 0 && listener > declaration, 'sessionChannel must be initialized before listener registration');
  assert.doesNotMatch(html, /https?:\/\/(cdn\.tailwindcss\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com)/);
  assert.match(css, /\.loginTh2,\s*\.signupTh2\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /dental-hospital-login\.jpg/);
  assert.match(login, /w-full md:w-auto/);
  assert.match(app, /if \(getStoredUser\(\)\) loadCurrentSession\(\)/);
});

test('top bar keeps account controls grouped in a responsive action cluster', () => {
  const topbar = read('src/assets/Sections/Topbar.jsx');
  const notifications = read('src/assets/components/Notifications.jsx');
  assert.match(topbar, /md:flex-row md:items-center md:justify-between/);
  assert.match(topbar, /flex flex-wrap items-center justify-end gap-3/);
  assert.match(topbar, /<Notifications \/>[\s\S]*Active sessions[\s\S]*Log out/);
  assert.match(notifications, /getStoredUser\(\)\?\.role === "system"/);
  assert.match(notifications, /if \(isSystem\) return undefined/);
  assert.match(notifications, /!isSystem && <div ref=\{containerRef\}/);
});

test('mobile uses SecureStore, serialized rotation, restoration, and real logout', () => {
  const context = read('../BC-Dentistry-Mobile-App/Context/UserContext.jsx');
  const session = read('../BC-Dentistry-Mobile-App/services/sessionService.js');
  const client = read('../BC-Dentistry-Mobile-App/services/apiClient.js');
  const storage = read('../BC-Dentistry-Mobile-App/services/tokenStorage.js');
  const settings = read('../BC-Dentistry-Mobile-App/app/(tabs)/settings.jsx');
  const api = read('../BC-Dentistry-Mobile-App/utils/api.js');
  assert.match(context, /sessionService\.initSession/);
  assert.match(storage, /expo-secure-store/);
  assert.match(client, /isRefreshing/);
  assert.match(client, /refreshSubscribers/);
  assert.match(client, /\/auth\/refresh/);
  assert.match(session, /\/auth\/logout/);
  assert.match(storage, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.match(settings, /Log out/);
  assert.doesNotMatch(api, /openuae|fortiddns/);
  assert.match(api, /must use HTTPS outside local development/);
});
