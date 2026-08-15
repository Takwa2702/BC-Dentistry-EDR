import axios from 'axios';
import { clearSession, getStoredUser } from '../utils/auth.js';

const stripTrailingSlash = (value) => value.replace(/\/+$/, "");

const normalizeBaseUrl = (value, fallback) => {
    const baseUrl = value || fallback;
    return stripTrailingSlash(baseUrl);
};

export const DATABASE_API_URL = normalizeBaseUrl(
    import.meta.env.VITE_DATABASE_API_URL,
    "/api/database"
);

const buildUrl = (baseUrl, path) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
};

export const databaseUrl = (path) => buildUrl(DATABASE_API_URL, path);

const API_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export const humanizeApiCode = (code) => {
    if (typeof code !== 'string' || !code.trim()) return '';
    const value = code.trim();
    if (!API_CODE_PATTERN.test(value)) return value;
    const words = value.toLowerCase().replace(/_/g, ' ');
    return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
};

export const apiPayloadMessage = (payload, fallback = 'Request failed.') => {
    const candidates = [
        payload?.message,
        payload?.error?.message,
        typeof payload?.error === 'string' ? payload.error : undefined,
        payload?.detail,
        payload?.error?.code,
        payload?.code,
    ];
    const selected = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    return humanizeApiCode(selected || fallback) || fallback;
};

export const apiRequestErrorMessage = (error, fallback = 'Request failed.') => {
    if (error?.response?.data) return apiPayloadMessage(error.response.data, fallback);
    return humanizeApiCode(error?.message || fallback) || fallback;
};

axios.defaults.withCredentials = true;
const nativeFetch = window.fetch.bind(window);
let refreshPromise = null;

export const handleUnauthorizedResponse = (response) => {
    if ([401, 403].includes(response?.status) && response?.status !== 403) {
        clearSession();
        window.dispatchEvent(new Event('edr-session-expired'));
    }
    return response;
};

export const authHeaders = (headers = {}) => {
    const csrf = document.cookie.split(';').map((value) => value.trim())
        .find((value) => value.startsWith('__Host-edr_csrf='))
        ?.slice('__Host-edr_csrf='.length);
    return csrf ? { ...headers, 'X-CSRF-Token': decodeURIComponent(csrf) } : { ...headers };
};

export const jsonHeaders = (headers = {}) => authHeaders({
    "Content-Type": "application/json",
    ...headers,
});

export const refreshWebSession = async () => {
    if (refreshPromise) return refreshPromise;
    const rotate = () => nativeFetch(databaseUrl('/auth/refresh'), {
      method: 'POST', credentials: 'include', headers: authHeaders(),
    }).then(async (response) => {
        if (!response.ok) throw new Error('Session refresh failed');
        return response.json();
    });
    const rotation = navigator.locks?.request
        ? navigator.locks.request('edr-session-refresh', rotate)
        : rotate();
    refreshPromise = rotation.catch((error) => {
        clearSession();
        throw error;
    }).finally(() => { refreshPromise = null; });
    return refreshPromise;
};

export const installSessionInterceptors = () => {
    window.fetch = async (input, options = {}) => {
        const requestOptions = { ...options, credentials: 'include' };
        const method = String(requestOptions.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            requestOptions.headers = authHeaders(requestOptions.headers || {});
        }
        let response = await nativeFetch(input, requestOptions);
        const url = String(input?.url || input);
        const canRefresh = response.status === 401 && getStoredUser()
            && !url.includes('/login') && !url.includes('/auth/refresh') && !requestOptions._edrRetried;
        if (canRefresh) {
            await refreshWebSession();
            response = await nativeFetch(input, { ...requestOptions, _edrRetried: true, headers: authHeaders(requestOptions.headers || {}) });
        }
        if (response.status === 401) {
            clearSession();
            window.dispatchEvent(new Event('edr-session-expired'));
        }
        return response;
    };
};

axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const request = error.config;
        if (error.response?.status === 401 && request && !request._edrRetried
            && !String(request.url || '').includes('/login') && !String(request.url || '').includes('/auth/refresh')) {
            request._edrRetried = true;
            await refreshWebSession();
            return axios(request);
        }
        throw error;
    },
);

export const loadCurrentSession = async () => {
    let response = await fetch(databaseUrl('/auth/me'), { credentials: 'include', headers: authHeaders() });
    if (response.status === 401) {
        try {
            await refreshWebSession();
            response = await fetch(databaseUrl('/auth/me'), { credentials: 'include', headers: authHeaders() });
        } catch {
            clearSession();
            return null;
        }
    }
    if (!response.ok) {
        clearSession();
        return null;
    }
    const payload = await response.json();
    sessionStorage.setItem('user', JSON.stringify(payload.data));
    window.dispatchEvent(new Event('edr-session-changed'));
    return payload.data;
};
