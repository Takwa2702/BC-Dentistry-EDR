SELECT CASE
  WHEN (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User'
      AND COLUMN_NAME IN ('Security_Version', 'Sessions_Invalid_Before')
  ) = 2
  AND (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('Auth_Session', 'Auth_Refresh_Token', 'Auth_Session_Event', 'Schema_Migration')
  ) = 4
  AND EXISTS (
    SELECT 1 FROM Schema_Migration
    WHERE Migration_ID = '2026-07-29-secure-auth-sessions'
  )
  THEN 'SECURE_AUTH_SCHEMA_OK'
  ELSE 'SECURE_AUTH_SCHEMA_INCOMPLETE'
END AS Secure_Auth_Schema_Status;
