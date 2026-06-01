# Blockchain-Based Electronic Dental Record (EDR) Sharing & Management System

> **University of Sharjah — Department of Computer Science**  
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
   - [Step 6 — Database and SQL API](#step-6--database--sql-api-serverjs)
   - [Step 7 — Web Application](#step-7--web-application-reactjs)
   - [Step 8 — Mobile Application](#step-8--mobile-application-expo)
6. [Quick Reference — All Commands](#6-quick-reference--all-commands)
7. [Chaincode Functions Reference](#7-chaincode-functions-reference)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Database Reference](#9-database-reference)
10. [Performance Benchmarking — Caliper](#10-performance-benchmarking--hyperledger-caliper)
11. [Environment Variables](#11-environment-variables)
12. [Test Credentials](#12-user-roles--test-credentials)
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
edr-blockchain/
│
├── fabric-samples/                          ← Hyperledger Fabric (clone separately)
│   ├── bin/                                 ← peer / orderer binaries
│   ├── config/                              ← core.yaml
│   └── test-network/
│       ├── network.sh                       ← Main network script
│       └── organizations/                   ← Auto-generated crypto (gitignored)
│
├── dental-record-sharing/
│   └── chaincode-javascript/               ← JavaScript chaincode (deployed as 'basic')
│       ├── index.js
│       ├── package.json
│       └── lib/
│           └── dentalRecordSharing.js
│
├── dental-backend/                          ← Node.js Blockchain API
│   ├── connection/
│   │   └── connection-org1.json            ← Copied at runtime from test-network
│   ├── wallet/                              ← Fabric identities (gitignored)
│   ├── enrollAdmin.js
│   ├── registerUser.js
│   ├── index.js                             ← API entry point
│   ├── .env.example
│   └── package.json
│
├── dental-database-backend/                 ← Node.js Database API
│   ├── server.js                            ← API entry point
│   ├── .env.example
│   └── package.json
│
├── dental-frontend/                         ← React.js (Vite) Web App
│   ├── src/
│   ├── .env.example
│   └── package.json
│
├── BC-Dentistry-Mobile-App/                 ← Expo Mobile App
│   │                                          (github.com/amxr21/BC-Dentistry-Mobile-App)
│   ├── src/screens/
│   ├── app.json
│   └── package.json
│
├── database/
│   └── schema.sql                           ← Full MySQL schema
│
├── caliper/                                 ← Hyperledger Caliper benchmarks
│   ├── benchmarks/
│   ├── networks/
│   └── workloads/
│
├── docs/
│   ├── BRD-EDR-001_Blockchain_EDR_System.docx
│   └── SRS-EDR-001_Blockchain_EDR_System.docx
│
├── .gitignore
└── README.md
```

> **Mobile app repo:** https://github.com/amxr21/BC-Dentistry-Mobile-App

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
       │  dental-backend      │    │  dental-database-backend      │
       │  index.js            │    │  server.js                    │
       │  Fabric SDK · JWT    │    │  MySQL · REST                 │
       └───────────┬──────────┘    └───────────┬──────────────────┘
                   │ Fabric SDK                 │ SQL
  ┌────────────────▼────────────┐  ┌────────────▼──────────────────┐
  │  HYPERLEDGER FABRIC         │  │  MYSQL DATABASE               │
  │  Channel:    mychannel      │  │  Container: 55c61e4f72f7      │
  │  Chaincode:  basic          │  │  Database:  mydatabase        │
  │  Org1 (Clinic A): 2 peers   │  │  User:      root              │
  │  Org2 (Clinic B): 2 peers   │  │  Pass:      OpenUAE@123       │
  │  Ordering:   Raft           │  └───────────────────────────────┘
  └─────────────────────────────┘
```

---

## 4. Prerequisites

### Required Versions

| Tool | Version |
|------|---------|
| Docker Engine | 26.0.0+ |
| Node.js | 22.5.1 |
| Go | 1.21.8 |
| Expo CLI | latest |

### Install (Ubuntu 20.04 LTS)

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

# Expo
npm install -g expo-cli
```

### Clone the Project

```bash
git clone https://github.com/<your-org>/edr-blockchain.git
cd edr-blockchain

# Clone mobile app
git clone https://github.com/amxr21/BC-Dentistry-Mobile-App.git
```

### Download Fabric Binaries

```bash
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.0 binary docker
```

---

## 5. Full System Startup — Step by Step

> Open a **separate terminal** for each step.

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

# Clean any existing state
./network.sh down

# Bring up network, create channel 'mychannel', with CAs
./network.sh up createChannel -c mychannel -ca
```

Verify containers:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
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

Expected: `Chaincode definition committed on channel 'mychannel'`

---

### Step 3 — Set Peer CLI Environment

> **Terminal 1**

```bash
# Add peer binaries to PATH
export PATH=${PWD}/../bin:$PATH

# Point to core.yaml
export FABRIC_CFG_PATH=$PWD/../config/

# Org1 peer environment
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

Check:

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

# List all patients
peer chaincode query -C mychannel -n basic -c '{"Args":["getAllPatients"]}'
```

---

### Step 5 — Blockchain API (dental-backend)

> **Terminal 2**

```bash
cd dental-backend

# Remove stale wallet and connection profile (required on every fresh network start)
rm -f connection/connection-org1.json wallet/admin.id wallet/appUser.id

# Copy the new connection profile generated by the running network
mv /home/openuae/BC_Dentistry_temp/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json \
   connection/
```

> ⚠️ Adjust the source path if your `fabric-samples` lives elsewhere.  
> `connection-org1.json` is regenerated every time `./network.sh up` is run — this step is mandatory on each startup.

```bash
# Enroll Fabric admin and application user into local wallet
node enrollAdmin.js
node registerUser.js

# Install dependencies (first run only)
npm install

# Start the blockchain API
node index.js
# Running at http://localhost:3000
```

---

### Step 6 — Database & SQL API (server.js)

> **Terminal 3**

```bash
# If MySQL container is stopped, start it first
docker start 55c61e4f72f7

# Verify it is running
docker ps | grep 55c61e4f72f7

# Start the database API
cd dental-database-backend
node server.js
# Running at http://localhost:3001
```

To inspect the database directly:

```bash
docker exec -it 55c61e4f72f7 mysql -uroot -p
# Password: OpenUAE@123

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
cd dental-frontend

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

# Install dependencies (first run only)
npm install

# Start Expo
npx expo start
```

| Method | How to connect |
|--------|---------------|
| Physical device | Install **Expo Go** app → scan QR code from terminal |
| Android emulator | Press `a` in the Expo terminal |
| iOS simulator (macOS) | Press `i` in the Expo terminal |

> ⚠️ Physical devices must be on the same Wi-Fi as your machine. Set `API_BASE_URL` in `.env` to your machine's LAN IP, not `localhost`.

---

## 6. Quick Reference — All Commands

```bash
###############################################################################
# TERMINAL 1 — Fabric Network + Chaincode
###############################################################################
docker start $(docker ps -aq -f status=exited)

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
# TERMINAL 2 — Blockchain API
###############################################################################
cd dental-backend
rm -f connection/connection-org1.json wallet/admin.id wallet/appUser.id
mv /home/openuae/BC_Dentistry_temp/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json connection/
node enrollAdmin.js
node registerUser.js
node index.js

###############################################################################
# TERMINAL 3 — Database API
###############################################################################
docker start 55c61e4f72f7
cd dental-database-backend
node server.js

###############################################################################
# TERMINAL 4 — Web App
###############################################################################
cd dental-frontend
npm run dev -- --port 5174

###############################################################################
# TERMINAL 5 — Mobile App
###############################################################################
cd BC-Dentistry-Mobile-App
npx expo start
```

### Shutdown

```bash
# Terminals 2-5: Ctrl+C each
cd fabric-samples/test-network && ./network.sh down
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
# Get all doctors
peer chaincode query -C mychannel -n basic -c '{"Args":["GetAllDoctors"]}'

# Get dental files for Patient1
peer chaincode query -C mychannel -n basic -c '{"function":"getDentalFiles","Args":["Patient1"]}'

# Get all patients
peer chaincode query -C mychannel -n basic -c '{"Args":["getAllPatients"]}'

# Get pending requests for a patient
peer chaincode query -C mychannel -n basic -c '{"function":"GetPendingRequestsForPatient","Args":["Patient1"]}'
```

---

## 8. API Endpoints Reference

### Blockchain API — `dental-backend/index.js`

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Authenticate, receive JWT | All |
| POST | `/api/patients/add` | Register patient on blockchain | Admin |
| GET | `/api/patients/all` | Get all patients | Admin |
| GET | `/api/patients/:id` | Get patient by ID | Admin, Doctor |
| POST | `/api/doctors/add` | Register doctor | Admin |
| POST | `/api/doctors/assign` | Assign patient to doctor | Admin |
| POST | `/api/records/medical/add` | Add medical record | Doctor |
| GET | `/api/records/dental/:patientId` | Get dental chart | Doctor, Patient |
| POST | `/api/consent/request` | Initiate data access request | Doctor |
| POST | `/api/consent/approve` | Approve request | Admin |
| POST | `/api/consent/grant` | Grant consent | Patient |
| GET | `/api/consent/pending/:patientId` | Get pending requests | Patient |

### Database API — `dental-database-backend/server.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users |
| POST | `/api/users/register` | Create user account |
| GET | `/api/appointments/:patientId` | Get patient appointments |
| POST | `/api/appointments` | Create appointment |
| GET | `/api/records/labs/:patientId` | Get lab results |

---

## 9. Database Reference

### MySQL Container

```bash
# Container ID
55c61e4f72f7

# Start container
docker start 55c61e4f72f7

# Access MySQL
docker exec -it 55c61e4f72f7 mysql -uroot -p
# Password: OpenUAE@123
```

### Key queries

```sql
SHOW DATABASES;
USE mydatabase;
SHOW TABLES;
SELECT * FROM User;
SELECT * FROM Patient;
SELECT * FROM Appointment;
```

### Import schema on fresh setup

```bash
docker exec -i 55c61e4f72f7 mysql -uroot -pOpenUAE@123 mydatabase < database/schema.sql
```

---

## 10. Performance Benchmarking — Hyperledger Caliper

### Install

```bash
npm install --only=prod @hyperledger/caliper-cli@0.6.0
npx caliper bind --caliper-bind-sut fabric:2.5
```

### Run

```bash
cd caliper

# Read benchmark
npx caliper launch manager \
  --caliper-workspace . \
  --caliper-networkconfig networks/fabric-network.yaml \
  --caliper-benchconfig benchmarks/readPatient.yaml \
  --caliper-flow-only-test \
  --caliper-fabric-gateway-enabled

# Write benchmark
npx caliper launch manager \
  --caliper-workspace . \
  --caliper-networkconfig networks/fabric-network.yaml \
  --caliper-benchconfig benchmarks/addPatient.yaml \
  --caliper-flow-only-test \
  --caliper-fabric-gateway-enabled

# Delete benchmark
npx caliper launch manager \
  --caliper-workspace . \
  --caliper-networkconfig networks/fabric-network.yaml \
  --caliper-benchconfig benchmarks/deletePatient.yaml \
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

### `dental-backend/.env`

```env
PORT=3000
FABRIC_CHANNEL=mychannel
FABRIC_CHAINCODE=basic
FABRIC_CONNECTION_PROFILE=./connection/connection-org1.json
FABRIC_WALLET_PATH=./wallet
JWT_SECRET=CHANGE_ME
JWT_EXPIRES_IN=8h
```

### `dental-database-backend/.env`

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mydatabase
DB_USER=root
DB_PASSWORD=OpenUAE@123
JWT_SECRET=CHANGE_ME
```

### `dental-frontend/.env`

```env
VITE_BLOCKCHAIN_API_URL=http://localhost:3000/api
VITE_DATABASE_API_URL=http://localhost:3001/api
```

### `BC-Dentistry-Mobile-App/.env`

```env
# Replace with your actual LAN IP for physical device testing
API_BASE_URL=http://192.168.x.x:3001/api
BLOCKCHAIN_API_URL=http://192.168.x.x:3000/api
```

---

## 12. User Roles & Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin1@gmail.com | test@123 |
| Admin | admin2@gmail.com | test@123 |
| Doctor | doctor1@example.com | test@123 |
| Doctor | doctor2@example.com | test@123 |

> ⚠️ These are development/test credentials only. Do not use in production.

---

## 13. Troubleshooting

### Containers not starting

```bash
docker start $(docker ps -aq -f status=exited)
docker logs peer0.org1.example.com    # inspect errors
```

### "channel already exists" on network up

```bash
cd fabric-samples/test-network
./network.sh down
docker volume prune -f && docker network prune -f
./network.sh up createChannel -c mychannel -ca
```

### Wallet or identity errors in dental-backend

```bash
cd dental-backend
rm -f connection/connection-org1.json wallet/admin.id wallet/appUser.id
mv /home/openuae/BC_Dentistry_temp/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json connection/
node enrollAdmin.js && node registerUser.js && node index.js
```

### `peer: command not found`

```bash
cd fabric-samples/test-network
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
```

### MySQL container not running

```bash
docker start 55c61e4f72f7
docker ps | grep 55c61e4f72f7
```

### Expo app cannot reach API on physical device

```bash
# Get your machine's LAN IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# Update BC-Dentistry-Mobile-App/.env:
API_BASE_URL=http://<your-lan-ip>:3001/api

# Restart Expo with cache clear
npx expo start --clear
```

### ENDORSEMENT_POLICY_FAILURE on chaincode invoke

Ensure both org peer addresses are included:

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
| Blockchain API | Node.js | 22.5.1 |
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
