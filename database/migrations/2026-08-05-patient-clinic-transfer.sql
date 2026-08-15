CREATE TABLE IF NOT EXISTS Patient_Clinic_Association (
  Patient_ID INT NOT NULL,
  Clinic_ID INT NOT NULL,
  Association_Status ENUM('current','transferred') NOT NULL DEFAULT 'current',
  Transfer_Request_ID VARCHAR(128) NULL,
  Associated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Transferred_At DATETIME NULL,
  PRIMARY KEY (Patient_ID, Clinic_ID),
  KEY idx_patient_clinic_directory (Clinic_ID, Association_Status),
  CONSTRAINT fk_patient_clinic_association_patient FOREIGN KEY (Patient_ID) REFERENCES Patient(ID) ON DELETE RESTRICT,
  CONSTRAINT fk_patient_clinic_association_clinic FOREIGN KEY (Clinic_ID) REFERENCES Organization(Organization_ID) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO Patient_Clinic_Association (Patient_ID, Clinic_ID, Association_Status)
SELECT ID, Clinic_ID, 'current' FROM Patient
ON DUPLICATE KEY UPDATE Association_Status='current', Transferred_At=NULL;

INSERT INTO Schema_Migration (Migration_ID)
VALUES ('2026-08-05-patient-clinic-transfer')
ON DUPLICATE KEY UPDATE Applied_At = Applied_At;
