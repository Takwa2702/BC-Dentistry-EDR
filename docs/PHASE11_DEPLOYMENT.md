# Phase 11 Application Compose And Fabric Exception

## Selected topology

This release uses an **accepted development/test topology**, not the SRS production Fabric topology. Every long-running application service outside Hyperledger Fabric is in the root Compose stack. Hyperledger Fabric and the Expo mobile client are outside that boundary for different reasons:

- Fabric peers, ordering service, CAs, chaincode containers, channel state, MSP/TLS material, and generated connection profiles are lifecycle-managed by `fabric-samples/test-network/network.sh`.
- The Expo mobile app is a client/build artifact. It calls the containerized APIs but is not a long-running server container.
- The selected Fabric test network has one peer per organization and one orderer. It does **not** satisfy the SRS production target of two peers per organization and at least three Raft orderers.

Do not describe this topology as production/high availability. Production promotion requires a separately designed Fabric deployment, updated connection profiles, organization MSP policies, wallet re-enrollment/revocation, backup/restore, monitoring, and failover evidence.

## Application services

| Compose service | Runtime purpose | Persistence | Health endpoint/check |
|---|---|---|---|
| `mysql` | Authoritative off-chain relational data | `edr-mysql-data` | `mysqladmin ping` |
| `blockchain-api` | JWT-protected Fabric gateway and radiographic integrity service | read-only Fabric wallet/profile mounts; `edr-radiographic-files` | `GET /health` |
| `database-api` | Database/authentication/clinical API | MySQL volume through `mysql` | `GET /health` |
| `web-frontend` | Built React assets behind Nginx; same-origin API proxy | immutable image content | `GET /` |

Redis is not used by the current application runtime. Mobile API support is provided by the two containerized APIs; no separate mobile backend service exists.

## Prerequisites and secrets

1. Copy `.env.compose.example` to `.env` and replace `MYSQL_ROOT_PASSWORD` and `JWT_SECRET`. Do not commit `.env`.
2. Start Fabric and generate the Org1 connection profile and role-bound wallet as described below.
3. Ensure host ports `7050`, `7051`, `7054`, and `9051` are published by the Fabric test network. The Blockchain API maps discovered Fabric hostnames to the Docker host through `extra_hosts`.
4. On Linux, Docker Engine must support the Compose `host-gateway` mapping.

The Compose stack creates named volumes for MySQL and private radiographic bytes. Back up both volumes before destructive upgrades. Wallet and connection-profile directories are read-only bind mounts and must be backed up through the Fabric operational process.

## Fabric lifecycle exception

From a Bash-capable shell:

```bash
cd fabric-samples/test-network
./network.sh down
./network.sh up createChannel -c mychannel -ca
./network.sh deployCC -ccn basic -ccp ../dental-record-sharing/chaincode-javascript -ccl javascript
docker ps --format 'table {{.Names}}\t{{.Status}}'
peer lifecycle chaincode querycommitted -C mychannel -n basic
```

To stop or rebuild Fabric:

```bash
cd fabric-samples/test-network
./network.sh down
./network.sh up createChannel -c mychannel -ca
```

After every fresh Fabric network start, refresh identities and the generated profile before starting the application stack:

```bash
cp fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json dental-backend/connection/
cd dental-backend
npm ci
node enrollAdmin.js
npm run fabric:register-identities
cd ..
```

Expected mounts:

- `FABRIC_CONNECTION_DIR/connection-org1.json`: generated Org1 profile containing TLS CA material.
- `FABRIC_WALLET_DIR/*.id`: `admin`, clinic-bound admin identities, actor-bound doctor/patient identities, and the system identity required by active JWT claims.
- The wallet must not be baked into an image or committed. Compose mounts it read-only.

At container startup, `prepareContainerConnectionProfile.js` copies the generated profile into the container and rewrites only loopback gRPC/CA URLs to `host.docker.internal`. Fabric TLS hostname overrides and embedded CA certificates are preserved. Discovery runs with `asLocalhost=false`; the Compose host mappings route discovered peer/orderer names to published host ports.

## Application startup and verification

```bash
cp .env.compose.example .env
# edit .env securely
docker compose config
docker compose build database-api blockchain-api web-frontend
docker compose up -d
docker compose ps
curl -i http://localhost:5173/
curl -i http://localhost:8080/
curl -i http://localhost:8080/health
curl -i http://localhost:8081/health
curl -i http://localhost:5173/api/database/health
curl -i http://localhost:5173/api/blockchain/health
```

A protected Blockchain API check must use a valid JWT and actor whose wallet identity exists. A request without a token is expected to return `401`; that proves the route is protected but does not prove Fabric invocation. Complete deployment validation with an authenticated query appropriate to the enrolled actor, for example:

```bash
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8081/getPatientsByClinic/1
```

Shutdown without deleting persistent volumes:

```bash
docker compose down
```

## AWS deployment record template

The Phase 11 test-VM rollout completed on 2026-07-17 from commit `8e03f22`. Evidence is recorded in [`PHASE11_DEPLOYMENT_EVIDENCE_2026-07-17.md`](PHASE11_DEPLOYMENT_EVIDENCE_2026-07-17.md). For subsequent AWS updates:

1. Record checkout and commit; create a timestamped backup under `/home/ubuntu/deployment-backups/`.
2. Back up MySQL, radiographic storage, Fabric wallet/profile material, `.env`, and any existing Nginx/PM2 configuration being replaced.
3. Start/verify Fabric first, then run the application Compose commands above.
4. Capture `docker compose ps`, image IDs, endpoint status codes, authenticated smoke output, and `peer lifecycle chaincode querycommitted` if Fabric was touched.
5. Record rollback commands and the exact backup path in the remediation change log/workbook.

## Additional clinic onboarding

Adding a clinic is not only a database row. For the accepted test topology, a new clinic must map to an existing Fabric organization or be onboarded as a new Fabric organization using the Fabric `addOrg3` pattern, with explicit MSP, CA, peer, anchor-peer, channel, and endorsement-policy changes. Then:

1. Create the clinic/organization record and assign its stable clinic ID/MSP mapping.
2. Enroll a clinic admin certificate with the required `role=admin` and `clinicID` attributes.
3. Enroll doctor/patient actor certificates with stable `actorID` attributes as accounts are activated.
4. Place the required identities in the mounted wallet or adopt an external wallet/secret store before production.
5. Update the connection profile and Compose hostname mappings when new peer endpoints are introduced.
6. Revoke certificates through the Fabric CA when users are disabled, deleted, compromised, or transferred; refresh CRLs/channel MSP configuration as required.

The current scripts provision known identities from environment lists. Fully automated database-to-CA enrollment/revocation remains an open production-readiness item.
