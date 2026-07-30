CREATE TABLE IF NOT EXISTS Clinical_Record (
  Record_ID varchar(64) NOT NULL,
  Patient_Blockchain_ID varchar(64) NOT NULL,
  Record_Type enum('medical','dental') NOT NULL,
  Payload json NOT NULL,
  Data_Hash char(64) NOT NULL,
  Created_By_Doctor_ID varchar(64) NOT NULL,
  Created_Date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Modified_Date datetime NULL,
  PRIMARY KEY (Record_ID),
  KEY idx_clinical_patient_type (Patient_Blockchain_ID, Record_Type),
  CONSTRAINT fk_clinical_patient_blockchain FOREIGN KEY (Patient_Blockchain_ID) REFERENCES Patient(Blockchain_ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
