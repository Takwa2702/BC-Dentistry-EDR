ALTER TABLE Doctor
    ADD COLUMN License_Number VARCHAR(100) NULL AFTER Blockchain_ID,
    ADD COLUMN Emirates_ID VARCHAR(100) NULL AFTER License_Number,
    ADD COLUMN Clinic_ID INT NULL AFTER Emirates_ID,
    ADD COLUMN Modified_Date DATETIME NULL AFTER Clinic_ID,
    ADD UNIQUE KEY uq_doctor_license_number (License_Number),
    ADD UNIQUE KEY uq_doctor_emirates_id (Emirates_ID),
    ADD KEY idx_doctor_clinic_id (Clinic_ID);

UPDATE Doctor d
JOIN User u ON u.ID = d.ID
SET d.Modified_Date = COALESCE(d.Modified_Date, u.Created_Date)
WHERE d.Modified_Date IS NULL;

-- Backfill existing Clinic_ID, License_Number, and Emirates_ID values from the
-- authoritative deployment records before enabling doctor management. The values are
-- deployment-specific and must not be guessed here.
