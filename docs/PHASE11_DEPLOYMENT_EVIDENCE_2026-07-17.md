# Phase 11 Test VM Deployment Evidence — 2026-07-17

## Source and backup

- Branch: `release/clean-deployable-20260717`
- Implementation commit: `8e03f22` (`Containerize Phase 11 application services`)
- VM repository path: `/home/ubuntu/EDR`
- Predeployment backup: `/home/ubuntu/deployment-backups/20260717-142031-phase11-predeploy`
- Backup contents include Git state/diff, target source files, root/API environments, Compose override, Fabric connection profile and wallet, Nginx site configuration, radiographic files, and a full MySQL dump.
- No database migration or Fabric chaincode upgrade was required.

## Deployed application containers

| Service | Image | Result |
|---|---|---|
| MySQL | `mysql:9.0.1` | Healthy |
| Blockchain API | `edr-blockchain-api:latest` | Healthy; port 8081 |
| Database API | `edr-database-api:latest` | Healthy; port 8080 |
| Web frontend/Nginx | `edr-web-frontend:latest` | Healthy; port 5173 |

The former PM2 `edr-blockchain-api` process was removed after the container passed health and smoke checks. Host Nginx retains TLS termination and proxies public frontend traffic to the web container. Legacy `/database-api/` and `/blockchain-api/` routes remain compatible.

The existing private `/var/lib/edr/radiographic-files` directory is mounted into the Blockchain API container. MySQL remains on its persistent Compose volume. The Fabric connection profile and role-bound wallet are mounted read-only.

## Validation

- Node syntax checks passed for both APIs and the connection-profile preparer.
- Blockchain/API source tests passed: 39/39.
- Frontend source tests passed: 16/16.
- `docker compose config` passed.
- All four Compose services were running; all four health checks passed.
- Direct frontend and API health endpoints returned HTTP 200.
- Same-origin frontend proxies for both APIs returned HTTP 200.
- Public `https://edr.bizcenter.tech/` returned HTTP 200 through the frontend container.
- An unauthenticated protected Blockchain API request returned HTTP 401.
- Admin, doctor, and patient logins passed.
- An authenticated admin Blockchain API query reached Fabric from the container and returned two clinic-scoped patients.
- Doctor assigned-patient and patient appointment reads passed through the containerized APIs.
- Smoke marker: `PHASE11_CONTAINER_FABRIC_SMOKE_OK`.

## Fabric lifecycle state

Fabric remained on the documented network-tooling exception path. No chaincode lifecycle change was made.

```text
Chaincode: basic
Version: 1.0.9
Sequence: 11
Approvals: Org1MSP=true, Org2MSP=true
```

## Remaining production limitation

This is the accepted test topology: one peer per organization and one orderer. It is not the SRS production HA topology. Two peers per organization, at least three Raft orderers, failover evidence, production connection profiles, and automated clinic/user certificate lifecycle remain production-readiness work.
