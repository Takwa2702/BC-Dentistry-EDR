const trimTrailingSlash = (value) => value.replace(/\/$/, '');
const ensureLeadingSlash = (value) => value.startsWith('/') ? value : `/${value}`;

export const DATABASE_API_URL = trimTrailingSlash(
    import.meta.env.VITE_DATABASE_API_URL || 'http://localhost:3001'
);

export const databaseUrl = (path) => `${DATABASE_API_URL}${ensureLeadingSlash(path)}`;
