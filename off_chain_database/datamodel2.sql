-- Drop existing tables if they exist
DROP TABLE IF EXISTS Lab_Treatment_Teeth_Details;
DROP TABLE IF EXISTS Lab_Treatment;
DROP TABLE IF EXISTS Teeth_Details;
DROP TABLE IF EXISTS Lab_Prescriptions;
DROP TABLE IF EXISTS Attachments;
DROP TABLE IF EXISTS Allergies;
DROP TABLE IF EXISTS Medications;
DROP TABLE IF EXISTS Notification;
DROP TABLE IF EXISTS Request;
DROP TABLE IF EXISTS User;
DROP TABLE IF EXISTS UserRole;
DROP TABLE IF EXISTS Finances;
DROP TABLE IF EXISTS Insurance;
DROP TABLE IF EXISTS Data_Access;
DROP TABLE IF EXISTS Appointment;
DROP TABLE IF EXISTS Doctor;
DROP TABLE IF EXISTS Patient;
DROP TABLE IF EXISTS Permissions;
DROP TABLE IF EXISTS Organization;
DROP TABLE IF EXISTS Sys_Admin;
DROP TABLE IF EXISTS Admin;
DROP TABLE IF EXISTS Request_Type;
DROP TABLE IF EXISTS Request_Status;
DROP TABLE IF EXISTS Appointment_Status;
DROP TABLE IF EXISTS Notification_Type;
DROP TABLE IF EXISTS Notification_Status;
DROP TABLE IF EXISTS Data_Access_Type;
DROP TABLE IF EXISTS User_Activity_Status;
DROP TABLE IF EXISTS Organization_Type;
DROP TABLE IF EXISTS Attachment_Type;
DROP TABLE IF EXISTS Dental_Chart_Category;
DROP TABLE IF EXISTS Dental_Chart_Status;
DROP TABLE IF EXISTS Medical_History_Question_Type;
DROP TABLE IF EXISTS Medical_History_Answer;
DROP TABLE IF EXISTS Medical_History_Category;
DROP TABLE IF EXISTS Medical_History_Health_Impression;
DROP TABLE IF EXISTS Discipline;
DROP TABLE IF EXISTS Dental_Chart;
DROP TABLE IF EXISTS Dental_History;
DROP TABLE IF EXISTS Medical_History;
DROP TABLE IF EXISTS Lab_Results;

-- Create tables with foreign keys and appropriate constraints
CREATE TABLE UserRole (
    Role_ID INT PRIMARY KEY,
    Role_Name VARCHAR(255) NOT NULL UNIQUE,
    Access_Level INT NOT NULL,
    IsActive BOOLEAN,
    Created_Date DATE,
    Modified_Date DATE
);

CREATE TABLE User (
    ID INT PRIMARY KEY AUTO_INCREMENT,,
    First_Name VARCHAR(255) NOT NULL,
    Last_Name VARCHAR(255) NOT NULL,
    Password VARCHAR(255) NOT NULL,
    Email VARCHAR(255) NOT NULL UNIQUE,
    Contact_Number VARCHAR(255),
    Role_ID INT,
    Created_Date DATE,
    IsActive BOOLEAN,
    Last_Login_Date DATE,
    FOREIGN KEY (Role_ID) REFERENCES UserRole(Role_ID)
);

CREATE TABLE Doctor (
    ID INT PRIMARY KEY,
    Works_At VARCHAR(255) NOT NULL,
    Specialty VARCHAR(255) NOT NULL
);

CREATE TABLE Patient (
    ID INT PRIMARY KEY,
    Date_of_Birth DATE NOT NULL,
    Gender VARCHAR(50) NOT NULL,
    Emirates_ID VARCHAR(255) NOT NULL
);

CREATE TABLE Appointment (
    Meeting_For TEXT NOT NULL,
    Appointment_ID INT PRIMARY KEY,
    Doctor_ID INT,
    Patient_ID INT,
    Date DATE NOT NULL,
    Notes TEXT,
    FOREIGN KEY (Doctor_ID) REFERENCES Doctor(ID),
    FOREIGN KEY (Patient_ID) REFERENCES Patient(ID)
);

CREATE TABLE Lab_Results (
    ID INT PRIMARY KEY,
    T_Name VARCHAR(255) NOT NULL,
    Order_ID INT UNIQUE NOT NULL,
    Case_ID INT,
    Site_ID INT,
    Discipline VARCHAR(255) NOT NULL,
    Status VARCHAR(255) NOT NULL,
    Created_Date DATE NOT NULL
);

CREATE TABLE Teeth_Details (
    ID INT PRIMARY KEY,
    Order_ID INT,
    Question_Type VARCHAR(255),
    Answer TEXT,
    Note TEXT,
    Created_Date DATE,
    FOREIGN KEY (Order_ID) REFERENCES Lab_Results(Order_ID) ON DELETE CASCADE
);

CREATE TABLE Lab_Treatment (
    ID INT PRIMARY KEY,
    Order_ID INT,
    Teeth_Details_ID INT,
    Design_Type VARCHAR(255),
    Material_Used VARCHAR(255),
    Metal_Type VARCHAR(255),
    Ceramic_Type VARCHAR(255),
    Created_Date DATE,
    FOREIGN KEY (Order_ID) REFERENCES Lab_Results(Order_ID) ON DELETE CASCADE,
    FOREIGN KEY (Teeth_Details_ID) REFERENCES Teeth_Details(ID) ON DELETE SET NULL
);

CREATE TABLE Dental_History (
    ID INT PRIMARY KEY,
    Category VARCHAR(255),
    Question_Type VARCHAR(255),
    Answer TEXT,
    Note TEXT,
    Verified_Date DATE,
    Is_Approved BOOLEAN,
    Modified_Date DATE,
    Created_Date DATE
);

CREATE TABLE Medical_History (
    ID INT PRIMARY KEY,
    Category VARCHAR(255),
    Question_Type VARCHAR(255),
    Answer TEXT,
    Note TEXT,
    Verified_Date DATE,
    Is_Approved BOOLEAN,
    Modified_Date DATE,
    Created_Date DATE
);

CREATE TABLE Notification (
    Notification_ID INT PRIMARY KEY,
    Type VARCHAR(255),
    Message TEXT,
    Description VARCHAR(255),
    Created_Date DATE,
    User_ID INT,
    FOREIGN KEY (User_ID) REFERENCES User(ID)
);

CREATE TABLE Insurance (
    ID INT PRIMARY KEY,
    Name VARCHAR(255),
    Address TEXT,
    Description TEXT,
    Created_Date DATE,
    Modified_Date DATE
);

CREATE TABLE Finances (
    ID INT PRIMARY KEY,
    Balance DECIMAL(10,2),
    Insurance_ID INT,
    Modified_Date DATE,
    Created_Date DATE,
    FOREIGN KEY (Insurance_ID) REFERENCES Insurance(ID)
);

CREATE TABLE Request (
    Request_ID INT PRIMARY KEY,
    Request_Type VARCHAR(255),
    Organization_ID INT,
    Data_Access_ID INT,
    Status VARCHAR(255),
    Created_Date DATE,
    Modified_Date DATE,
    Approved_Date DATE,
    Requested_To INT,
    Requested_By INT,
    FOREIGN KEY (Requested_To) REFERENCES User(ID),
    FOREIGN KEY (Requested_By) REFERENCES User(ID)
);

CREATE TABLE Data_Access (
    ID INT PRIMARY KEY,
    Type VARCHAR(255),
    From_Date DATE,
    To_Date DATE
);

CREATE TABLE Discipline (
    ID INT PRIMARY KEY,
    Name VARCHAR(255),
    Description VARCHAR(255)
);

-- Insert sample data into tables
INSERT INTO Doctor (ID, Works_At, Specialty) VALUES 
(1, 'Smile Dental Clinic', 'Orthodontics'),
(2, 'Bright Smiles Clinic', 'Periodontics'),
(3, 'Healthy Teeth Dental', 'Endodontics'),
(4, 'Advanced Dental Care', 'Oral Surgery'),
(5, 'Family Dentistry Center', 'Pediatric Dentistry');

INSERT INTO Patient (ID, Date_of_Birth, Gender, Emirates_ID) VALUES
(101, '1990-01-01', 'Male', 'EID123456789'),
(102, '1985-02-15', 'Female', 'EID987654321'),
(103, '1975-03-30', 'Male', 'EID112233445'),
(104, '1995-07-07', 'Female', 'EID556677889'),
(105, '2010-05-20', 'Male', 'EID998877665');

INSERT INTO Appointment (Meeting_For, Appointment_ID, Doctor_ID, Patient_ID, Date) VALUES
('Routine Checkup', 1, 1, 101, '2024-08-01'),
('Gum Disease Treatment', 2, 2, 102, '2024-08-02'),
('Root Canal', 3, 3, 103, '2024-08-03'),
('Wisdom Tooth Extraction', 4, 4, 104, '2024-08-04'),
('Child Dental Checkup', 5, 5, 105, '2024-08-05');

INSERT INTO Lab_Results (ID, T_Name, Order_ID, Case_ID, Site_ID, Discipline, Status, Created_Date) VALUES 
(1, 'Hemoglobin Test', 1001, 501, 101, 'Hematology', 'Completed', '2024-08-01'),
(2, 'Lipid Panel', 1002, 502, 102, 'Cardiology', 'In Progress', '2024-09-15'),
(3, 'Complete Blood Count', 1003, 503, 103, 'Hematology', 'Completed', '2024-07-25'),
(4, 'Kidney Function Test', 1004, 504, 104, 'Nephrology', 'Pending', '2024-10-01'),
(5, 'Liver Function Test', 1005, 505, 105, 'Gastroenterology', 'Completed', '2024-06-10'),
(6, 'Thyroid Function Test', 1006, 506, 106, 'Endocrinology', 'Pending', '2024-07-22');

