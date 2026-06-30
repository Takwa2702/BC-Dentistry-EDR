# Blockchain-Based Electronic Dental Record (EDR) Sharing & Management System

> **University of Sharjah - OpenUAE Research & Development Group**  
> Built on **Hyperledger Fabric 2.5** · **Node.js** · **React.js** · **Expo (React Native)** · **MySQL**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [System Architecture](#3-system-architecture)
4. [Prerequisites](#4-prerequisites)
5. [Full System Startup — Step by Step](#5-full-system-startup--step-by-step)
   - [Step 0 — Restart Exited Docker Containers](#step-0--restart-exited-docker-containers)
   - [Step 1 — Hyperledger Fabric Network](#step-1--hyperledger-fabric-network)
   - [Step 2 — Deploy Chaincode](#step-2--deploy-chaincode-smart-contract)
   - [Step 3 — Set Peer CLI Environment](#step-3--set-peer-cli-environment)
   - [Step 4 — Initialize and Test the Ledger](#step-4--initialize--test-the-ledger)
   - [Step 5 — Blockchain API](#step-5--blockchain-api-dental-backend)
   - [Step 6 — Database and SQL API](#step-6--database--sql-api-backend)
   - [Step 7 — Web Application](#step-7--web-application-reactjs)
   - [Step 8 — Mobile Application](#step-8--mobile-application-expo)
6. [Quick Reference — All Commands](#6-quick-reference--all-commands)
7. [Chaincode Functions Reference](#7-chaincode-functions-reference)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Database Reference](#9-database-reference)
10. [Performance Benchmarking — Caliper](#10-performance-benchmarking--hyperledger-caliper)
11. [Environment Variables](#11-environment-variables)
12. [User Roles & Test Credentials](#12-user-roles--test-credentials)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Project Overview

This system provides a **decentralized, consent-based, patient-centric** Electronic Dental Record (EDR) sharing platform across multiple dental clinics. **Hyperledger Fabric** serves as the permissioned blockchain backbone to enforce role-based access control, patient consent, and immutable audit logging.

### Key Features
- Smart contract-driven 3-tier patient consent workflow (Doctor → Admin → Patient)
- Hybrid on-chain/off-chain architecture (metadata + SHA-256 hashes on-chain; clinical data in MySQL)
- Role-based access control: **Admin**, **Doctor**, **Patient**
- Web portal (React.js / Vite) for Admins and Doctors
- Mobile app (Expo / React Native) for Patients
- Benchmarked with Hyperledger Caliper: 43.5 TPS read, ~25 TPS write at 200 TX
- HIPAA and GDPR-aligned architecture

---

## 2. Repository Structure

```
BC-Dentistry-EDR/
│
├── fabric-samples/                          ← Hyperledger Fabric test-network
│   ├── bin/                                 ← peer / orderer binaries
│   ├── config/                              ← core.yaml
│   └── test-network/
│       ├── network.sh                       ← Main network script
│       └── organizations/                   ← Auto-generated crypto (gitignored)
│
├── dental-record-sharing/                   ← (deploy alongside this repo)
│   └── chaincode-javascript/               ← JavaScript chaincode deployed as 'basic'
│       ├── index.js
│       ├── package.json
│       └── lib/
│           └── dentalRecordSharing.js
│
├── dental-backend/                          ← Blockchain API (Hyperledger Fabric SDK)
│   ├── connection/
│   │   └── connection-org1.json            ← Copied at runtime from test-network
│   ├── wallet/                              ← Fabric identities (gitignored)
│   ├── enrollAdmin.js
│   ├── registerUser.js
│   ├── index.js                             ← API entry point  (port 8081)
│   ├── .env.example
│   └── package.json
│
├── backend/                                 ← Database API (MySQL / Express)
│   ├── server.js                            ← API entry point  (port 8080)
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── bc-dentistry-frontend/                   ← React.js (Vite) Web App
│   ├── src/
│   ├── .env.example
│   └── package.json
│
├── BC-Dentistry-Mobile-App/                 ← Expo Mobile App (React Native)
│   ├── app/
│   ├── app.json
│   └── package.json
│
├── database/
│   └── dump.sql                             ← Full MySQL schema + seed data
│
├── caliper-benchmarks/                      ← Hyperledger Caliper benchmarks
│
├── docs/
│   └── SETUP.md                             ← Detailed handover guide
│
├── docker-compose.yml                       ← MySQL + Database API (off-chain services)
└── README.md
```

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      USER INTERACTION LAYER                         │
│   React.js / Vite  (port 5174)        Expo Mobile App              │
│   Admins & Doctors                    Patients                      │
└──────────────────┬──────────────────────────┬──────────────────────┘
                   │ HTTP / REST               │ HTTP / REST
       ┌───────────▼──────────┐    ┌───────────▼──────────────────┐
       │  BLOCKCHAIN API      │    │  DATABASE API                 │
       │  dental-backend/     │    │  backend/                     │
       │  index.js            │    │  server.js                    │
       │  Port: 8081          │    │  Port: 8080                   │
       │  Fabric SDK · JWT    │    │  MySQL · REST · JWT           │
       └───────────┬──────────┘    └───────────┬──────────────────┘
                   │ Fabric SDK                 │ SQL
  ┌────────────────▼────────────┐  ┌────────────▼──────────────────┐
  │  HYPERLEDGER FABRIC         │  │  MYSQL DATABASE               │
  │  Channel:    mychannel      │  │  Container: edr-mysql         │
  │  Chaincode:  basic          │  │  Database:  mydatabase        │
  │  Org1 (Clinic A): 2 peers   │  │  User:      root              │
  │  Org2 (Clinic B): 2 peers   │  └───────────────────────────────┘
  │  Ordering:   Raft           │
  └─────────────────────────────┘
```

---

## 4. Prerequisites

### Required Versions

| Tool | Version |
|------|---------|
| Docker Engine | 26.0.0+ |
| Docker Compose | v2+ |
| Node.js | 22.5.1 |
| npm | 10+ |
| Go | 1.21.8 |
| Expo CLI | latest |

### Install (Ubuntu 20.04 LTS)

```bash
# System packages
sudo apt-get update && sudo apt-get install -y curl git wget build-essential jq

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo usermod -aG docker $USER && newgrp docker

# Node.js v22 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22

# Go 1.21
wget https://go.dev/dl/go1.21.8.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.8.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc && source ~/.bashrc

# Expo CLI
npm install -g expo-cli
```

### Clone the Repository

```bash
git clone https://github.com/Takwa2702/BC-Dentistry-EDR.git
cd BC-Dentistry-EDR
```

### Download Hyperledger Fabric Binaries

The `fabric-samples/` directory is included in this repo but the peer/orderer binaries are **not** (they are 270 MB of platform-specific executables). Run the installer from **inside** `fabric-samples/` so the files land in the right place:

```bash
cd fabric-samples
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
# Downloads bin/ and config/ into the current directory (fabric-samples/)
./install-fabric.sh --fabric-version 2.5.4 binary
cd ..
```

Verify all 10 binaries are present:

```bash
ls fabric-samples/bin/
# configtxgen  configtxlator  cryptogen  discover
# fabric-ca-client  fabric-ca-server  ledgerutil  orderer  osnadmin  peer
```

> **If `fabric-ca-client` is missing** (the download can time out on slow connections):
> ```bash
> # Re-try just the CA binary download
> cd fabric-samples
> ./install-fabric.sh --ca-version 1.5.7 binary
> cd ..
> ```
> If it still fails, copy the binaries from another machine that already has them.

---

## 5. Full System Startup — Step by Step

> Open a **separate terminal** for each step. Steps must run in order.

---

### Step 0 — Restart Exited Docker Containers

> Run this first if resuming a previous session.

```bash
docker start $(docker ps -aq -f status=exited)
```

---

### Step 1 — Hyperledger Fabric Network

> **Terminal 1**

```bash
cd fabric-samples/test-network

# Tear down any existing state
./network.sh down

# Bring up the network, create channel 'mychannel', enable CAs
./network.sh up createChannel -c mychannel -ca
```

Verify all containers are running:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
# Expected:
# peer0.org1.example.com   Up
# peer0.org2.example.com   Up
# orderer.example.com      Up
# ca_org1                  Up
# ca_org2                  Up
```

---

### Step 2 — Deploy Chaincode (Smart Contract)

> **Terminal 1** — still inside `fabric-samples/test-network/`

```bash
# Deploy JavaScript chaincode named 'basic' on 'mychannel'
./network.sh deployCC \
  -ccn basic \
  -ccp ../dental-record-sharing/chaincode-javascript \
  -ccl javascript
```

Expected output: `Chaincode definition committed on channel 'mychannel'`

---

### Step 3 — Set Peer CLI Environment

> **Terminal 1**

```bash
# Add peer binaries to PATH
export PATH=${PWD}/../bin:$PATH

# Point to core.yaml
export FABRIC_CFG_PATH=$PWD/../config/

# Org1 peer environment variables
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

Verify:

```bash
peer channel list
# Channels peers has joined: mychannel
```

---

### Step 4 — Initialize & Test the Ledger

> **Terminal 1**

```bash
# Invoke InitLedger — seeds blockchain with initial data
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n basic \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"InitLedger","Args":[]}'
```

Expected: `Chaincode invoke successful. result: status:200`

Smoke tests:

```bash
# List all doctors
peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllDoctors"]}'

# Get dental files for Patient1
peer chaincode query -C mychannel -n basic -c '{"function":"getDentalFiles","Args":["Patient1"]}'

```

---

### Step 5 — Blockchain API (`dental-backend`)

> **Terminal 2**

```bash
cd dental-backend

# Create directories if they don't exist (first clone only)
mkdir -p connection wallet

# Remove stale wallet and connection profile (required on every fresh network start)
rm -f connection/connection-org1.json wallet/admin.id wallet/appUser.id

# Copy the fresh connection profile generated by the running network
cp ../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json \
   connection/connection-org1.json
```

> `connection-org1.json` is regenerated every time `./network.sh up` runs — this copy step is **mandatory** on each startup.

```bash
# Install dependencies (first run only)
npm install

# Enroll Fabric admin and application user into local wallet
node enrollAdmin.js
node registerUser.js

# Start the Blockchain API
node index.js
# Listening at http://localhost:8081
```

---

### Step 6 — Database & SQL API (`backend`)

> **Terminal 3**

#### Option A — Docker Compose (recommended)

```bash
# From repo root — start MySQL and the Database API together
cp backend/.env.example backend/.env
# Edit backend/.env and set DB_PASSWORD to a strong password

docker compose up -d
# MySQL available at localhost:3306
# Database API available at http://localhost:8080
```

Import the schema on first run (MySQL auto-imports files in `database/` on container creation):

```bash
# If you need to import manually:
docker exec -i edr-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" mydatabase < database/dump.sql
```

#### Option B — Manual (existing MySQL container)

```bash
# Start your existing MySQL container
docker start <your-mysql-container-id>

# Install dependencies (first run only)
cd backend && npm install

# Start the Database API
node server.js
# Listening at http://localhost:8080
```

To inspect the database directly:

```bash
docker exec -it edr-mysql mysql -uroot -p

mysql> SHOW DATABASES;
mysql> USE mydatabase;
mysql> SHOW TABLES;
mysql> SELECT * FROM User;
mysql> EXIT;
```

---

### Step 7 — Web Application (React.js)

> **Terminal 4**

```bash
cd bc-dentistry-frontend

# Copy environment config (first run only)
cp .env.example .env
# Edit .env if your APIs run on different hosts/ports

# Install dependencies (first run only)
npm install

# Start dev server on port 5174
npm run dev -- --port 5174
# Web app at http://localhost:5174
```

---

### Step 8 — Mobile Application (Expo)

> **Terminal 5**

```bash
cd BC-Dentistry-Mobile-App

# Copy environment config (first run only)
cp .env.example .env
# For physical devices, set API_BASE_URL to your machine's LAN IP (not localhost)

# Install dependencies (first run only)
npm install

# Start Expo
npx expo start
```

| Method | How to connect |
|--------|---------------|
| Physical device | Install **Expo Go** → scan QR code from terminal |
| Android emulator | Press `a` in the Expo terminal |
| iOS simulator (macOS) | Press `i` in the Expo terminal |

> Physical devices must be on the same Wi-Fi as your dev machine. Set `API_BASE_URL` in `.env` to your LAN IP.

---

## 6. Quick Reference — All Commands

```bash
###############################################################################
# TERMINAL 1 — Fabric Network + Chaincode
###############################################################################
cd fabric-samples/test-network
./network.sh down
./network.sh up createChannel -c mychannel -ca
./network.sh deployCC -ccn basic -ccp ../dental-record-sharing/chaincode-javascript -ccl javascript

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls \
  --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C mychannel -n basic \
  --peerAddresses localhost:7051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"InitLedger","Args":[]}'

###############################################################################
# TERMINAL 2 — Blockchain API  (http://localhost:8081)
###############################################################################
cd dental-backend
mkdir -p connection wallet
rm -f connection/connection-org1.json wallet/admin.id wallet/appUser.id
cp ../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json connection/
node enrollAdmin.js
node registerUser.js
node index.js

###############################################################################
# TERMINAL 3 — MySQL + Database API  (http://localhost:8080)
###############################################################################
# Option A: Docker Compose
docker compose up -d

# Option B: manual
docker start <mysql-container-id>
cd backend && node server.js

###############################################################################
# TERMINAL 4 — Web App  (http://localhost:5174)
###############################################################################
cd bc-dentistry-frontend
npm run dev -- --port 5174

###############################################################################
# TERMINAL 5 — Mobile App
###############################################################################
cd BC-Dentistry-Mobile-App
npx expo start
```

### Shutdown

```bash
# Terminals 2–5: Ctrl+C
cd fabric-samples/test-network && ./network.sh down
docker compose down   # stops MySQL + Database API
```

---

## 7. Chaincode Functions Reference

Channel: `mychannel` | Chaincode: `basic`

| Function | Description | Role | Type |
|----------|-------------|------|------|
| `InitLedger` | Seed blockchain with initial data | System | Write |
| `InitDoctors` | Seed doctor records | System | Write |
| `InitPatients` | Seed patient records | System | Write |
| `addDoctor` | Register a new doctor | Admin | Write |
| `UpdateDoctorInfo` | Update doctor profile | Admin | Write |
| `ReadDoctor` | Get doctor profile | Admin, Doctor | Read |
| `DeleteDoctor` | Remove doctor from ledger | Admin | Delete |
| `GetAllDoctors` | List all doctors | Admin | Read |
| `addPatient` | Register a new patient | Admin | Write |
| `UpdatePatientInfo` | Update patient data | Admin | Write |
| `ReadPatient` | Get patient profile | Admin, Doctor | Read |
| `DeletePatient` | Remove patient | Admin | Delete |
| `getAllPatients` | List all patients | Admin | Read |
| `RegisterPatientInClinic` | Associate patient with clinic | Admin | Write |
| `AssignPatientToDoctor` | Link patient to doctor | Admin | Write |
| `GetPatientsAssignedToDoctor` | Get doctor's patient list | Doctor | Read |
| `RequestDataAccess` | Initiate cross-clinic data request | Doctor | Write |
| `ApproveRequest` | Admin approves request | Admin | Write |
| `RejectRequest` | Admin rejects request | Admin | Write |
| `ProvideConsent` | Patient grants consent | Patient | Write |
| `RejectConsent` | Patient denies consent | Patient | Write |
| `LogAccess` | Log data access event | System | Write |
| `GetAllRequestsForPatient` | All consent requests | Patient | Read |
| `GetPendingRequestsForPatient` | Pending consent requests | Patient | Read |
| `GetRequestsForAdmin` | Active requests for org | Admin | Read |
| `AddMedicalRecord` | Store medical record hash on-chain | Doctor | Write |
| `GetMedicalRecords` | Retrieve medical records | Doctor, Patient | Read |
| `AddDentalChartEntry` | Add dental chart treatment entry | Doctor | Write |
| `GetAllDentalChartData` | Full dental chart history | Doctor, Patient | Read |
| `getDentalFiles` | Get dental files for patient | Doctor, Admin | Read |

### Example peer CLI queries

```bash
peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllDoctors"]}'
peer chaincode query -C mychannel -n basic -c '{"function":"getDentalFiles","Args":["Patient1"]}'
peer chaincode query -C mychannel -n basic -c '{"Args":["getAllPatients"]}'
peer chaincode query -C mychannel -n basic -c '{"function":"GetPendingRequestsForPatient","Args":["Patient1"]}'
```

---

## 8. API Endpoints Reference

### Blockchain API — `dental-backend/index.js` (port 8081)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/addDoctor` | Register doctor on blockchain | Admin |
| POST | `/addPatient` | Register patient on blockchain | Admin |
| GET | `/getAllPatients` | Get all patients | Admin |
| GET | `/getPatient/:id` | Get patient by ID | Admin, Doctor |
| POST | `/assignPatientToDoctor` | Link patient to doctor | Admin |
| POST | `/addMedicalRecord` | Add medical record | Doctor |
| GET | `/getDentalFiles/:patientId` | Get dental chart | Doctor, Patient |
| POST | `/requestDataAccess` | Initiate data access request | Doctor |
| POST | `/approveRequest` | Approve request | Admin |
| POST | `/provideConsent` | Grant consent | Patient |
| GET | `/getPendingRequestsForPatient/:id` | Get pending requests | Patient |

### Database API — `backend/server.js` (port 8080)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Authenticate user, receive JWT |
| POST | `/register` | Create admin account |
| POST | `/registerDoctor` | Create doctor account |
| GET | `/users` | Get all users |
| GET | `/Patient` | Get all patients |
| GET | `/Doctor` | Get all doctors |
| GET | `/Appointment` | Get all appointments |
| GET | `/Lab_Results` | Get lab results |
| POST | `/syncOnChainPatients` | Sync on-chain patients to MySQL |

---

## 9. Database Reference

### MySQL via Docker Compose

```bash
# Start (from repo root)
docker compose up -d mysql

# Access MySQL shell
docker exec -it edr-mysql mysql -uroot -p

mysql> SHOW DATABASES;
mysql> USE mydatabase;
mysql> SHOW TABLES;
mysql> SELECT * FROM User;
mysql> EXIT;
```

### Import schema manually

```bash
docker exec -i edr-mysql mysql -uroot -p"YOUR_PASSWORD" mydatabase < database/dump.sql
```

### Key tables

| Table | Description |
|-------|-------------|
| `User` | All system users (Admin, Doctor, Patient) |
| `UserRole` | Role definitions (1=SuperAdmin, 2=Admin, 3=Doctor, 4=Patient) |
| `Admin` | Admin-specific data (Organization_ID) |
| `Doctor` | Doctor-specific data (Works_At, Specialty, Blockchain_ID) |
| `Patient` | Patient-specific data (Date_of_Birth, Emirates_ID) |
| `Appointment` | Appointment records |

---

## 10. Performance Benchmarking — Hyperledger Caliper

### Install Caliper

```bash
npm install --only=prod @hyperledger/caliper-cli@0.6.0
npx caliper bind --caliper-bind-sut fabric:2.5
```

### Run benchmarks

```bash
cd caliper-benchmarks

npx caliper launch manager \
  --caliper-workspace . \
  --caliper-networkconfig networks/fabric-network.yaml \
  --caliper-benchconfig benchmarks/readPatient.yaml \
  --caliper-flow-only-test \
  --caliper-fabric-gateway-enabled
```

### Results

| Operation | TX Load | TPS | Avg Latency (s) |
|-----------|---------|-----|-----------------|
| Read | 1 | 43.5 | 0.01 |
| Read | 200 | 40.1 | 0.02 |
| Write | 1 | 0.4 | ~2.0 |
| Write | 200 | 24.8 | ~0.9 |
| Delete | 200 | ~25.0 | ~0.9 |

---

## 11. Environment Variables

Copy each `.env.example` to `.env` and fill in real values. Never commit `.env` files.

### `dental-backend/.env`

```env
PORT=8081
FABRIC_CHANNEL=mychannel
FABRIC_CHAINCODE=basic
FABRIC_CONNECTION_PROFILE=./connection/connection-org1.json
FABRIC_WALLET_PATH=./wallet
JWT_SECRET=CHANGE_ME   # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5174
```

### `backend/.env`

```env
PORT=8080
DB_HOST=localhost          # use 'mysql' when running via docker-compose
DB_PORT=3306
DB_NAME=mydatabase
DB_USER=root
DB_PASSWORD=CHANGE_ME
JWT_SECRET=CHANGE_ME
```

### `bc-dentistry-frontend/.env`

```env
VITE_BLOCKCHAIN_API_URL=http://localhost:8081
VITE_DATABASE_API_URL=http://localhost:8080
```

### `BC-Dentistry-Mobile-App/.env`

```env
# Use your machine's LAN IP for physical device testing (not localhost)
API_BASE_URL=http://192.168.x.x:8080
BLOCKCHAIN_API_URL=http://192.168.x.x:8081
```

---

## 12. User Roles & Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin1@gmail.com | test@123 |
| Admin | admin2@gmail.com | test@123 |
| Doctor | doctor1@example.com | test@123 |
| Doctor | doctor2@example.com | test@123 |

> These are development/test credentials only. Do not use in production.

---

## 13. Troubleshooting

### Containers not starting

```bash
docker start $(docker ps -aq -f status=exited)
docker logs peer0.org1.example.com
```

### "channel already exists" on network up

```bash
cd fabric-samples/test-network
./network.sh down
docker volume prune -f && docker network prune -f
./network.sh up createChannel -c mychannel -ca
```

### Wallet or identity errors in `dental-backend`

```bash
cd dental-backend
mkdir -p connection wallet
rm -f connection/connection-org1.json wallet/admin.id wallet/appUser.id
cp ../fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json connection/
node enrollAdmin.js && node registerUser.js && node index.js
```

### `peer: command not found`

```bash
cd fabric-samples/test-network
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
```

### MySQL container not responding

```bash
docker compose up -d mysql
docker logs edr-mysql
```

### Expo app cannot reach API on physical device

```bash
# Get your machine's LAN IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# Update BC-Dentistry-Mobile-App/.env
API_BASE_URL=http://<your-lan-ip>:8080
BLOCKCHAIN_API_URL=http://<your-lan-ip>:8081

npx expo start --clear
```

### ENDORSEMENT_POLICY_FAILURE on chaincode invoke

Both org peer addresses must be included:

```bash
--peerAddresses localhost:7051 \
--tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
--peerAddresses localhost:9051 \
--tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
```

### CORS error in browser

```bash
# In dental-backend/.env add:
CORS_ORIGIN=http://localhost:5174
# Restart: Ctrl+C then node index.js
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Blockchain | Hyperledger Fabric | 2.5.0 |
| Chaincode | JavaScript (`basic`) | ES2020 |
| Consensus | Raft (CFT) | — |
| Blockchain API | Node.js + Fabric SDK | 22.5.1 |
| Database API | Node.js + Express.js | 22.5.1 |
| Database | MySQL (Docker) | 9.0.1 |
| Web Frontend | React.js (Vite) | 18.3.1 |
| Mobile App | Expo / React Native | 0.76.7 |
| Containerization | Docker Engine | 26.0.0 |
| Benchmarking | Hyperledger Caliper | 0.6.0 |

---

## Authors

- **Takua Mokhamed** — Department of Computer Science, University of Sharjah
- **Dr. Manar Abu Talib** — Department of Computer Science, University of Sharjah
- **Mohammad Adel Moufti** — Department of Restorative Dentistry, University of Sharjah
- **Sohail Abbas** — Department of Computer Science, University of Sharjah

---

*University of Sharjah — College of Computing and Informatics*
