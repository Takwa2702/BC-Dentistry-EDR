ALTER TABLE Appointment
  ADD COLUMN Idempotency_Key VARCHAR(128) NULL AFTER Modified_Date,
  ADD COLUMN Active_Doctor_Slot VARCHAR(128) GENERATED ALWAYS AS
    (CASE WHEN LOWER(COALESCE(Status,'scheduled')) IN ('cancelled','canceled','completed','complete','done','finished') THEN NULL ELSE CONCAT(Doctor_ID,'@',Appointment_Date_Time) END) STORED,
  ADD COLUMN Active_Patient_Slot VARCHAR(128) GENERATED ALWAYS AS
    (CASE WHEN LOWER(COALESCE(Status,'scheduled')) IN ('cancelled','canceled','completed','complete','done','finished') THEN NULL ELSE CONCAT(Patient_ID,'@',Appointment_Date_Time) END) STORED,
  ADD UNIQUE KEY uq_appointment_idempotency (Idempotency_Key),
  ADD UNIQUE KEY uq_active_doctor_slot (Active_Doctor_Slot),
  ADD UNIQUE KEY uq_active_patient_slot (Active_Patient_Slot);
