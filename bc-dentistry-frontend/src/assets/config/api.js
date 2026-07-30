const stripTrailingSlash = (value) => value.replace(/\/+$/, "");

const normalizeBaseUrl = (value, fallback) => {
    const baseUrl = value || fallback;
    return stripTrailingSlash(baseUrl);
};

export const DATABASE_API_URL = normalizeBaseUrl(
    import.meta.env.VITE_DATABASE_API_URL,
    "http://localhost:8080"
);

export const BLOCKCHAIN_API_URL = normalizeBaseUrl(
    import.meta.env.VITE_BLOCKCHAIN_API_URL,
    "http://localhost:8081"
);

const buildUrl = (baseUrl, path) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
};

export const databaseUrl = (path) => buildUrl(DATABASE_API_URL, path);
export const blockchainUrl = (path) => buildUrl(BLOCKCHAIN_API_URL, path);

import { clearSession, hasValidSession } from '../utils/auth.js';

export const getAuthToken = () => hasValidSession() ? localStorage.getItem("token") : null;

export const handleUnauthorizedResponse = (response) => {
    if (response?.status === 401) {
        clearSession();
        window.dispatchEvent(new Event('edr-session-expired'));
    }
    return response;
};

export const authHeaders = (headers = {}) => {
    const token = getAuthToken();
    return token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
};

export const jsonHeaders = (headers = {}) => authHeaders({
    "Content-Type": "application/json",
    ...headers,
});
