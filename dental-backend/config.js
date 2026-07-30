const fs = require('fs');
const path = require('path');

function loadEnvFile() {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

function resolveFromBackend(relativeOrAbsolutePath, fallback) {
    const value = relativeOrAbsolutePath || fallback;
    return path.isAbsolute(value) ? value : path.resolve(__dirname, value);
}

loadEnvFile();

module.exports = {
    port: Number(process.env.PORT || 3000),
    channelName: process.env.FABRIC_CHANNEL || 'mychannel',
    chaincodeName: process.env.FABRIC_CHAINCODE || 'basic',
    connectionProfilePath: resolveFromBackend(
        process.env.FABRIC_CONNECTION_PROFILE,
        './connection/connection-org1.json'
    ),
    walletPath: resolveFromBackend(process.env.FABRIC_WALLET_PATH, './wallet'),
    identity: process.env.FABRIC_IDENTITY || 'appUser',
    corsOrigin: process.env.CORS_ORIGIN || '*',
};
