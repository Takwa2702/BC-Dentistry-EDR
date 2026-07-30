-- Store patient PII and detailed clinical and administrative fields off-chain.
-- Back up MySQL before applying this migration.
-- Existing admin records use organization IDs 1 and 2; preserve those clinic associations
-- when upgrading databases whose Organization reference table is empty.
INSERT INTO Organization (Organization_ID, Name, Type, Created_Date)
VALUES
  (1, 'Clinic 1', 'Dental Clinic', CURRENT_DATE),
  (2, 'Clinic 2', 'Dental Clinic', CURRENT_DATE)
ON DUPLICATE KEY UPDATE Organization_ID = VALUES(Organization_ID);

ALTER TABLE Patient
  ADD COLUMN Nationality VARCHAR(100) DEFAULT NULL,
  ADD COLUMN Address TEXT DEFAULT NULL,
  ADD COLUMN Blood_Type VARCHAR(3) DEFAULT NULL,
  ADD COLUMN Medical_History JSON DEFAULT NULL,
  ADD COLUMN Allergies JSON DEFAULT NULL,
  ADD COLUMN Medications JSON DEFAULT NULL,
  ADD COLUMN Insurance_Details JSON DEFAULT NULL,
  ADD COLUMN Clinic_ID INT DEFAULT NULL,
  ADD COLUMN Doctors JSON DEFAULT NULL,
  ADD COLUMN Modified_Date DATETIME DEFAULT NULL,
  ADD UNIQUE KEY uq_patient_emirates_id (Emirates_ID),
  ADD KEY idx_patient_clinic (Clinic_ID),
  ADD CONSTRAINT fk_patient_clinic FOREIGN KEY (Clinic_ID) REFERENCES Organization (Organization_ID);
