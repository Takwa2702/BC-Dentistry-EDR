'use strict';

const fs = require('fs');
const path = require('path');

const source = path.resolve(process.env.FABRIC_CONNECTION_PROFILE_SOURCE || '/fabric-connection/connection-org1.json');
const target = path.resolve(process.env.FABRIC_CONNECTION_PROFILE || '/app/runtime/connection-org1.container.json');
const gatewayHost = process.env.FABRIC_HOST_GATEWAY || 'host.docker.internal';

if (!fs.existsSync(source)) {
    throw new Error(`Fabric connection profile is missing: ${source}`);
}

const profile = JSON.parse(fs.readFileSync(source, 'utf8'));
const rewriteUrl = (url) => typeof url === 'string'
    ? url.replace(/(grpcs?:\/\/)(localhost|127\.0\.0\.1)(?=:)/gi, `$1${gatewayHost}`)
    : url;

for (const section of ['peers', 'orderers', 'certificateAuthorities']) {
    for (const definition of Object.values(profile[section] || {})) {
        definition.url = rewriteUrl(definition.url);
    }
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 });
console.log(`Prepared container Fabric connection profile at ${target}`);
