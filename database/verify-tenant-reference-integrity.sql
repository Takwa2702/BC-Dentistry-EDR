-- Return no rows when tenant references are internally consistent.

SELECT 'admin_missing_organization' AS Issue, a.User_ID AS Record_ID, a.Organization_ID AS Related_ID
FROM Admin a
LEFT JOIN Organization o ON o.Organization_ID = a.Organization_ID
WHERE o.Organization_ID IS NULL
UNION ALL
SELECT 'doctor_missing_user', d.ID, NULL
FROM Doctor d
LEFT JOIN User u ON u.ID = d.ID
WHERE u.ID IS NULL
UNION ALL
SELECT 'doctor_missing_clinic', d.ID, d.Clinic_ID
FROM Doctor d
LEFT JOIN Organization o ON o.Organization_ID = d.Clinic_ID
WHERE d.Clinic_ID IS NULL OR o.Organization_ID IS NULL
UNION ALL
SELECT 'patient_missing_user', p.ID, NULL
FROM Patient p
LEFT JOIN User u ON u.ID = p.ID
WHERE u.ID IS NULL
UNION ALL
SELECT 'patient_missing_clinic', p.ID, p.Clinic_ID
FROM Patient p
LEFT JOIN Organization o ON o.Organization_ID = p.Clinic_ID
WHERE p.Clinic_ID IS NULL OR o.Organization_ID IS NULL
UNION ALL
SELECT 'patient_invalid_doctor', p.ID, NULL
FROM Patient p
JOIN JSON_TABLE(
  COALESCE(p.Doctors, JSON_ARRAY()),
  '$[*]' COLUMNS (Doctor_Blockchain_ID varchar(64) PATH '$')
) assigned
LEFT JOIN Doctor d ON d.Blockchain_ID = assigned.Doctor_Blockchain_ID
WHERE d.ID IS NULL
UNION ALL
SELECT 'patient_cross_clinic_doctor', p.ID, d.ID
FROM Patient p
JOIN JSON_TABLE(
  COALESCE(p.Doctors, JSON_ARRAY()),
  '$[*]' COLUMNS (Doctor_Blockchain_ID varchar(64) PATH '$')
) assigned
JOIN Doctor d ON d.Blockchain_ID = assigned.Doctor_Blockchain_ID
WHERE p.Clinic_ID <> d.Clinic_ID
UNION ALL
SELECT 'appointment_cross_clinic', a.Appointment_ID, d.ID
FROM Appointment a
JOIN Doctor d ON d.ID = a.Doctor_ID
JOIN Patient p ON p.ID = a.Patient_ID
WHERE d.Clinic_ID <> p.Clinic_ID
UNION ALL
SELECT 'clinical_record_missing_patient', c.Record_ID, c.Patient_Blockchain_ID
FROM Clinical_Record c
LEFT JOIN Patient p ON p.Blockchain_ID = c.Patient_Blockchain_ID
WHERE p.ID IS NULL
UNION ALL
SELECT 'clinical_record_missing_doctor', c.Record_ID, c.Created_By_Doctor_ID
FROM Clinical_Record c
LEFT JOIN Doctor d ON d.Blockchain_ID = c.Created_By_Doctor_ID
WHERE d.ID IS NULL;
