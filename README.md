# Blockchain-Based Electronic Dental Record System

This repository contains a consent-based electronic dental record platform built with Hyperledger Fabric, Node.js, React, Expo, and MySQL.

## Components

- `backend/` — application and database API
- `dental-backend/` — private Hyperledger Fabric adapter
- `bc-dentistry-frontend/` — React web application
- `BC-Dentistry-Mobile-App/` — Expo mobile application
- `fabric-samples/dental-record-sharing/` — EDR chaincode
- `database/` — database schema and migrations
- `scripts/` — database migration helpers
- `docker-compose.yml` — containerized application services

The web and mobile clients communicate with the application API. The blockchain adapter is an internal service and should not be exposed as a public client API.

## Prerequisites

- Docker Engine with Docker Compose
- Node.js 18 or newer and npm
- Hyperledger Fabric 2.5-compatible network and Fabric CA
- MySQL 8 when running outside Docker Compose
- Expo tooling for mobile development

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

## Container startup

After configuring `.env` and providing the Fabric runtime assets:

```bash
docker compose config
docker compose up -d --build
docker compose ps
```

The application stack contains:

- `mysql`
- `blockchain-api`
- `database-api`
- `web-frontend`

The Fabric network is managed separately and must be available before blockchain operations are used.

## Local development

Install dependencies in each component before running it:

```bash
cd backend
npm ci
npm test

cd ../dental-backend
npm ci
npm test

cd ../bc-dentistry-frontend
npm ci
npm test
npm run build

cd ../BC-Dentistry-Mobile-App
npm ci
npm test -- --runInBand
```

Common development commands:

```bash
# Application API
cd backend && npm start

# Blockchain adapter
cd dental-backend && npm start

# Web application
cd bc-dentistry-frontend && npm run dev

# Mobile application
cd BC-Dentistry-Mobile-App && npm start
```

## Database migrations

Apply the SQL migrations in `database/migrations/` in chronological order. The scripts under `scripts/` provide deployment-oriented migration helpers. Back up the database before applying migrations in an existing environment.

## Security notes

- Use TLS at the public ingress and restrict allowed CORS origins.
- Keep the blockchain adapter on a private network boundary.
- Use different values for JWT, refresh-token, session-metadata, MFA-encryption, and internal-service secrets.
- Store Firebase service-account credentials only in the server environment.
- Never commit generated Fabric identities, wallets, private keys, production database dumps, or patient data.
