import axios from 'axios';
import { tokenStorage } from './tokenStorage';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');
const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);

// Consolidated single API Base URL
export const DATABASE_API_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_DATABASE_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://edr.bizcenter.tech/api/database'
);

export const databaseUrl = (path) => `${DATABASE_API_URL}${ensureLeadingSlash(path)}`;
export const blockchainUrl = databaseUrl; // Legacy alias for unified backend API

// Handlers injected by sessionService to prevent circular imports
let sessionExpiredHandler = null;
let sessionUpdatedHandler = null;

export const setSessionHandlers = ({ onExpired, onUpdated }) => {
  sessionExpiredHandler = onExpired;
  sessionUpdatedHandler = onUpdated;
};

// MOB-019: Centralized Axios instance with 15s timeout
const apiClient = axios.create({
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Automatic Auth Header Injection
apiClient.interceptors.request.use(
  async (config) => {
    if (!config.skipAuth) {
      try {
        const token = await tokenStorage.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.warn('[apiClient] Error reading access token:', error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: 401 & 403 INVALID_TOKEN Refresh-Token Rotation & Queue Deduplication
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const is401 = error.response?.status === 401;
    const isInvalidToken =
      error.response?.status === 403 &&
      (error.response?.data?.error?.code === 'INVALID_TOKEN' ||
        error.response?.data?.error === 'INVALID_TOKEN');
    const isAuthEndpoint =
      originalRequest?.url?.includes('/login') || originalRequest?.url?.includes('/auth/refresh');

    if ((is401 || isInvalidToken) && !originalRequest?._retry && !isAuthEndpoint && !originalRequest?.skipAuth) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (!newToken) {
              return reject(error);
            }
            originalRequest._retry = true;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await tokenStorage.getRefreshToken();
        if (!storedRefreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(databaseUrl('/auth/refresh'), {
          refreshToken: storedRefreshToken,
        });

        const newAccessToken = response.data?.accessToken || response.data?.token;
        const newRefreshToken = response.data?.refreshToken;

        if (!newAccessToken) {
          throw new Error('Refresh response missing access token');
        }

        await tokenStorage.saveSession({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken || storedRefreshToken,
        });

        if (sessionUpdatedHandler) {
          sessionUpdatedHandler({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken || storedRefreshToken,
          });
        }

        onRefreshed(newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('[apiClient] Refresh token failed or revoked:', refreshError.message || refreshError);
        onRefreshed(null);
        if (sessionExpiredHandler) {
          await sessionExpiredHandler();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.code === 'ECONNABORTED') {
      console.error('[apiClient] Request timed out (15s limit reached)');
    }
    return Promise.reject(error);
  }
);

export const createAbortController = () => (typeof AbortController !== 'undefined' ? new AbortController() : null);
export const getPatientBlockchainID = (user) => user?.blockchainID || null;
export const getRequestLifecycleStatus = (request) => request?.lifecycleStatus || request?.status || '';

export const fetchPatientRequests = async (patientID) => {
  if (!patientID) return [];

  try {
    const response = await apiClient.get(databaseUrl(`/getAllRequestsForPatient/${patientID}`));
    const list = Array.isArray(response.data?.data)
      ? response.data.data
      : Array.isArray(response.data)
      ? response.data
      : response.data?.requests || [];

    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.warn(`[fetchPatientRequests] GET /getAllRequestsForPatient/${patientID} failed:`, error.response?.data?.error?.message || error.message);
    throw error;
  }
};

export default apiClient;
