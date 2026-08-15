CREATE TABLE IF NOT EXISTS System_Configuration (
  Configuration_Key VARCHAR(128) NOT NULL,
  Configuration_Value VARCHAR(2048) NOT NULL,
  Description VARCHAR(512) NULL,
  Modified_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (Configuration_Key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE Appointment
  ADD COLUMN Duration_Minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30 AFTER Appointment_Date_Time,
  ADD COLUMN Appointment_End_Date_Time DATETIME NULL AFTER Duration_Minutes,
  ADD KEY idx_appointment_doctor_interval (Doctor_ID,Appointment_Date_Time,Appointment_End_Date_Time),
  ADD KEY idx_appointment_patient_interval (Patient_ID,Appointment_Date_Time,Appointment_End_Date_Time);

UPDATE Appointment
SET Appointment_End_Date_Time=DATE_ADD(Appointment_Date_Time, INTERVAL Duration_Minutes MINUTE)
WHERE Appointment_End_Date_Time IS NULL;

ALTER TABLE Appointment MODIFY Appointment_End_Date_Time DATETIME NOT NULL;

INSERT INTO Schema_Migration (Migration_ID)
VALUES ('2026-08-05-appointment-overlap')
ON DUPLICATE KEY UPDATE Applied_At=Applied_At;
