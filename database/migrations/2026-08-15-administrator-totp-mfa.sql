-- Repeat-safe administrator TOTP MFA schema. Secrets are AES-GCM encrypted by the application.
CREATE TABLE IF NOT EXISTS Auth_MFA_Credential (
  User_ID INT NOT NULL, Secret_Ciphertext VARBINARY(255) NOT NULL, Secret_IV BINARY(12) NOT NULL,
  Secret_Tag BINARY(16) NOT NULL, Enabled_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Last_Used_At DATETIME(3) NULL, Reset_At DATETIME(3) NULL, Last_TOTP_Step BIGINT NULL,
  PRIMARY KEY (User_ID),
  CONSTRAINT fk_auth_mfa_user FOREIGN KEY (User_ID) REFERENCES User(ID) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS Auth_MFA_Recovery_Code (
  User_ID INT NOT NULL, Code_Hash CHAR(64) NOT NULL, Created_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Used_At DATETIME(3) NULL, PRIMARY KEY (User_ID, Code_Hash), KEY idx_auth_mfa_recovery_unused (User_ID, Used_At),
  CONSTRAINT fk_auth_mfa_recovery_user FOREIGN KEY (User_ID) REFERENCES User(ID) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS Auth_MFA_Challenge (
  Challenge_Hash CHAR(64) NOT NULL, User_ID INT NOT NULL, Purpose ENUM('login','enrollment') NOT NULL,
  Pending_Secret_Ciphertext VARBINARY(255) NULL, Pending_Secret_IV BINARY(12) NULL, Pending_Secret_Tag BINARY(16) NULL,
  Client_Type ENUM('web','ios','android') NOT NULL, Device_Label VARCHAR(255) NULL,
  IP_Hash CHAR(64) NULL, User_Agent_Hash CHAR(64) NULL, Created_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Expires_At DATETIME(3) NOT NULL, Used_At DATETIME(3) NULL, PRIMARY KEY (Challenge_Hash),
  KEY idx_auth_mfa_challenge_user (User_ID, Expires_At, Used_At),
  CONSTRAINT fk_auth_mfa_challenge_user FOREIGN KEY (User_ID) REFERENCES User(ID) ON DELETE CASCADE
);
SET @mfa_migration_new := NOT EXISTS (SELECT 1 FROM Schema_Migration WHERE Migration_ID='2026-08-15-administrator-totp-mfa');
UPDATE User SET Security_Version=Security_Version+1, Sessions_Invalid_Before=NOW(3) WHERE @mfa_migration_new=1;
UPDATE Auth_Session SET Revoked_At=NOW(3), Revocation_Reason='MFA rollout' WHERE @mfa_migration_new=1 AND Revoked_At IS NULL;
UPDATE Auth_Refresh_Token rt JOIN Auth_Session s ON s.Session_ID=rt.Session_ID
SET rt.Revoked_At=NOW(3) WHERE @mfa_migration_new=1 AND rt.Revoked_At IS NULL;
INSERT INTO Schema_Migration (Migration_ID, Checksum_SHA256) VALUES ('2026-08-15-administrator-totp-mfa', NULL)
ON DUPLICATE KEY UPDATE Migration_ID=VALUES(Migration_ID);
