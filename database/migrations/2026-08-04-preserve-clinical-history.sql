-- Clinical history must never be cascade-deleted with an actor row.
-- Application lifecycle uses IsActive/deactivation; direct hard deletion is blocked.
ALTER TABLE Lab_Result DROP FOREIGN KEY fk_lab_result_patient;
ALTER TABLE Lab_Result ADD CONSTRAINT fk_lab_result_patient
  FOREIGN KEY (Patient_Blockchain_ID) REFERENCES Patient(Blockchain_ID) ON DELETE RESTRICT;

ALTER TABLE Clinical_Record DROP FOREIGN KEY fk_clinical_patient_blockchain;
ALTER TABLE Clinical_Record ADD CONSTRAINT fk_clinical_patient_blockchain
  FOREIGN KEY (Patient_Blockchain_ID) REFERENCES Patient(Blockchain_ID) ON DELETE RESTRICT;
