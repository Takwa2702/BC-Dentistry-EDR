ALTER TABLE Appointment
  MODIFY Appointment_ID INT NOT NULL AUTO_INCREMENT,
  ADD COLUMN Appointment_Date_Time DATETIME NULL AFTER Date,
  ADD COLUMN Specialty VARCHAR(255) NULL AFTER Appointment_Date_Time,
  ADD COLUMN Status VARCHAR(32) NOT NULL DEFAULT 'scheduled' AFTER Specialty,
  ADD COLUMN Cancelled_Date DATETIME NULL AFTER Notes,
  ADD COLUMN Modified_Date DATETIME NULL AFTER Cancelled_Date;

UPDATE Appointment
SET Appointment_Date_Time = COALESCE(Appointment_Date_Time, TIMESTAMP(Date)),
    Specialty = COALESCE(NULLIF(Specialty, ''), 'General Dentistry'),
    Modified_Date = COALESCE(Modified_Date, NOW());

ALTER TABLE Appointment
  MODIFY Appointment_Date_Time DATETIME NOT NULL,
  MODIFY Specialty VARCHAR(255) NOT NULL;
