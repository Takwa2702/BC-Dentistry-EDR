#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
FABRIC_TEST_NETWORK_DIR="${FABRIC_TEST_NETWORK_DIR:-${REPO_ROOT}/fabric-samples/test-network}"
ORG1_DIR="${FABRIC_TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com"
KEY_DIR="${ORG1_DIR}/users/User1@org1.example.com/msp/keystore"
CERT_PATH="${ORG1_DIR}/users/User1@org1.example.com/msp/signcerts/cert.pem"
CONNECTION_PROFILE="${ORG1_DIR}/connection-org1.yaml"
OUTPUT_PATH="${SCRIPT_DIR}/networks/fabric/test-network.yaml"

if [ ! -d "${KEY_DIR}" ]; then
  echo "Missing User1 keystore: ${KEY_DIR}" >&2
  echo "Start the Fabric network first: cd fabric-samples/test-network && ./network.sh up createChannel -c mychannel -ca" >&2
  exit 1
fi

PRIVATE_KEY_PATH=$(find "${KEY_DIR}" -type f | head -n 1)

if [ -z "${PRIVATE_KEY_PATH}" ] || [ ! -f "${PRIVATE_KEY_PATH}" ]; then
  echo "No User1 private key found in ${KEY_DIR}" >&2
  exit 1
fi

for required_file in "${CERT_PATH}" "${CONNECTION_PROFILE}"; do
  if [ ! -f "${required_file}" ]; then
    echo "Missing required Fabric file: ${required_file}" >&2
    exit 1
  fi
done

cat > "${OUTPUT_PATH}" <<EOF
name: Caliper Benchmarks
version: "2.0.0"

caliper:
  blockchain: fabric

channels:
  - channelName: mychannel
    contracts:
      - id: basic

organizations:
  - mspid: Org1MSP
    identities:
      certificates:
        - name: User1
          clientPrivateKey:
            path: "${PRIVATE_KEY_PATH}"
          clientSignedCert:
            path: "${CERT_PATH}"
    connectionProfile:
      path: "${CONNECTION_PROFILE}"
      discover: true
EOF

echo "Updated ${OUTPUT_PATH}"
