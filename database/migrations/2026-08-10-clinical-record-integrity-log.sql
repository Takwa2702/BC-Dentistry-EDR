CREATE TABLE IF NOT EXISTS Clinical_Record_Integrity_Log (
  Verification_ID CHAR(36) NOT NULL,
  Record_ID VARCHAR(128) NOT NULL,
  Actor_User_ID INT NULL,
  Actor_Blockchain_ID VARCHAR(255) NULL,
  Actor_Role VARCHAR(32) NOT NULL,
  Correlation_ID VARCHAR(128) NOT NULL,
  Current_Hash CHAR(64) NULL,
  Stored_Hash CHAR(64) NULL,
  On_Chain_Hash CHAR(64) NULL,
  Result ENUM('VERIFIED','MISMATCH','ERROR') NOT NULL,
  Error_Code VARCHAR(128) NULL,
  Error_Message VARCHAR(1000) NULL,
  Verified_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (Verification_ID),
  KEY idx_clinical_integrity_record_time (Record_ID, Verified_At),
  KEY idx_clinical_integrity_result_time (Result, Verified_At),
  KEY idx_clinical_integrity_correlation (Correlation_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
