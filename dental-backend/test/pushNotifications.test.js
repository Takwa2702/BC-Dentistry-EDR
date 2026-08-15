const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const api = fs.readFileSync(path.join(root, 'dental-backend', 'index.js'), 'utf8');
const push = fs.readFileSync(path.join(root, 'dental-backend', 'pushNotifications.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'database', 'migrations', '2026-07-23-push-subscriptions.sql'), 'utf8');
const notifications = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'components', 'Notifications.jsx'), 'utf8');
const messaging = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'config', 'firebaseMessaging.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'public', 'firebase-messaging-sw.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'App.jsx'), 'utf8');
const topbar = fs.readFileSync(path.join(root, 'bc-dentistry-frontend', 'src', 'assets', 'Sections', 'Topbar.jsx'), 'utf8');

test('push subscriptions are owner-bound and persisted off-chain', () => {
  assert.match(api, /app\.post\('\/push\/subscriptions', authenticateToken/);
  assert.match(api, /notificationTargetFromUser\(req\.user\)/);
  assert.match(api, /registerPushSubscription/);
  assert.match(api, /app\.delete\('\/push\/subscriptions', authenticateToken/);
  assert.match(api, /app\.get\('\/push\/subscriptions', authenticateToken/);
  assert.match(api, /app\.delete\('\/push\/subscriptions\/:subscriptionID', authenticateToken/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS Push_Subscription/);
  assert.match(migration, /UNIQUE KEY uq_push_token/);
  assert.match(push, /Recipient_Role = \? AND Recipient_ID = \? AND Active = TRUE/);
});

test('Firebase delivery supports web, Android, and iOS from one recipient registry', () => {
  assert.match(push, /sendEachForMulticast/);
  assert.match(push, /webpush:/);
  assert.match(push, /android:/);
  assert.match(push, /apns:/);
  assert.match(push, /messaging\/registration-token-not-registered/);
  assert.match(push, /pruneStaleSubscriptions/);
  assert.match(api, /dispatchNotificationPush/);
  assert.match(api, /ACCESS_REQUEST_PENDING_ADMIN/);
});

test('web notification center renders records and opens event-specific deep links', () => {
  assert.match(notifications, /notification-panel/);
  assert.match(notifications, /deepLinkForNotification/);
  assert.match(notifications, /\/datarequests\$\{query\}/);
  assert.match(notifications, /navigate\(deepLinkForNotification\(notification\)\)/);
  assert.match(notifications, /requestId=/);
  assert.match(notifications, /setInterval\(\(\) => loadNotifications/);
  assert.match(notifications, /Manage notification devices/);
  assert.match(notifications, /removePushDevice/);
});

test('browser push registers FCM token and service worker handles notification navigation', () => {
  assert.match(messaging, /getToken\(context\.messaging/);
  assert.match(messaging, /VITE_FIREBASE_VAPID_KEY/);
  assert.match(messaging, /\/push\/subscriptions/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(serviceWorker, /clients\.openWindow\(target\)/);
});

test('authorized browser tokens resynchronize on account changes and unregister at logout', () => {
  assert.match(messaging, /currentOwnerKey\(\) !== localStorage\.getItem\('edr-web-push-owner'\)/);
  assert.match(messaging, /edr-web-push-synced-at/);
  assert.match(app, /syncWebPushIfPermitted/);
  assert.match(app, /setInterval\(synchronizePush/);
  assert.match(topbar, /await disableWebPush\(\)/);
  assert.match(topbar, /finally[\s\S]*clearSession\(\)/);
});
