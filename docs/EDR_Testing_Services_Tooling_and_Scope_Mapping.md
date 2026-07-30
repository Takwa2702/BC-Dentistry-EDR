# EDR Testing Services Tooling and Scope Mapping

Version: Draft 0.2  
Project: Blockchain-Based Electronic Dental Record (EDR) Sharing and Management System  
Prepared for discussion: Synergic testing services scope alignment  

## 1. Purpose

This document maps the testing services required by the EDR testing deliverables specification to the proposed toolchain, testing scope, evidence to be produced, and explicit exclusions.

The intent is to define what the testing team will validate and report before detailed command runbooks are prepared. Command-level execution steps, scripts, and exact configuration files will be produced in a later stage after the system under test, repository layout, deployment topology, credentials, test data, and environment access have been confirmed.

## 2. Governing Inputs

This mapping is based on the following project documents:

- `BRD-EDR-001_Blockchain_EDR_System.docx`
- `SRS-EDR-001_Blockchain_EDR_System.docx`
- `EDR_Testing_Deliverables_Specification_Synergic_.docx`

The required testing objectives are:

- Objective 1: Functional testing and smart contract code review.
- Objective 2: Performance benchmarking, consent workflow benchmarking, and multi-clinic scalability assessment.
- Objective 3: Security testing and STRIDE-mapped attack validation.
- Objective 4: HIPAA / GDPR compliance matrix and consent workflow verification.
- Objective 5: Enhancement recommendations, defect/finding log, and raw data evidence package.

## 3. Core Scope Boundary

The testing service scope includes:

- Test planning and mapping against the SRS, BRD, and testing deliverables specification.
- Test execution against the agreed test environment.
- Collection of evidence, logs, screenshots, raw outputs, CSV/XLSX data, and PDF report inputs.
- Identification, classification, and documentation of defects, gaps, vulnerabilities, and non-compliance observations.
- Recommendations for remediation, tuning, or environment changes.
- Re-testing only where explicitly included in the agreed engagement plan.

The testing service scope does **not** include defect or gap remediation.

Important note: Resolution of any defects, vulnerabilities, compliance gaps, architecture gaps, performance bottlenecks, Kubernetes migration requirements, or implementation issues identified during testing is outside the testing service scope. A dedicated development, DevOps, infrastructure, security engineering, or compliance implementation team must be arranged separately to implement fixes. The testing team can validate remediated items later if re-testing is separately agreed.

## 4. Tooling Principle

Testing will use practical, reproducible tools suitable for the agreed test environment. Tool versions will be recorded in every report. Where the testing deliverables specification requires a specific raw output, such as `eslint_output.txt` or `npm_audit_output.json`, the corresponding tool will be included in the execution plan.

The final command catalog will pin versions where practical and will document:

- Tool name and version.
- Installation method.
- Exact command executed.
- Target environment.
- Output filename.
- Date/time of execution.
- Tester name.
- System version under test.

For tools that are unfamiliar to the project team, the later command runbook will provide exact commands, expected outputs, evidence filenames, and interpretation notes. Reports will be written from actual tool outputs and test evidence in a factual consultant style, avoiding generic or unsupported claims. No pass/fail result will be included unless it is backed by a screenshot, log, raw output file, transaction ID, or equivalent evidence item.

## 5. Dependencies Required to Execute Testing Scope

The following dependencies must be available before the full testing scope can be executed. If any dependency is unavailable, the affected test activity will either be blocked, reduced to a documentation-only review, or reported with a limitation.

Core dependencies:

| Dependency / input | Required detail | Required for | Impact if unavailable |
| --- | --- | --- | --- |
| Source code availability | Chaincode, API, web, and mobile repositories; correct branch/tag; package files; Dockerfiles and compose files | Smart contract review, dependency review, test automation, environment validation | Code review and dependency checks cannot be completed; testing becomes limited to black-box validation |
| Existing running environment | Non-production environment where the current EDR solution is deployed and reachable; API/web URLs; Fabric network running; database and chaincode available | Functional testing, security testing, consent workflow verification, evidence capture | Execution testing is blocked; only planning and document review can proceed |
| Existing solution documentation | Architecture diagram, deployment guide, API list or OpenAPI/Postman collection, database/data model, chaincode function list, user role model | Test case mapping, command runbook preparation, reproducible evidence | Additional discovery effort is required and coverage may be reduced or delayed |
| Test identities and credentials | Admin, Doctor, and Patient test users; JWT login details; role-specific MSP certificates; organization identities; VPN/SSH access if required | RBAC testing, cross-organization tests, consent workflow tests, ledger queries | Role-based and MSP-based scenarios cannot be executed reliably |
| Synthetic test data | Patients, doctors, appointments, clinical records, dental chart entries, consent requests, and safe sample files/DICOM references | Functional, consent, performance, and compliance evidence | Test data must be created before execution or affected tests will be delayed |

Infrastructure and execution dependencies:

| Dependency / input | Required detail | Required for | Impact if unavailable |
| --- | --- | --- | --- |
| Infrastructure for load testing | Dedicated non-production infrastructure with agreed CPU, memory, storage, network capacity, and permission to generate benchmark load | Performance benchmarks, consent workflow benchmarks, scalability assessment | Benchmark results may be invalid, noisy, or blocked entirely |
| Metrics and resource access | Docker stats access for Docker Compose runs; Kubernetes Metrics Server, `kubectl top`, HPA status, and event access where Kubernetes is used | CPU/memory threshold validation, load-test evidence, scalability reporting | Resource usage cannot be evidenced against the required thresholds |
| Scaling environment | Kubernetes or equivalent orchestration environment if autoscaling or horizontal scaling claims must be validated | Multi-clinic scalability testing and HPA/autoscaling validation | Testing is limited to Docker Compose baseline behavior; autoscaling claims cannot be validated |
| Security testing authorization | Written approval for ZAP scans, negative API tests, role misuse tests, test data modification, and controlled deletion/tampering scenarios | Security test report and STRIDE-mapped attack validation | Active security scenarios cannot be executed; only passive review can proceed |
| Version and known-issue baseline | System version under test, release notes, known defects, known environment limitations, and prior benchmark results | Traceability, defect classification, enhancement recommendations | Findings may be harder to classify as new defects, known issues, or environment limitations |

## 6. Deliverable-to-Tool Mapping

| Artefact | Testing area | Proposed tools | Evidence/output |
| --- | --- | --- | --- |
| A1 Functional Test Report | Chaincode, API, role workflows | Hyperledger Fabric peer CLI, Fabric SDK scripts, Jest/Mocha, Supertest, curl, Playwright, manual mobile workflow testing | `functional_test_results.xlsx`, screenshots, API responses, chaincode invoke/query logs |
| A2 Smart Contract Code Review | Chaincode static review, dependency review, manual OWASP checklist | ESLint, `npm audit`, manual review checklist | `eslint_output.txt`, `npm_audit_output.json`, code review findings |
| A3 Extended Performance Benchmark | `readPatient`, `addPatient`, `deletePatient` at 300/500 TX | Hyperledger Caliper, k6 where API-layer load is needed, Docker stats | `performance_benchmark_results.csv`, raw Caliper/k6 output, `docker_stats_peak.csv` |
| A4 Interim Progress Report | Milestone status | Evidence index, defect log, executed test summary | `interim_progress_report.pdf` |
| A5 Consent Workflow Benchmark | `RequestDataAccess`, `ApproveRequest`, `ProvideConsent`, mixed workload | Hyperledger Caliper workload modules, k6/API scripts, Docker stats | `consent_benchmark_results.csv`, raw benchmark output, charts |
| A6 Multi-Clinic Scalability Report | 2/4/6 organization scaling | Hyperledger Caliper, Docker stats for baseline, Kubernetes Metrics Server, `kubectl top`, HPA status | `scalability_results.csv`, resource curves, scaling report |
| A7 Security Test Report | STRIDE attack scenarios, RBAC bypass, consent bypass, token attacks, TLS, tampering | OWASP ZAP, curl, Fabric peer CLI/Fabric SDK scripts, OpenSSL, custom negative-test scripts | Security screenshots, attack result table, STRIDE mapping |
| A8 HIPAA / GDPR Compliance Matrix | Technical control evidence mapping | Manual compliance checklist, evidence from A1/A7/A9, TLS/hash/RBAC/audit validation | `compliance_matrix.xlsx`, `compliance_matrix.pdf` |
| A9 Consent Workflow Verification | Five consent scenarios and ledger evidence | Fabric peer CLI/Fabric SDK, API calls, mobile screenshots, ledger/block/transaction queries | Ledger TX IDs, timestamps, MSP identities, screenshots |
| A10 Enhancement Recommendations | Findings and production readiness | Defect log, benchmark data, security findings, compliance gaps | `enhancement_recommendations.xlsx`, enhancement report |
| A11 Defect & Finding Log | Cross-objective issue tracking | Structured XLSX log | `defect_log.xlsx` |
| A12 Raw Data & Evidence Package | Reproducibility archive | All tools above | ZIP with raw outputs, screenshots, logs, README |

## 7. Functional Testing Scope

Functional testing will verify that the implemented behavior matches the SRS and BRD workflows.

In scope:

- Chaincode function testing for all functions listed in the SRS registry.
- API endpoint testing for authentication, patient management, doctor management, record management, access requests, admin approval, patient consent, and appointment workflows.
- Role-based workflow validation for Admin, Doctor, Patient, and System actor flows.
- Positive, negative, and boundary tests.
- Validation that unauthorized roles receive explicit denial responses.
- Validation that consent-dependent access is blocked until all required approval states are satisfied.
- Evidence capture for pass/fail outcomes.

Proposed tools:

- Hyperledger Fabric peer CLI or Fabric Gateway/SDK scripts for direct chaincode invoke/query validation.
- Jest or Mocha/Chai for repeatable test automation.
- Supertest or curl for REST API endpoint validation.
- Playwright for web portal workflow evidence.
- Manual mobile workflow testing with screenshots for patient consent and appointment views.

Dependencies/prerequisites:

- Final API route list or OpenAPI collection, if available.
- Fabric identities/MSP credentials for all roles.
- Test users for Admin, Doctor, and Patient roles.
- Synthetic patient, doctor, consent, and clinical data.
- Access to web and mobile builds or deployed test endpoints.

## 8. Smart Contract and Code Review Scope

In scope:

- JavaScript chaincode static analysis.
- Dependency vulnerability review.
- Manual review against the OWASP Smart Contract Top 10 checklist specified in the deliverables document.
- Review of access control checks, input validation, error handling, event/log generation, unbounded loops, unsafe randomness, and dependency risk.

Proposed tools:

- ESLint for JavaScript linting and code quality checks.
- `npm audit --json` for dependency vulnerability output required by the deliverables specification.

Out of scope:

- Modifying chaincode.
- Refactoring or implementing missing security checks.
- Dependency upgrades.
- Fixing ESLint, audit, or manual review findings.

## 9. Security Testing Scope

Security testing will validate the 13 attack scenarios required by the testing deliverables specification and provide STRIDE mapping.

### 9.1 Required Security Scenario Tool Map

| Test ID | Scenario | Primary tools | Evidence expected |
| --- | --- | --- | --- |
| SEC-01 | Doctor invokes Admin-only `ApproveRequest` | Fabric peer CLI/Fabric SDK using Doctor MSP; API negative test using curl/Jest | Authorization failure, chaincode/API response, MSP identity used |
| SEC-02 | Patient invokes Doctor-only `AddMedicalRecord` | API negative test using Patient JWT; Fabric peer CLI/Fabric SDK using Patient MSP | Authorization failure, API/chaincode response |
| SEC-03 | Unauthenticated API call | curl/Jest; OWASP ZAP passive scan for exposed endpoints | HTTP 401/403 evidence and endpoint log |
| SEC-04 | Expired JWT token | Locally generated/expired JWT; curl/Jest | HTTP 401/403 evidence and token expiry behavior |
| SEC-05 | Tampered JWT token payload | Local JWT manipulation; curl/Jest | Signature/claim validation failure |
| SEC-06 | Cross-org identity spoofing | Fabric peer CLI/Fabric SDK with wrong-org MSP; connection profile review | Chaincode/MSP rejection evidence |
| SEC-07 | Access data without consent | API/chaincode request before consent; ledger state query | Access denied response and current consent state |
| SEC-08 | Bypass admin approval step | Attempt `ProvideConsent` before `ApproveRequest`; peer/API test | Invalid transition rejection |
| SEC-09 | Consent replay attack | Fabric SDK/peer CLI duplicate transaction attempt; repeated API consent call | Duplicate/replay rejection or defect evidence |
| SEC-10 | Access after consent revocation | API/chaincode access attempt after revocation/rejection state | Access denied response or gap if revocation is unsupported |
| SEC-11 | Off-chain data tampering | MySQL/file test fixture modification; hash verification script/API | SHA-256 mismatch evidence |
| SEC-12 | Ledger immutability | Fabric peer CLI queries; controlled non-production ledger/state tamper attempt only if authorized | Ledger remains authoritative, direct mutation blocked, or risk/gap documented |
| SEC-13 | TLS interception / invalid TLS | OpenSSL `s_client`, connection profile review | TLS protocol/cipher/certificate evidence |

Generic scanners cannot validate all consent and RBAC business rules. For that reason, the security scope combines scanner output with custom negative tests using approved test identities.

### 9.2 Authentication and Authorization Testing

In scope:

- Unauthenticated API calls.
- Expired JWT token behavior.
- Tampered JWT payloads.
- Role misuse across Admin, Doctor, and Patient actions.
- Doctor attempting Admin-only operations.
- Patient attempting Doctor-only operations.
- Cross-organization identity misuse.
- Chaincode MSP identity enforcement.

Proposed tools:

- curl or scripted HTTP clients for API-level tests.
- Fabric peer CLI or SDK scripts for chaincode-level role tests.
- JWT inspection tooling used locally for constructing negative test cases.

### 9.3 Consent and Access-Control Bypass Testing

In scope:

- Access without consent.
- Patient consent before admin approval.
- Duplicate/replayed consent transaction attempts.
- Access after rejection or revocation.
- Verification that final access requires both admin approval and patient consent.

Proposed tools:

- Fabric peer CLI/Fabric SDK scripts.
- API-level negative tests using curl/Jest/k6.
- Ledger queries for state and transaction evidence.

### 9.4 API and Web Application Security Testing

In scope:

- Passive and active web/API scanning in the approved test environment.
- Common HTTP security header checks.
- Authentication boundary checks.
- Input validation probes for exposed API endpoints.
- Session handling checks.

Proposed tools:

- OWASP ZAP baseline scan for passive CI-safe scanning.
- OWASP ZAP full/API scan only against authorized non-production targets.
- curl/Jest custom negative tests for business-logic cases that generic scanners cannot understand.

### 9.5 Environment Configuration Review

In scope:

- Review Docker Compose and Kubernetes configuration files where they are provided.
- Confirm whether resource limits, TLS settings, exposed ports, and environment variable handling are suitable for the test environment.
- Record configuration gaps as findings where they affect security, reproducibility, or scalability testing.

Proposed tools:

- Manual configuration review.
- Docker Compose inspection commands.
- Kubernetes inspection commands where a Kubernetes environment is provided.

### 9.6 TLS and Transport Security Testing

In scope:

- Verify TLS/mTLS configuration for exposed endpoints and Fabric network components where accessible.
- Check certificate validity, protocol versions, weak cipher exposure, and certificate chain configuration.

Proposed tools:

- OpenSSL `s_client`.
- Fabric connection profile review.

### 9.7 Security Testing Exclusions

Out of scope unless separately authorized:

- Testing against production systems.
- Destructive denial-of-service testing.
- Social engineering.
- Physical security testing.
- Credential theft or phishing.
- Exploit development beyond proof-of-observation required for reporting.
- Remediation of vulnerabilities.

## 10. Performance Benchmarking Scope

Performance testing will produce reproducible raw data for the required benchmark scenarios.

In scope:

- Extended 300/500 TX benchmarks for `readPatient`, `addPatient`, and `deletePatient`.
- Consent workflow benchmarks for `RequestDataAccess`, `ApproveRequest`, `ProvideConsent`, and mixed read/write/consent load.
- Success/failure counts, throughput, average/min/max latency, p50/p95 latency, and success rate.
- Docker/container resource usage during peak test windows.
- Written analysis explaining observed throughput and latency behavior.

Proposed tools:

- Hyperledger Caliper as the primary blockchain benchmarking tool.
- k6 for REST API gateway performance testing where measuring API-layer behavior is required.
- Docker stats for container resource capture in Docker Compose environments.
- Kubernetes Metrics Server and `kubectl top` where a Kubernetes environment is provided.

Prerequisites:

- Stable test dataset.
- Fabric network connection profile.
- Workload modules for the six canonical dental workloads.
- Agreement on warm-up period, send rate, rounds, and failure thresholds.
- Access to host/container metrics.

Out of scope:

- Performance tuning implementation.
- Changing endorsement policy, block batching, database indexing, or caching unless separately contracted.
- Provisioning production infrastructure.

## 11. Horizontal Scaling and Environment Recommendation

The SRS and testing deliverables require multi-clinic scalability evidence and discuss horizontal scaling. Docker Compose is useful for local orchestration and repeatable test-network startup, but it does not inherently provide production-grade autoscaling behavior, health-based rescheduling, Horizontal Pod Autoscaling, cluster resource scheduling, or metrics-driven scale-out.

Recommendation: the project should provide an updated scalability testing environment based on Kubernetes or an equivalent container orchestration platform before claims about autoscaling or horizontal scaling are assessed.

### 11.1 Proposed Kubernetes-Based Scope

The recommended scaling test bed should include:

- Kubernetes deployments or StatefulSets for API services, web services, and supporting components where appropriate.
- Kubernetes-ready deployment approach for Hyperledger Fabric peers, orderers, CAs, and chaincode services.
- Metrics Server for HPA resource metrics.
- HorizontalPodAutoscaler objects for scalable stateless services such as API/web workloads.
- Resource requests and limits for all pods.
- Network policies and TLS/mTLS configuration.
- Persistent volume configuration for stateful components.
- Clearly defined pass/fail thresholds for CPU, memory, latency, throughput, and failure rate.

### 11.2 What Testing Will Validate

If the Kubernetes environment is provided, testing can validate:

- Whether HPA scales eligible workloads under load.
- Whether resource usage remains below agreed CPU/memory thresholds.
- Whether throughput and latency remain within acceptance targets under 2, 4, and 6 organization configurations.
- Whether scaling events correlate with load and do not introduce unacceptable error rates.
- Whether Kubernetes manifests meet baseline security and resource-management expectations.

Proposed tools:

- Kubernetes HPA and Metrics Server.
- `kubectl top`, `kubectl describe hpa`, and event inspection.
- `kubectl get events`, pod restart counts, and resource-limit inspection.
- Docker stats for Docker Compose baseline runs.
- Hyperledger Caliper and k6 for load generation.

### 11.3 Scaling Environment Exclusions

Out of scope for testing services unless separately contracted:

- Migrating the current Docker Compose setup to Kubernetes.
- Designing a production Hyperledger Fabric Kubernetes architecture.
- Implementing HPA, metrics pipelines, Helm charts, operators, service mesh, or persistent storage.
- Tuning Kubernetes cluster autoscaler or cloud infrastructure.
- Guaranteeing national-scale production readiness.

Testing can identify the need for these changes and validate a supplied environment, but implementation requires a dedicated infrastructure/DevOps team.

## 12. HIPAA Compliance Testing Scope

HIPAA testing will be an evidence-based technical control assessment, not a legal certification or legal opinion. The primary focus will be HIPAA Security Rule technical safeguards under 45 CFR 164.312, because that is what the project testing specification requires.

In scope:

| HIPAA area | What will be tested | Evidence sources |
| --- | --- | --- |
| Access control | Unique user identity, role separation, least-privilege behavior, session expiry, blocked unauthorized access | Functional tests, security tests, JWT tests, chaincode role tests |
| Audit controls | Whether access, consent, request, and record-modification events are logged with actor and timestamp | Ledger transaction queries, API logs, screenshots |
| Integrity | Whether off-chain record/file changes are detectable using on-chain SHA-256 hashes | Hash tampering test, ledger hash comparison |
| Person/entity authentication | Whether users and organizations are authenticated through JWT/MSP/certificates | MSP identity tests, login tests, certificate review |
| Transmission security | Whether data in transit is protected with TLS/mTLS and invalid certificates are rejected | TLS scan output, connection profile review |
| Encryption/decryption | Whether encryption controls exist for transmission and, where applicable, storage | TLS evidence, configuration review, gap note if DB/file encryption is absent |

Likely gap areas to check carefully:

- Emergency access procedure is a required HIPAA implementation specification but may not be implemented in the system.
- Automatic logoff/JWT expiry must be demonstrated, not assumed.
- Database/file encryption at rest may not be covered by the blockchain hash model.
- Administrative and physical safeguards are not fully testable from application evidence alone unless policies and operational procedures are provided.

Out of scope:

- Formal HIPAA legal attestation.
- Covered entity/business associate determination.
- Drafting policies and procedures.
- Implementing missing controls.

## 13. GDPR Compliance Testing Scope

GDPR testing will be an evidence-based technical and procedural mapping against the GDPR articles listed in the testing deliverables specification. It will not constitute legal advice or regulatory certification.

In scope:

| GDPR area | What will be tested | Evidence sources |
| --- | --- | --- |
| Article 5: principles | Data minimization, purpose limitation, integrity/confidentiality, no PII stored directly on-chain | Architecture review, ledger inspection, security tests |
| Article 6: lawful basis | Explicit consent flow for cross-clinic sharing, including purpose/requesting party details | Consent workflow tests, ledger TX IDs, patient screenshots |
| Article 7: consent conditions, if included | Ability to grant, reject, and withdraw/revoke consent; consent evidence is recorded | Consent scenarios S1-S5 |
| Article 17: erasure | Verify off-chain deletion/deactivation behavior and document blockchain immutability limitation | Delete/deactivate tests, database evidence, ledger review |
| Article 25: privacy by design/default | Default-deny access, role-based access, hybrid on-chain/off-chain architecture | Functional/security test evidence |
| Article 32: security of processing | RBAC, TLS/mTLS, auditability, integrity checks, resilience evidence where available | Security tests, performance/reliability evidence, TLS checks |

Important GDPR interpretation note:

Because blockchain ledgers are immutable, historical on-chain transactions cannot be physically erased. The compliance assessment should therefore verify and document whether the system avoids storing PII directly on-chain and whether erasure/deletion applies to off-chain MySQL/file data. Any on-chain metadata or hashes that can reasonably be linked back to a person must be assessed carefully and may become a compliance gap depending on the final data design.

Out of scope:

- Legal determination of GDPR applicability by jurisdiction.
- Data Processing Agreement review.
- Data Protection Impact Assessment authoring.
- Privacy notice drafting.
- Implementing data subject rights workflows beyond testing what exists.

## 14. Consent Workflow Verification Scope

The five consent scenarios required by the testing specification will be executed and documented:

- S1: Admin approves, patient grants, access is granted and logged.
- S2: Admin rejects, access is denied.
- S3: Admin approves, patient rejects, access is denied.
- S4: Admin approves, patient does not respond, status remains pending/access denied.
- S5: Patient grants and later revokes, access is withdrawn/revocation is logged.

For each scenario, testing will capture:

- Transaction IDs for every state-changing event.
- Ledger timestamp where available.
- Actor MSP identity.
- Final consent/access state.
- API response body.
- Screenshot or log evidence.

Out of scope:

- Implementing missing revoke behavior if the chaincode does not support it.
- Building notification delivery infrastructure.
- Changing mobile UI behavior.

## 15. Evidence and Reporting Standards

Every pass/fail result should map to one or more evidence items:

- Test case ID.
- Tool output file.
- Screenshot filename.
- API response or chaincode response.
- Ledger transaction ID.
- Docker/Kubernetes metric output.
- Defect ID where applicable.

Raw evidence must be reproducible and included in the raw data ZIP with a README describing how each file was generated.

## 16. Key Assumptions and Client Responsibilities

The dependency table in Section 5 identifies the minimum inputs required to execute the full scope. In summary, the client/project team must provide:

- Source code repositories for chaincode, API, web, and mobile apps.
- Docker Compose files and/or Kubernetes manifests.
- System version under test.
- Test environment access and authorization.
- Fabric connection profiles and role-specific identities.
- Admin, Doctor, and Patient test accounts.
- Synthetic patient and dental records.
- API endpoint list or OpenAPI/Postman-equivalent collection, if available.
- Any explicit CPU/memory/latency/throughput thresholds not already stated in the SRS.
- Agreement that testing may generate, modify, and delete synthetic test records.
- Confirmation that no production patient data will be used unless separately governed.

## 17. Open Items Before Command Runbook

Before producing exact commands, the following must be confirmed:

- Repository layout and branch/tag to test.
- Chaincode package path and exact chaincode name/channel.
- Whether Caliper is already configured.
- Whether the missing `TP-EDR-001` test case document exists and can be provided.
- Whether OpenAPI/API collection exists.
- Whether mobile testing will use a physical device, emulator, simulator, or provided screenshots from the deployed patient app.
- Whether Kubernetes environment is available or must be proposed only as an enhancement.
- Required CPU/memory resource thresholds for pass/fail decisions.
- Whether re-testing after remediation is included.

## 18. Reference Sources for Tool and Regulatory Alignment

- OWASP ZAP Docker baseline scan documentation: https://www.zaproxy.org/docs/docker/baseline-scan/
- Hyperledger Caliper project documentation/repository: https://github.com/hyperledger-caliper/caliper
- k6 load testing documentation: https://k6.io/docs/
- Kubernetes Horizontal Pod Autoscaling documentation: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
- Kubernetes Metrics Server documentation: https://github.com/kubernetes-sigs/metrics-server
- HHS HIPAA Security Rule summary: https://www.hhs.gov/hipaa/for-professionals/security/
- 45 CFR 164.312 technical safeguards: https://www.law.cornell.edu/cfr/text/45/164.312
- GDPR official text, Regulation (EU) 2016/679: https://eur-lex.europa.eu/eli/reg/2016/679/art_32/oj/eng
