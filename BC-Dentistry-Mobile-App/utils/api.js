export const DATABASE_API_URL = process.env.EXPO_PUBLIC_DATABASE_API_URL || 'http://openuae.fortiddns.com:28080';
export const BLOCKCHAIN_API_URL = process.env.EXPO_PUBLIC_BLOCKCHAIN_API_URL || 'http://openuae.fortiddns.com:28081';

const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

const buildUrl = (baseUrl, path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${stripTrailingSlash(baseUrl)}${normalizedPath}`;
};

export const databaseUrl = (path) => buildUrl(DATABASE_API_URL, path);
export const blockchainUrl = (path) => buildUrl(BLOCKCHAIN_API_URL, path);

export const authHeaders = (token, headers = {}) => {
    return token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
};

export const jsonHeaders = (token, headers = {}) => authHeaders(token, {
    'Content-Type': 'application/json',
    ...headers,
});

export const getPatientBlockchainID = (user) => {
    return user?.blockchainID || null;
};
