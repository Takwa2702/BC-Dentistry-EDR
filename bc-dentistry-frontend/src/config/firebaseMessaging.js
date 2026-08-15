import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { authHeaders, databaseUrl, jsonHeaders } from '../assets/config/api';
import { getStoredUser } from '../assets/utils/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredConfig = ['apiKey', 'projectId', 'messagingSenderId', 'appId'];
export const isWebPushConfigured = () => (
    requiredConfig.every((key) => Boolean(firebaseConfig[key]))
    && Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY)
);

const serviceWorkerUrl = () => {
    const params = new URLSearchParams(Object.entries(firebaseConfig).filter(([, value]) => Boolean(value)));
    return `/firebase-messaging-sw.js?${params.toString()}`;
};

let messagingPromise;

const currentOwnerKey = () => {
    const user = getStoredUser();
    if (!user) return '';
    const role = String(user.role || '').toLowerCase();
    const recipientID = role === 'admin' ? user.organizationId : user.blockchainID;
    return recipientID ? `${role}:${recipientID}` : '';
};

const getMessagingContext = async () => {
    if (!messagingPromise) {
        messagingPromise = (async () => {
            if (!isWebPushConfigured() || !await isSupported() || !('serviceWorker' in navigator)) return null;
            const registration = await navigator.serviceWorker.register(serviceWorkerUrl());
            const app = initializeApp(firebaseConfig);
            return { messaging: getMessaging(app), registration };
        })();
    }
    return messagingPromise;
};

export const enableWebPush = async () => {
    const context = await getMessagingContext();
    if (!context) throw new Error('Web push is not configured or supported in this browser.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');

    return registerCurrentBrowserToken(context);
};

const registerCurrentBrowserToken = async (providedContext) => {
    const context = providedContext || await getMessagingContext();
    if (!context) throw new Error('Web push is not configured or supported in this browser.');
    const token = await getToken(context.messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: context.registration,
    });
    if (!token) throw new Error('Firebase did not return a browser push token.');

    const response = await fetch(databaseUrl('/push/subscriptions'), {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
            platform: 'web',
            token,
            deviceLabel: navigator.userAgent.slice(0, 255),
        }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to register this browser for push notifications.');
    }
    localStorage.setItem('edr-web-push-token', token);
    localStorage.setItem('edr-web-push-synced-at', new Date().toISOString());
    localStorage.setItem('edr-web-push-owner', currentOwnerKey());
    if (payload?.data?.subscriptionID) localStorage.setItem('edr-web-push-subscription-id', String(payload.data.subscriptionID));
    return token;
};

export const syncWebPushIfPermitted = async ({ force = false } = {}) => {
    if (!isWebPushConfigured() || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return null;
    }
    const syncedAt = Date.parse(localStorage.getItem('edr-web-push-synced-at') || '');
    const ownerChanged = currentOwnerKey() !== localStorage.getItem('edr-web-push-owner');
    const refreshAfterMs = 24 * 60 * 60 * 1000;
    if (!force && !ownerChanged && Number.isFinite(syncedAt) && Date.now() - syncedAt < refreshAfterMs) {
        return localStorage.getItem('edr-web-push-token');
    }
    return registerCurrentBrowserToken();
};

export const disableWebPush = async () => {
    const token = localStorage.getItem('edr-web-push-token');
    if (!token) return;
    const response = await fetch(databaseUrl('/push/subscriptions'), {
        method: 'DELETE',
        headers: jsonHeaders(),
        body: JSON.stringify({ token }),
    });
    if (!response.ok) throw new Error('Unable to unregister this browser from push notifications.');
    localStorage.removeItem('edr-web-push-token');
    localStorage.removeItem('edr-web-push-synced-at');
    localStorage.removeItem('edr-web-push-owner');
    localStorage.removeItem('edr-web-push-subscription-id');
};

export const subscribeToForegroundPush = async (callback) => {
    const context = await getMessagingContext();
    if (!context) return () => {};
    return onMessage(context.messaging, callback);
};

export const getPushBackendStatus = async () => {
    const response = await fetch(databaseUrl('/push/config'), { headers: authHeaders() });
    if (!response.ok) return { configured: false };
    const payload = await response.json();
    return payload.data || payload;
};

export const listPushDevices = async () => {
    const response = await fetch(databaseUrl('/push/subscriptions'), { headers: authHeaders() });
    if (!response.ok) throw new Error('Unable to load registered notification devices.');
    const payload = await response.json();
    return payload.data || payload || [];
};

export const removePushDevice = async (subscriptionID) => {
    const response = await fetch(databaseUrl(`/push/subscriptions/${encodeURIComponent(subscriptionID)}`), {
        method: 'DELETE',
        headers: jsonHeaders(),
    });
    if (!response.ok) throw new Error('Unable to remove this notification device.');
    if (String(subscriptionID) === localStorage.getItem('edr-web-push-subscription-id')) {
        localStorage.removeItem('edr-web-push-token');
        localStorage.removeItem('edr-web-push-synced-at');
        localStorage.removeItem('edr-web-push-owner');
        localStorage.removeItem('edr-web-push-subscription-id');
    }
};

export const isCurrentPushDevice = (subscriptionID) => (
    String(subscriptionID) === localStorage.getItem('edr-web-push-subscription-id')
);
