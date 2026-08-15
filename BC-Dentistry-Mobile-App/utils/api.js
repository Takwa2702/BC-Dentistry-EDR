const requiredHttpsUrl = (name, value) => {
    if (!value) throw new Error(`${name} is required`);
    const url = value.replace(/\/+$/, '');
    if (!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url)) {
        throw new Error(`${name} must use HTTPS outside local development`);
    }
    return url;
};

export const DATABASE_API_URL = requiredHttpsUrl('EXPO_PUBLIC_DATABASE_API_URL', process.env.EXPO_PUBLIC_DATABASE_API_URL);
const stripTrailingSlash = (value) => value.replace(/\/+$/, '');

const buildUrl = (baseUrl, path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${stripTrailingSlash(baseUrl)}${normalizedPath}`;
};

export const databaseUrl = (path) => buildUrl(DATABASE_API_URL, path);

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
