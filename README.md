# Blockchain-Based Electronic Dental Record System

This repository contains a consent-based electronic dental record platform built with Hyperledger Fabric, Node.js, React, Expo, and MySQL.

## Deployment scope

- `backend/` — application and database API
- `dental-backend/` — private Hyperledger Fabric adapter and identity tooling
- `bc-dentistry-frontend/` — React web application
- `BC-Dentistry-Mobile-App/` — Expo mobile application source
- `fabric-samples/test-network/` — separately managed Fabric network
- `fabric-samples/dental-record-sharing/chaincode-javascript/` — EDR chaincode
- `database/` — database dump, migrations, and verification queries
- `scripts/` — database migration helpers
- `docker-compose.yml` — MySQL and containerized application services

The web client communicates with the application API. The blockchain adapter is an internal service and must not be published as a public client API. Fabric peers, orderer, certificate authorities, channel, chaincode, connection profile, and wallet are managed separately from the application Compose lifecycle. The mobile application is built separately and is not a long-running Compose service.

## Prerequisites

- Linux or WSL with Bash, `curl`, `jq`, and OpenSSL
- Docker Engine with Docker Compose
- Hyperledger Fabric 2.5.16 binaries and images
- Hyperledger Fabric CA 1.5.21 binary and image
- Expo tooling only when building the mobile application

Node.js, npm, MySQL, and the web/API runtimes are supplied by the application containers and do not need to be installed on the Compose host.

## 1. Configure the application

Checkout the `remediation` branch and create the runtime environment file:

```bash
git checkout remediation
cp .env.compose.example .env
```

Replace every `CHANGE_ME` value in `.env`. Generate independent values for JWT signing, refresh tokens, session metadata, MFA encryption, and internal service authentication. The RSA private and public keys must be base64-encoded PEM values. The MFA encryption key must be a persistent base64-encoded 32-byte value.

Useful generators include:

```bash
openssl rand -hex 48
openssl rand -base64 32
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out jwt-private.pem
openssl pkey -in jwt-private.pem -pubout -out jwt-public.pem
base64 -w 0 jwt-private.pem; echo
base64 -w 0 jwt-public.pem; echo
```

On macOS, use `base64 < file | tr -d '\n'` when `base64 -w 0` is unavailable. Do not commit `.env`, generated keys, Fabric wallets, generated organizations, connection profiles containing operational endpoints, or Firebase service-account JSON.

Validate the configuration after all required values have been supplied:

```bash
docker compose config --quiet
```

## 2. Install the Fabric tooling

The repository contains Fabric samples and the EDR chaincode, but platform-specific Fabric binaries are not committed. From the repository root:

```bash
cd fabric-samples
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.16 --ca-version 1.5.21 binary docker
export PATH="$PWD/bin:$PATH"
export FABRIC_CFG_PATH="$PWD/config"
peer version
fabric-ca-client version
cd ..
```

Keep the Fabric binary and Docker image versions aligned.

## 3. Start a new Fabric network and deploy the EDR chaincode

The commands in this section create a fresh local/test Fabric network. Do not run `network.sh down` against an existing environment whose ledger or generated identities must be preserved.

```bash
cd fabric-samples/test-network

# For a brand-new disposable network only:
./network.sh down

# Start two organizations and the orderer, start Fabric CAs,
# create mychannel, and use CouchDB state databases.
./network.sh up createChannel -ca -s couchdb -c mychannel

# Deploy the EDR JavaScript chaincode as basic, version 1.0, sequence 1.
./network.sh deployCC \
  -c mychannel \
  -ccn basic \
  -ccp ../dental-record-sharing/chaincode-javascript \
  -ccl javascript \
  -ccv 1.0 \
  -ccs 1
```

For an existing channel, do not redeploy with sequence `1`. Query the committed definition and use the next sequence with an appropriately updated version:

```bash
export PATH="$PWD/../bin:$PATH"
export FABRIC_CFG_PATH="$PWD/../config"
source scripts/envVar.sh
setGlobals 1
peer lifecycle chaincode querycommitted --channelID mychannel --name basic
```

Confirm that the Fabric containers are running:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'peer|orderer|ca_|couchdb'
```

## 4. Copy the Fabric connection profile

The CA-backed network generates the Org1 connection profile after startup. Copy it to the application mount location:

```bash
cd fabric-samples/test-network
test -f organizations/peerOrganizations/org1.example.com/connection-org1.json
mkdir -p ../../dental-backend/connection ../../dental-backend/wallet
cp organizations/peerOrganizations/org1.example.com/connection-org1.json \
  ../../dental-backend/connection/connection-org1.json
cd ../..
```

The `blockchain-api` container runs `prepareContainerConnectionProfile.js` at startup. It copies the mounted profile into its private runtime directory and rewrites loopback Fabric URLs to `host.docker.internal` for container access.

## 5. Start MySQL and prepare the database

Start MySQL by itself before the APIs. On the first start of an empty `edr-mysql-data` volume, Docker imports `database/dump.sql` automatically:

```bash
docker compose up -d mysql
docker compose ps mysql
```

Wait until MySQL reports `healthy` before applying migrations.

### Fresh installation from the bundled dump

The bundled dump already contains the early patient, doctor, appointment, clinic, secure-session, clinical-record, and lab-result schema. Do **not** blindly replay the migrations dated 2026-07-10 through 2026-07-21 because several contain unguarded `ALTER TABLE` statements already represented in the dump.

For a new database created from the bundled dump, apply the missing/repeat-safe work in this exact order:

```bash
# 1. Push subscription table (repeat-safe CREATE TABLE IF NOT EXISTS)
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < database/migrations/2026-07-23-push-subscriptions.sql

# 2. Verify/reconcile the secure-session schema already represented in the dump
./scripts/apply-secure-auth-migration.sh

# 3. Scoped lab results are repeat-safe and retained here as an explicit check
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < database/migrations/2026-07-30-scoped-lab-results.sql

# 4. Tenant references and verification
./scripts/apply-tenant-reference-integrity-migration.sh

# 5. Durable entity lifecycle operations
./scripts/apply-entity-lifecycle-hardening-migration.sh

# 6. Preserve clinical history when actors are deactivated
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < database/migrations/2026-08-04-preserve-clinical-history.sql

# 7. Appointment interval and overlap controls
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < database/migrations/2026-08-05-appointment-overlap.sql

# 8. Patient/clinic association history
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < database/migrations/2026-08-05-patient-clinic-transfer.sql

# 9. Idempotency and active appointment slot controls
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < database/migrations/2026-08-05-write-idempotency.sql

# 10. Clinical-record integrity verification log
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -uroot "$MYSQL_DATABASE"' \
  < database/migrations/2026-08-10-clinical-record-integrity-log.sql

# 11. Administrator TOTP MFA schema and verification
./scripts/apply-mfa-migration.sh
```

### Upgrade of an existing database

Back up the database before any upgrade:

```bash
docker compose exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -h 127.0.0.1 -uroot --single-transaction "$MYSQL_DATABASE"' \
  > edr-pre-migration.sql
```

The complete chronological migration order is:

1. `2026-07-10-add-patient-blockchain-id.sql`
2. `2026-07-11-patient-management.sql`
3. `2026-07-12-clinical-records.sql`
4. `2026-07-12-doctor-management.sql`
5. `2026-07-15-appointment-management.sql`
6. `2026-07-21-super-admin-clinic-management.sql`
7. `2026-07-23-push-subscriptions.sql`
8. `2026-07-29-secure-auth-sessions.sql`
9. `2026-07-30-scoped-lab-results.sql`
10. `2026-07-31-tenant-reference-integrity.sql`
11. `2026-08-03-entity-lifecycle-hardening.sql`
12. `2026-08-04-preserve-clinical-history.sql`
13. `2026-08-05-appointment-overlap.sql`
14. `2026-08-05-patient-clinic-transfer.sql`
15. `2026-08-05-write-idempotency.sql`
16. `2026-08-10-clinical-record-integrity-log.sql`
17. `2026-08-15-administrator-totp-mfa.sql`

Several early migrations are not repeat-safe. For an existing database, inspect its schema and `Schema_Migration` records and apply only migrations that are not already represented. Never continue past a failed migration or reorder dependent migrations.

## 6. Build the blockchain adapter and initialize the wallet

The blockchain adapter requires the Org1 CA registrar identity named `admin` in the mounted wallet before its automatic database-to-Fabric reconciliation can run.

Build the image, prepare the container profile, and enroll the registrar:

```bash
docker compose build blockchain-api
docker compose run --rm --no-deps blockchain-api sh -c \
  'node prepareContainerConnectionProfile.js && node enrollAdmin.js'
```

Confirm that the registrar identity was persisted on the host-mounted wallet:

```bash
test -f dental-backend/wallet/admin.id
ls -la dental-backend/wallet
```

The local Fabric test-network CA uses enrollment ID `admin` and secret `adminpw`; `enrollAdmin.js` uses those test-network bootstrap credentials. Replace that bootstrap approach for a production CA and protect the registrar identity.

### Optional static sample identities

For the bundled sample actors only, the repository can pre-register role identities:

```bash
docker compose run --rm --no-deps blockchain-api sh -c \
  'node prepareContainerConnectionProfile.js && \
   FABRIC_CCP_PATH=/app/runtime/connection-org1.container.json \
   node registerRoleIdentities.js'
```

The defaults create `admin-1`, `admin-2`, `role-system`, `doctor-Doctor1`, `doctor-Doctor2`, and the sample patient identities. Override the `FABRIC_*_IDS` and clinic-mapping environment variables when the database actors differ. Do not seed sample identities in a production wallet.

## 7. Start reconciliation and the application services

Start the blockchain adapter after MySQL, all required migrations, the Fabric network, chaincode, connection profile, and registrar wallet identity are ready:

```bash
docker compose up -d blockchain-api
docker compose logs --tail=200 blockchain-api
```

On every container start, the adapter performs these steps before serving traffic:

1. Rewrites the mounted Fabric connection profile for container access.
2. Reads active clinic admins, doctors, and patients from MySQL.
3. Enrolls missing actor-bound Fabric identities using the registrar wallet identity.
4. Stores identities in `dental-backend/wallet/` through the persistent mount.
5. Reconciles ledger actor metadata and assignment relationships.
6. Starts the private Blockchain API only after reconciliation succeeds.

After `blockchain-api` is healthy, start the public application API and web frontend:

```bash
docker compose up -d --build database-api web-frontend
docker compose ps
```

The expected Compose services are `mysql`, `blockchain-api`, `database-api`, and `web-frontend`.

## 8. Verify the deployment

```bash
# Container health
docker compose ps

# Application and reconciliation logs
docker compose logs --tail=200 mysql blockchain-api database-api web-frontend

# Private health checks from inside their networks
docker compose exec -T blockchain-api node -e \
  "fetch('http://127.0.0.1:8081/health').then(async r=>{console.log(r.status,await r.text());process.exit(r.ok?0:1)})"
docker compose exec -T database-api node -e \
  "fetch('http://127.0.0.1:8080/health').then(async r=>{console.log(r.status,await r.text());process.exit(r.ok?0:1)})"

# Public web endpoint
curl -fsS "http://127.0.0.1:${WEB_PORT:-5173}/" >/dev/null

# Wallet and connection-profile mounts
test -s dental-backend/connection/connection-org1.json
test -s dental-backend/wallet/admin.id
```

The blockchain health response must report both `profileReady` and `walletReady`. If reconciliation fails, keep `blockchain-api` stopped, correct the CA/profile/wallet/database issue, and restart it; do not bypass reconciliation with an empty wallet.

## 9. Common operations

```bash
# Follow service logs
docker compose logs -f database-api blockchain-api web-frontend

# Rebuild and recreate application services without replacing MySQL data
docker compose up -d --build blockchain-api database-api web-frontend

# Stop application containers while preserving named volumes
docker compose down
```

Do not use `docker compose down -v` when the MySQL or radiographic-file volumes must be preserved. Do not run `fabric-samples/test-network/network.sh down` when the Fabric ledger and generated CA material must be retained.

## 10. Mobile application

The Expo mobile source is located in `BC-Dentistry-Mobile-App/`. It is built as an Android or iOS client and connects to the deployed application API. It is intentionally excluded from the long-running Docker Compose services.

## Security notes

- Use TLS at the public ingress and restrict allowed CORS origins.
- Keep the blockchain adapter and MySQL on private network boundaries.
- Use different values for JWT, refresh-token, session-metadata, MFA-encryption, and internal-service secrets.
- Store Firebase service-account credentials only in the server environment.
- Back up MySQL, the Fabric wallet, connection material, and Fabric network state before upgrades.
- Never commit generated Fabric identities, private keys, production database dumps, or patient data.
