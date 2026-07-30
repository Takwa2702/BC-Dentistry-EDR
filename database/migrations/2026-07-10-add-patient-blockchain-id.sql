-- Adds durable off-chain mapping from authenticated Patient users to on-chain patient IDs.
-- Run before deploying Database API login changes that select Patient.Blockchain_ID.

ALTER TABLE Patient
  ADD COLUMN Blockchain_ID VARCHAR(50) DEFAULT NULL,
  ADD UNIQUE KEY uq_patient_blockchain_id (Blockchain_ID);

UPDATE Patient
SET Blockchain_ID = CASE Emirates_ID
  WHEN '1234567890' THEN 'Patient1'
  WHEN '9876543210' THEN 'Patient2'
  WHEN '1357924680' THEN 'Patient3'
  ELSE Blockchain_ID
END
WHERE Blockchain_ID IS NULL
  AND Emirates_ID IN ('1234567890', '9876543210', '1357924680');
