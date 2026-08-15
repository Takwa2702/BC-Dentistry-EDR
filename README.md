# Blockchain-Based Electronic Dental Record System

This repository contains a consent-based electronic dental record platform built with Hyperledger Fabric, Node.js, React, Expo, and MySQL.

## Components

- `backend/` — application and database API
- `dental-backend/` — private Hyperledger Fabric adapter
- `bc-dentistry-frontend/` — React web application
- `BC-Dentistry-Mobile-App/` — Expo mobile application source
- `fabric-samples/dental-record-sharing/` — EDR chaincode
- `database/` — database schema and migrations
- `scripts/` — database migration helpers
- `docker-compose.yml` — containerized application services

The web client communicates with the application API. The blockchain adapter is an internal service and should not be exposed as a public client API. The mobile application is distributed separately and is not a long-running Compose service.

## Prerequisites

- Docker Engine with Docker Compose
- Hyperledger Fabric 2.5-compatible network and Fabric CA
- Expo tooling only when building the mobile application

Node.js, npm, MySQL, and the web/API runtimes are provided by the application containers and do not need to be installed on the Compose host.

## Configuration

Copy the Compose environment template and replace every placeholder before startup:

```bash
cp .env.compose.example .env
```

Generate independent high-entropy values for authentication, session, MFA, and internal-service secrets. Do not commit `.env`, private keys, Fabric wallets, connection profiles containing credentials, or Firebase service-account JSON.

The Fabric connection profile and application wallet are runtime assets. By default, Compose expects them under:

```text
dental-backend/connection/
dental-backend/wallet/
```

## Application startup

The application is built and operated through Docker Compose. After configuring `.env` and providing the Fabric runtime assets:

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

The Compose stack contains:

- `mysql`
- `blockchain-api`
- `database-api`
- `web-frontend`

The Fabric network is managed separately and must be available before blockchain operations are used.

## Common operations

```bash
# View application status
docker compose ps

# Follow service logs
docker compose logs -f database-api blockchain-api web-frontend

# Rebuild and recreate the application services
docker compose up -d --build database-api blockchain-api web-frontend

# Stop the application containers
docker compose down
```

Do not use `docker compose down -v` in an environment whose MySQL volume must be preserved.

## Database migrations

Apply the SQL migrations in `database/migrations/` in chronological order as part of the deployment process. The scripts under `scripts/` provide migration helpers for the containerized environment. Back up the database before applying migrations to an existing deployment.

## Mobile application

The Expo mobile source is located in `BC-Dentistry-Mobile-App/`. It is built as an Android or iOS client and connects to the deployed application API; it is intentionally excluded from the long-running Docker Compose services.

## Security notes

- Use TLS at the public ingress and restrict allowed CORS origins.
- Keep the blockchain adapter on a private network boundary.
- Use different values for JWT, refresh-token, session-metadata, MFA-encryption, and internal-service secrets.
- Store Firebase service-account credentials only in the server environment.
- Never commit generated Fabric identities, wallets, private keys, production database dumps, or patient data.
