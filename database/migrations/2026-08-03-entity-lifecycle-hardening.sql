CREATE TABLE IF NOT EXISTS Entity_Lifecycle_Operation (
  Operation_ID CHAR(36) NOT NULL,
  Operation_Type VARCHAR(64) NOT NULL,
  Entity_Type ENUM('clinic','admin','doctor','patient','assignment') NOT NULL,
  Entity_ID VARCHAR(128) NOT NULL,
  Clinic_ID INT NULL,
  Status ENUM('PENDING','FABRIC_COMMITTED','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  Current_Stage VARCHAR(64) NOT NULL DEFAULT 'CREATED',
  Correlation_ID VARCHAR(128) NULL,
  Payload_Hash CHAR(64) NULL,
  Error_Code VARCHAR(100) NULL,
  Error_Message VARCHAR(1000) NULL,
  Created_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Updated_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  Completed_At DATETIME(3) NULL,
  PRIMARY KEY (Operation_ID),
  KEY idx_lifecycle_entity (Entity_Type, Entity_ID, Created_At),
  KEY idx_lifecycle_status (Status, Updated_At),
  KEY idx_lifecycle_correlation (Correlation_ID)
);

INSERT INTO Schema_Migration (Migration_ID)
VALUES ('2026-08-03-entity-lifecycle-hardening')
ON DUPLICATE KEY UPDATE Applied_At = Applied_At;
