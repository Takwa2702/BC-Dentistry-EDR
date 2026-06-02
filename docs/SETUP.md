# EDR System — Setup & Testing Handover

**Blockchain-Based Electronic Dental Record (EDR) Sharing & Management System**
University of Sharjah — Department of Computer Science
Hyperledger Fabric 2.5 · Node.js · React.js · Expo (React Native) · MySQL

This document is the setup and testing handover guide. It maps directly to the
artifacts requested for the technical review. Section references are noted
against each requested item below.

---

## 0. Requested Artifacts — Index

| # | Requested item | Where it is covered |
|---|----------------|---------------------|
| 1 | Setup automation (Docker Compose / equivalent) | §5 (Docker Compose), §6 (manual steps) |
| 2 | Complete web frontend source | `bc-dentistry-frontend/` in this repo |
| 3 | Complete mobile application source | `BC-Dentistry-Mobile-App/` in this repo |
| 4 | Fabric test-network files + setup | §6 Steps 1–4; `fabric-samples/` |
| 5 | Connection profile + wallet identity setup | §6 Step 5 |
| 6 | Validated DB dump, seed data, MySQL version | §7; `database/README.md` |
| 7 | Test credentials (Admin / Doctor / Patient) | §8 |
| 8 | Sanitized environment config files | `*/.env.example`; §9 |
| 9 | Running environment details (infra, ports, versions) | §3, §10 |
| 10 | Defect-resolution team | §11 |

> **Secrets:** No real passwords, JWT secrets, or private keys are committed to
> this repository. All `.env.example` files use placeholders. The real database
> password and any required secrets are provided separately through a secure
> channel.

---

## 1. Overview

Decentralized, consent-based, patient-centric EDR sharing across multiple dental
clinics. Hyperledger Fabric is the permissioned blockchain enforcing role-based
access control, patient consent, and immutable audit logging.

- 3-tier consent workflow (Doctor → Admin → Patient), enforced in chaincode
- Hybrid on-chain/off-chain: metadata + SHA-256 hashes on-chain; clinical data in MySQL
- Roles: Admin, Doctor, Patient
- Web portal (React.js / Vite) for Admins and Doctors
- Mobile app (Expo / React Native) for Patients
- Benchmarked with Hyperledger Caliper (read ~43.5 TPS; write ~25 TPS at 200 TX)

---

## 2. Repository Structure

```
BC-Dentistry-EDR/
├── fabric-samples/                  Hyperledger Fabric (includes bin/ binaries, Linux amd64)
│   ├── bin/                         peer / orderer / configtxgen / cryptogen ...
│   ├── config/                      core.yaml
│   └── test-network/                network.sh, organizations/ (crypto generated at runtime)
├── dental-record-sharing/
│   └── chaincode-javascript/        JavaScript chaincode (deployed as 'basic')
├── dental-backend/                  Node.js Blockchain API (index.js)
│   ├── connection/                  connection-org1.json (copied at runtime)
│   ├── wallet/                      Fabric identities (generated at runtime)
│   └── .env.example
├── backend/         Node.js Database API (server.js)
│   └── .env.example
├── bc-dentistry-frontend/           React.js (Vite) web app
│   └── .env.example
├── BC-Dentistry-Mobile-App/         Expo mobile app
│   └── .env.example
├── database/                        schema.sql, seed.sql, dump instructions
├── caliper-benchmarks/              Hyperledger Caliper benchmarks
├── docs/                            This guide + BRD/SRS documents
├── docker-compose.yml               Off-chain services (MySQL + APIs)
└── README.md
```

> **Note on Fabric binaries:** `fabric-samples/bin/` contains Linux amd64
> binaries. On a different OS/architecture, re-download them with the official
> installer (see §4).

---

## 3. Running Environment Details

| Layer | Technology | Version |
|-------|-----------|---------|
| Blockchain | Hyperledger Fabric | 2.5.0 |
| Chaincode | JavaScript (`basic`) | ES2020 |
| Consensus | Raft (CFT) | — |
| Blockchain API | Node.js | 22.5.1 |
| Database API | Node.js + Express | 22.5.1 |
| Database | MySQL (Docker) | 9.0.1 |
| Web Frontend | React.js (Vite) | 18.3.1 |
| Mobile App | Expo / React Native | 0.76.7 |
| Containerization | Docker Engine | 26.0.0+ |
| Benchmarking | Hyperledger Caliper | 0.6.0 |

**Ports**

| Service | Port |
|---------|------|
| Blockchain API | 3000 |
| Database API | 3001 |
| MySQL | 3306 |
| Web frontend (Vite dev) | 5174 |
| Fabric orderer | 7050 |
| Fabric peer0 Org1 | 7051 |
| Fabric peer0 Org2 | 9051 |

**Runtime constraints**

- Linux host (developed/tested on Ubuntu 20.04 LTS).
- The blockchain API runs on the host (not containerized) so it can reach the
  Fabric peers on `localhost:7051` / `localhost:9051`.
- `connection-org1.json` is regenerated every time the network is brought up;
  the wallet must be re-enrolled on each fresh network start (see §6 Step 5).

---

## 4. Prerequisites

```bash
# System packages
sudo apt-get update && sudo apt-get install -y curl git wget build-essential jq

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo usermod -aG docker $USER && newgrp docker

# Node.js v22
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22

# Go
wget https://go.dev/dl/go1.21.8.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.8.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc && source ~/.bashrc

# Expo CLI
npm install -g expo-cli
```

**Clone**

```bash
git clone https://github.com/Takwa2702/BC-Dentistry-EDR.git
cd BC-Dentistry-EDR
```

**Fabric binaries** (only if not using the committed `fabric-samples/bin/`, or on
a non-Linux-amd64 host):

```bash
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.0 binary docker
```

**Configure environment files** — copy each example and fill in values:

```bash
cp dental-backend/.env.example            dental-backend/.env
cp backend/.env.example   backend/.env
cp bc-dentistry-frontend/.env.example      bc-dentistry-frontend/.env
cp BC-Dentistry-Mobile-App/.env.example   BC-Dentistry-Mobile-App/.env
```

Generate JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 5. Quick Start — Off-chain Services via Docker Compose

This brings up MySQL (with schema + seed auto-imported) and, optionally, the
Database API. The Fabric network and Blockchain API are started separately (§6).

```bash
# 1. Set the MySQL password used by compose (one option):
export MYSQL_ROOT_PASSWORD='<your-db-password>'

# 2. Bring up MySQL only
docker compose up -d mysql

# 3. (Optional) bring up the Database API too
docker compose up -d
```

On first run, every `.sql` file in `database/` is imported automatically. To
reset the database, remove the volume: `docker compose down -v`.

---

## 6. Full System Startup — Step by Step (manual)

> Open a separate terminal for each step.

### Step 0 — Restart exited containers (when resuming)

```bash
docker start $(docker ps -aq -f status=exited)
```

### Step 1 — Fabric network (Terminal 1)

```bash
cd fabric-samples/test-network
./network.sh down
./network.sh up createChannel -c mychannel -ca

# Verify
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Step 2 — Deploy chaincode (Terminal 1)

```bash
./network.sh deployCC \
  -ccn basic \
  -ccp ../dental-record-sharing/chaincode-javascript \
  -ccl javascript
```

### Step 3 — Peer CLI environment (Terminal 1)

```bash
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer channel list   # should list: mychannel
```

### Step 4 — Initialize & smoke-test the ledger (Terminal 1)

```bash
peer chaincode invoke -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com --tls \
  --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n basic \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"InitLedger","Args":[]}'

# Smoke tests
peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllDoctors"]}'
peer chaincode query -C mychannel -n basic -c '{"function":"getDentalFiles","Args":["Patient1"]}'
peer chaincode query -C mychannel -n basic -c '{"Args":["getAllPatients"]}'
```

### Step 5 — Blockchain API + wallet/connection setup (Terminal 2)

> The connection profile is regenerated on every `network.sh up`, so this step
> is mandatory on each fresh start.

```bash
cd dental-backend

# Clear stale identities and profile
rm -f connection/connection-org1.json wallet/admin.id wallet/appUser.id

# Copy the freshly generated connection profile from the running network.
# Adjust the path prefix to wherever fabric-samples lives on your machine.
cp ../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json \
   connection/

# Enroll admin + register app user into the local wallet
node enrollAdmin.js
node registerUser.js

# First run only
npm install

# Start the API (http://localhost:3000)
node index.js
```

### Step 6 — Database API (Terminal 3)

```bash
# Ensure MySQL is up (via compose, §5, or your existing container)
docker compose up -d mysql      # if using compose

cd backend
npm install        # first run only
node server.js     # http://localhost:3001
```

### Step 7 — Web app (Terminal 4)

```bash
cd bc-dentistry-frontend
npm install        # first run only
npm run dev -- --port 5174   # http://localhost:5174
```

### Step 8 — Mobile app (Terminal 5)

```bash
cd BC-Dentistry-Mobile-App
npm install        # first run only
npx expo start
```

> Physical devices must share Wi-Fi with the host. Set `API_BASE_URL` /
> `BLOCKCHAIN_API_URL` in `.env` to the machine's LAN IP, not `localhost`.

### Shutdown

```bash
# Terminals 2–5: Ctrl+C
cd fabric-samples/test-network && ./network.sh down
docker compose down            # stops MySQL / APIs
```

---

## 7. Database (Item 6)

- **MySQL version:** 9.0.1
- **Database:** `mydatabase`, user `root`
- **Schema, seed data, and dump instructions:** see `database/README.md`
- Password is provided separately; it is not stored in the repo.

When started via Docker Compose, `database/schema.sql` and `database/seed.sql`
are imported automatically on first run.

---

## 8. Test Credentials (Item 7)

> Development/test accounts only. All use placeholder passwords; do not use in
> production.

| Role | Username / Email | Password |
|------|------------------|----------|
| Admin | admin1@gmail.com | test@123 |
| Admin | admin2@gmail.com | test@123 |
| Doctor | doctor1@example.com | test@123 |
| Doctor | doctor2@example.com | test@123 |
| Patient | john.doe@example.com | test@123 |
| Patient | jane.doe@example.com | test@123 |
| Patient | mark.lee@example.com | test@123 |

> **ACTION REQUIRED:** Fill in the Patient row with the actual login the mobile
> app uses (e.g. `Patient1` / patient email). The reviewer specifically requested
> Admin, Doctor, **and** Patient credentials.

---

## 9. Environment Configuration (Item 8)

Sanitized templates are committed for each component:

- `dental-backend/.env.example` — blockchain API
- `backend/.env.example` — database API
- `bc-dentistry-frontend/.env.example` — web app
- `BC-Dentistry-Mobile-App/.env.example` — mobile app

Copy each to `.env` and fill in the real values (see §4). Real secrets are
shared separately.

---

## 10. Performance Benchmarking (reference)
| Operation | TX Load | TPS | Avg Latency (s) |
|-----------|---------|-----|-----------------|
| Read | 1 | 43.5 | 0.01 |
| Read | 200 | 40.1 | 0.02 |
| Write | 1 | 0.4 | ~2.0 |
| Write | 200 | 24.8 | ~0.9 |
| Delete | 200 | ~25.0 | ~0.9 |

Benchmark configs and run commands are in `caliper-benchmarks/`.

---

## 11. Defect Resolution (Item 10)

Defects and gaps identified during testing will be triaged and resolved by the
**EDR implementation team at the University of Sharjah** (primary contact: the
project developer). Please log issues with reproduction steps, expected vs.
actual behaviour, and relevant logs; turnaround will be confirmed per the agreed
testing schedule (T0-based).

---

## 12. Troubleshooting

**Containers not starting**
```bash
docker start $(docker ps -aq -f status=exited)
docker logs peer0.org1.example.com
```

**"channel already exists" on network up**
```bash
cd fabric-samples/test-network
./network.sh down
docker volume prune -f && docker network prune -f
./network.sh up createChannel -c mychannel -ca
```

**Wallet / identity errors in dental-backend** — re-run Step 5 (clear wallet +
connection profile, re-enroll).

**`peer: command not found`**
```bash
cd fabric-samples/test-network
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
```

**Expo app cannot reach API on a physical device**
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1   # find LAN IP
# set API_BASE_URL in BC-Dentistry-Mobile-App/.env, then:
npx expo start --clear
```

**`ENDORSEMENT_POLICY_FAILURE` on invoke** — include both org peer addresses
(`localhost:7051` and `localhost:9051`) with their TLS root certs (see Step 4).

**CORS error in browser** — set `CORS_ORIGIN=http://localhost:5174` in
`dental-backend/.env` and restart the API.
