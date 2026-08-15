-- Repeat-safe in-place upgrade for an existing EDR MySQL database.
-- This script preserves existing users and clinical data. It may be run again
-- after an interrupted deployment; completed operations are detected.

CREATE TABLE IF NOT EXISTS Schema_Migration (
  Migration_ID VARCHAR(100) NOT NULL,
  Applied_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Checksum_SHA256 CHAR(64) NULL,
  PRIMARY KEY (Migration_ID)
);

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
  IN target_table VARCHAR(64),
  IN target_column VARCHAR(64),
  IN column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND COLUMN_NAME = target_column
  ) THEN
    SET @ddl = CONCAT(
      'ALTER TABLE `', REPLACE(target_table, '`', '``'),
      '` ADD COLUMN `', REPLACE(target_column, '`', '``'),
      '` ', column_definition
    );
    PREPARE statement_to_run FROM @ddl;
    EXECUTE statement_to_run;
    DEALLOCATE PREPARE statement_to_run;
  END IF;
END$$

CALL add_column_if_missing(
  'User',
  'Security_Version',
  'INT UNSIGNED NOT NULL DEFAULT 1 AFTER `Must_Change_Password`'
)$$

CALL add_column_if_missing(
  'User',
  'Sessions_Invalid_Before',
  'DATETIME(3) NULL AFTER `Security_Version`'
)$$

DROP PROCEDURE IF EXISTS add_column_if_missing$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS Auth_Session (
  Session_ID CHAR(36) NOT NULL,
  User_ID INT NOT NULL,
  Client_Type ENUM('web', 'ios', 'android') NOT NULL,
  Device_Label VARCHAR(255) NULL,
  Token_Family_ID CHAR(36) NOT NULL,
  Security_Version INT UNSIGNED NOT NULL,
  Csrf_Token_Hash CHAR(64) NULL,
  Created_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Last_Seen_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Idle_Expires_At DATETIME(3) NOT NULL,
  Absolute_Expires_At DATETIME(3) NOT NULL,
  Revoked_At DATETIME(3) NULL,
  Revocation_Reason VARCHAR(255) NULL,
  Created_IP_Hash CHAR(64) NULL,
  Last_IP_Hash CHAR(64) NULL,
  User_Agent_Hash CHAR(64) NULL,
  PRIMARY KEY (Session_ID),
  UNIQUE KEY uq_auth_session_family (Token_Family_ID),
  KEY idx_auth_session_user_active (User_ID, Revoked_At, Absolute_Expires_At),
  KEY idx_auth_session_cleanup (Absolute_Expires_At, Revoked_At),
  CONSTRAINT fk_auth_session_user FOREIGN KEY (User_ID) REFERENCES User(ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Auth_Refresh_Token (
  Token_ID CHAR(36) NOT NULL,
  Session_ID CHAR(36) NOT NULL,
  Token_Hash CHAR(64) NOT NULL,
  Parent_Token_ID CHAR(36) NULL,
  Replaced_By_Token_ID CHAR(36) NULL,
  Issued_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Expires_At DATETIME(3) NOT NULL,
  Used_At DATETIME(3) NULL,
  Revoked_At DATETIME(3) NULL,
  PRIMARY KEY (Token_ID),
  UNIQUE KEY uq_auth_refresh_hash (Token_Hash),
  KEY idx_auth_refresh_session (Session_ID, Revoked_At, Expires_At),
  KEY idx_auth_refresh_cleanup (Expires_At, Revoked_At),
  CONSTRAINT fk_auth_refresh_session FOREIGN KEY (Session_ID) REFERENCES Auth_Session(Session_ID) ON DELETE CASCADE,
  CONSTRAINT fk_auth_refresh_parent FOREIGN KEY (Parent_Token_ID) REFERENCES Auth_Refresh_Token(Token_ID) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Auth_Session_Event (
  Event_ID BIGINT NOT NULL AUTO_INCREMENT,
  Session_ID CHAR(36) NULL,
  User_ID INT NOT NULL,
  Event_Type VARCHAR(50) NOT NULL,
  Occurred_At DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  Details JSON NULL,
  PRIMARY KEY (Event_ID),
  KEY idx_auth_event_user_time (User_ID, Occurred_At),
  KEY idx_auth_event_session_time (Session_ID, Occurred_At),
  CONSTRAINT fk_auth_event_session FOREIGN KEY (Session_ID) REFERENCES Auth_Session(Session_ID) ON DELETE SET NULL
);

INSERT INTO Schema_Migration (Migration_ID)
VALUES ('2026-07-29-secure-auth-sessions')
ON DUPLICATE KEY UPDATE Applied_At = Applied_At;
