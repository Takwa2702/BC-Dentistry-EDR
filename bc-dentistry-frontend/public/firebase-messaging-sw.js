/* global firebase, importScripts, clients */
importScripts('https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const config = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    storageBucket: params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
};

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
    firebase.initializeApp(config);
    firebase.messaging();
}

self.addEventListener('notificationclick', (event) => {
    const deepLink = event.notification?.data?.FCM_MSG?.data?.deepLink
        || event.notification?.data?.deepLink
        || '/dashboard';
    event.notification.close();
    event.waitUntil((async () => {
        const target = new URL(deepLink, self.location.origin).href;
        const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = clientsList.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) {
            await existing.focus();
            existing.navigate(target);
            return;
        }
        await clients.openWindow(target);
    })());
});
