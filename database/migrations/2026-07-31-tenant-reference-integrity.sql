-- Repair the known legacy seed graph and enforce tenant reference integrity.
-- This migration is idempotent. It deliberately fails on unknown unscoped or
-- orphaned records rather than guessing their clinic ownership.

INSERT INTO Organization
  (Organization_ID, Name, Address, Description, Coordinates, Type, IsActive, Created_Date, Modified_Date)
VALUES
  (1, 'Dental Clinic A', 'Dubai, UAE', 'Seed clinic for the Clinic 1 tenant', NULL, 'Dental Clinic', 1, '2025-01-22', NULL),
  (2, 'Dental Clinic B', 'Dubai, UAE', 'Seed clinic for the Clinic 2 tenant', NULL, 'Dental Clinic', 1, '2025-01-22', NULL)
ON DUPLICATE KEY UPDATE
  Organization_ID = VALUES(Organization_ID);

-- Remove only the five recognizable, unreferenced sample doctors that never
-- had a matching User account. Any other orphan remains visible and blocks
-- the foreign-key addition below.
DELETE d
FROM Doctor d
LEFT JOIN User u ON u.ID = d.ID
LEFT JOIN Appointment a ON a.Doctor_ID = d.ID
WHERE d.ID IN (1, 2, 3, 4, 5)
  AND d.Blockchain_ID IS NULL
  AND u.ID IS NULL
  AND a.Appointment_ID IS NULL;

-- Remove the verified orphan Patient 20 only when it still has no User,
-- appointment, clinical record, or laboratory result. The corresponding
-- Fabric actor was also verified absent before this deployment.
DELETE p
FROM Patient p
LEFT JOIN User u ON u.ID = p.ID
LEFT JOIN Appointment a ON a.Patient_ID = p.ID
LEFT JOIN Clinical_Record c ON c.Patient_Blockchain_ID = p.Blockchain_ID
LEFT JOIN Lab_Result l ON l.Patient_Blockchain_ID = p.Blockchain_ID
WHERE p.ID = 20
  AND p.Blockchain_ID = 'Patient-a12b00da-ff7d-4e01-9b1d-386e5df4e087'
  AND u.ID IS NULL
  AND a.Appointment_ID IS NULL
  AND c.Record_ID IS NULL
  AND l.Lab_Result_ID IS NULL;

UPDATE Doctor
SET Clinic_ID = 1,
    License_Number = COALESCE(License_Number, 'DHA-DOCTOR-0001'),
    Emirates_ID = COALESCE(Emirates_ID, '784-1985-0000001-1')
WHERE ID = 15 AND Blockchain_ID = 'Doctor1' AND Clinic_ID IS NULL;

UPDATE Doctor
SET Clinic_ID = 2,
    License_Number = COALESCE(License_Number, 'DHA-DOCTOR-0002'),
    Emirates_ID = COALESCE(Emirates_ID, '784-1986-0000002-2')
WHERE ID = 16 AND Blockchain_ID = 'Doctor2' AND Clinic_ID IS NULL;

UPDATE Patient
SET Clinic_ID = 2
WHERE ID = 17 AND Blockchain_ID = 'Patient1' AND Clinic_ID IS NULL;

UPDATE Patient
SET Clinic_ID = 2
WHERE ID = 18 AND Blockchain_ID = 'Patient2' AND Clinic_ID IS NULL;

UPDATE Patient
SET Clinic_ID = 1
WHERE ID = 19 AND Blockchain_ID = 'Patient3' AND Clinic_ID IS NULL;

UPDATE Patient
SET Doctors = JSON_ARRAY('Doctor2')
WHERE ID = 17 AND Blockchain_ID = 'Patient1' AND Clinic_ID = 2
  AND (Doctors IS NULL OR JSON_LENGTH(Doctors) = 0);

UPDATE Patient
SET Doctors = JSON_ARRAY('Doctor2')
WHERE ID = 18 AND Blockchain_ID = 'Patient2' AND Clinic_ID = 2
  AND (Doctors IS NULL OR JSON_LENGTH(Doctors) = 0);

UPDATE Patient
SET Doctors = JSON_ARRAY('Doctor1')
WHERE ID = 19 AND Blockchain_ID = 'Patient3' AND Clinic_ID = 1
  AND (Doctors IS NULL OR JSON_LENGTH(Doctors) = 0);

-- Remove only doctor aliases that do not resolve to any current Doctor row.
-- Valid assignments are retained; an empty valid set becomes an empty array.
DROP TEMPORARY TABLE IF EXISTS Valid_Patient_Doctors;
CREATE TEMPORARY TABLE Valid_Patient_Doctors AS
SELECT p.ID AS Patient_ID, JSON_ARRAYAGG(assigned.Doctor_Blockchain_ID) AS Doctors
FROM Patient p
JOIN JSON_TABLE(
  COALESCE(p.Doctors, JSON_ARRAY()),
  '$[*]' COLUMNS (Doctor_Blockchain_ID varchar(64) PATH '$')
) assigned
JOIN Doctor d ON d.Blockchain_ID = assigned.Doctor_Blockchain_ID
GROUP BY p.ID;

DROP TEMPORARY TABLE IF EXISTS Invalid_Patient_Doctors;
CREATE TEMPORARY TABLE Invalid_Patient_Doctors AS
SELECT DISTINCT p.ID AS Patient_ID
FROM Patient p
JOIN JSON_TABLE(
  COALESCE(p.Doctors, JSON_ARRAY()),
  '$[*]' COLUMNS (Doctor_Blockchain_ID varchar(64) PATH '$')
) assigned
LEFT JOIN Doctor d ON d.Blockchain_ID = assigned.Doctor_Blockchain_ID
WHERE d.ID IS NULL;

UPDATE Patient p
JOIN Invalid_Patient_Doctors invalid ON invalid.Patient_ID = p.ID
LEFT JOIN Valid_Patient_Doctors valid ON valid.Patient_ID = p.ID
SET p.Doctors = COALESCE(valid.Doctors, JSON_ARRAY());

DROP TEMPORARY TABLE Invalid_Patient_Doctors;
DROP TEMPORARY TABLE Valid_Patient_Doctors;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_tenant_fk_if_missing$$
CREATE PROCEDURE add_tenant_fk_if_missing(
  IN constraint_name_value varchar(64),
  IN ddl_statement text
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND CONSTRAINT_NAME = constraint_name_value
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    SET @tenant_integrity_ddl = ddl_statement;
    PREPARE tenant_integrity_statement FROM @tenant_integrity_ddl;
    EXECUTE tenant_integrity_statement;
    DEALLOCATE PREPARE tenant_integrity_statement;
  END IF;
END$$

DELIMITER ;

CALL add_tenant_fk_if_missing(
  'fk_admin_organization',
  'ALTER TABLE Admin ADD CONSTRAINT fk_admin_organization FOREIGN KEY (Organization_ID) REFERENCES Organization(Organization_ID)'
);
CALL add_tenant_fk_if_missing(
  'fk_doctor_user',
  'ALTER TABLE Doctor ADD CONSTRAINT fk_doctor_user FOREIGN KEY (ID) REFERENCES User(ID) ON DELETE CASCADE'
);
CALL add_tenant_fk_if_missing(
  'fk_doctor_clinic',
  'ALTER TABLE Doctor ADD CONSTRAINT fk_doctor_clinic FOREIGN KEY (Clinic_ID) REFERENCES Organization(Organization_ID)'
);
CALL add_tenant_fk_if_missing(
  'fk_patient_user',
  'ALTER TABLE Patient ADD CONSTRAINT fk_patient_user FOREIGN KEY (ID) REFERENCES User(ID) ON DELETE CASCADE'
);
CALL add_tenant_fk_if_missing(
  'fk_clinical_patient_blockchain',
  'ALTER TABLE Clinical_Record ADD CONSTRAINT fk_clinical_patient_blockchain FOREIGN KEY (Patient_Blockchain_ID) REFERENCES Patient(Blockchain_ID) ON DELETE CASCADE'
);
CALL add_tenant_fk_if_missing(
  'fk_clinical_doctor_blockchain',
  'ALTER TABLE Clinical_Record ADD CONSTRAINT fk_clinical_doctor_blockchain FOREIGN KEY (Created_By_Doctor_ID) REFERENCES Doctor(Blockchain_ID)'
);
CALL add_tenant_fk_if_missing(
  'fk_request_organization',
  'ALTER TABLE Request ADD CONSTRAINT fk_request_organization FOREIGN KEY (Organization_ID) REFERENCES Organization(Organization_ID)'
);
CALL add_tenant_fk_if_missing(
  'fk_request_data_access',
  'ALTER TABLE Request ADD CONSTRAINT fk_request_data_access FOREIGN KEY (Data_Access_ID) REFERENCES Data_Access(ID)'
);

DROP PROCEDURE add_tenant_fk_if_missing;

-- Clinic ownership is mandatory after the known legacy rows have been repaired.
ALTER TABLE Doctor MODIFY Clinic_ID int NOT NULL;
ALTER TABLE Patient MODIFY Clinic_ID int NOT NULL;

CREATE TABLE IF NOT EXISTS Schema_Migration (
  Migration_ID varchar(128) NOT NULL,
  Applied_At datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Migration_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO Schema_Migration (Migration_ID)
VALUES ('2026-07-31-tenant-reference-integrity')
ON DUPLICATE KEY UPDATE Migration_ID = VALUES(Migration_ID);
