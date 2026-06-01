DROP TABLE IF EXISTS Dental_History;
DROP TABLE IF EXISTS Medical_History;
DROP TABLE IF EXISTS Dental_Chart;   
DROP TABLE IF EXISTS Lab_Treatment;
DROP TABLE IF EXISTS Teeth_Details;
DROP TABLE IF EXISTS Lab_Results;
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
DROP TABLE IF EXISTS Lab_Treatment_Teeth_Details;
DROP TABLE IF EXISTS Discipline;

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
CREATE TABLE Dental_Chart (
    ID INT PRIMARY KEY,
    Category VARCHAR(255),
    Sub_Category VARCHAR(255),
    Code VARCHAR(255),
    Site VARCHAR(255),
    Suf VARCHAR(255),
    Status VARCHAR(255),
    Pre_Auth VARCHAR(255),
    Phase VARCHAR(255),
    Discipline VARCHAR(255),
    Diagnoses TEXT,
    Note TEXT,
    Estimate DECIMAL(10, 2),
    Doctor_ID INT,
    Audit_Date DATE,
    Created_Date DATE
);
CREATE TABLE Lab_Results (
    ID INT PRIMARY KEY,
    T_Name Name,
    Order_ID INT,
    Case_ID INT,
    Lab_Procedure VARCHAR(255),
    Site_ID INT,
    Discipline VARCHAR(255),
    Lab VARCHAR(255),
    isCompleted BOOLEAN,
    Status VARCHAR(255),
    State VARCHAR(255),
    Created_Date DATE,
    UNIQUE (Order_ID)
);
CREATE TABLE Lab_Prescriptions (
    ID INT PRIMARY KEY,
    Type VARCHAR(255),
    Prescription TEXT
);
CREATE TABLE Attachments (
    ID INT PRIMARY KEY,
    Section_Type VARCHAR(255),
    File_Path TEXT,
    Size INT,
    Format VARCHAR(100)
);
CREATE TABLE Teeth_Details (
    ID INT PRIMARY KEY,
    Order_ID INT,
    Question_Type VARCHAR(255),
    Answer TEXT,
    Note TEXT,
    Created_Date DATE,
    FOREIGN KEY (Order_ID) REFERENCES Lab_Results(Order_ID)
);
CREATE TABLE Allergies (
    ID INT PRIMARY KEY,
    Name VARCHAR(255),
    Description TEXT
);
CREATE TABLE Medications (
    ID INT PRIMARY KEY,
    Drug VARCHAR(255),
    Dose VARCHAR(255),
    Total INT,
    Refills INT,
    Start_Date DATE,
    End_Date DATE,
    Frequency VARCHAR(255),
    Approved_By VARCHAR(255)
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
    FOREIGN KEY (Order_ID) REFERENCES Lab_Results(Order_ID),
    FOREIGN KEY (Teeth_Details_ID) REFERENCES Teeth_Details(ID)
);
CREATE TABLE UserRole (
    Role_ID INT PRIMARY KEY,
    Name VARCHAR(255),
    Access_Level INT,
    IsActive BOOLEAN,
    Created_Date DATE,
    Modified_Date DATE
);
CREATE TABLE User (
    ID INT PRIMARY KEY,
    First_Name VARCHAR(255),
    Last_Name VARCHAR(255),
    Password VARCHAR(255),
    Email VARCHAR(255),
    Contact_Number VARCHAR(255),
    Role_ID INT,
    Created_Date DATE,
    IsActive BOOLEAN,
    Last_Login_Date DATE,
    FOREIGN KEY (Role_ID) REFERENCES UserRole(Role_ID)
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
CREATE TABLE Doctor (
    ID INT PRIMARY KEY,
    Works_At VARCHAR(255),
    Specialty VARCHAR(255)
);
CREATE TABLE Patient (
    ID INT PRIMARY KEY,
    Date_of_Birth DATE,
    Gender VARCHAR(50),
    Emirates_ID VARCHAR(255)
);
CREATE TABLE Appointment (
    Appointment_ID INT PRIMARY KEY,
    Status VARCHAR(255),
    From_Date DATE,
    To_Date DATE,
    Doctor_ID INT,
    Patient_ID INT,
    Notes TEXT,
    Created_Date DATE,
    Modified_Date DATE,
    FOREIGN KEY (Doctor_ID) REFERENCES Doctor(ID),
    FOREIGN KEY (Patient_ID) REFERENCES Patient(ID)
);
CREATE TABLE Permissions (
    ID INT PRIMARY KEY
);
CREATE TABLE Organization (
    Organization_ID INT PRIMARY KEY,
    Name VARCHAR(255),
    Address TEXT,
    Description TEXT,
    Coordinates VARCHAR(255),
    Type VARCHAR(255),
    Created_Date DATE,
    Modified_Date DATE
);
CREATE TABLE Sys_Admin (
    Organization_ID INT PRIMARY KEY
);
CREATE TABLE Admin (
    Organization_ID INT PRIMARY KEY
);
CREATE TABLE Request_Type (
    ID INT PRIMARY KEY,
    Type VARCHAR(255)
);
CREATE TABLE Request_Status (
    ID INT PRIMARY KEY,
    Status VARCHAR(255)
);
CREATE TABLE Appointment_Status (
    ID INT PRIMARY KEY,
    Status VARCHAR(255)
);
CREATE TABLE Notification_Type (
    ID INT PRIMARY KEY,
    Type VARCHAR(255)
);
CREATE TABLE Notification_Status (
    ID INT PRIMARY KEY,
    Status VARCHAR(255)
);
CREATE TABLE Data_Access_Type (
    ID INT PRIMARY KEY,
    Type VARCHAR(255)
);
CREATE TABLE User_Activity_Status (
    ID INT PRIMARY KEY,
    Status VARCHAR(255)
);
CREATE TABLE Organization_Type (
    ID INT PRIMARY KEY,
    Type VARCHAR(255)
);
CREATE TABLE Attachment_Type (
    ID INT PRIMARY KEY,
    Type VARCHAR(255)
);
CREATE TABLE Dental_Chart_Category (
    ID INT PRIMARY KEY,
    Category VARCHAR(255)
);
CREATE TABLE Dental_Chart_Status (
    ID INT PRIMARY KEY,
    Status VARCHAR(255)
);
CREATE TABLE Medical_History_Question_Type (
    ID INT PRIMARY KEY,
    Question_Type VARCHAR(255)
);
CREATE TABLE Medical_History_Answer (
    ID INT PRIMARY KEY,
    Answer VARCHAR(255)
);
CREATE TABLE Medical_History_Category (
    ID INT PRIMARY KEY,
    Category VARCHAR(255)
);
CREATE TABLE Medical_History_Health_Impression (
    ID INT PRIMARY KEY,
    Impression VARCHAR(255)
);
CREATE TABLE Lab_Treatment_Teeth_Details (
    ID INT PRIMARY KEY,
    Details VARCHAR(255)
);
CREATE TABLE Discipline (
    ID INT PRIMARY KEY,
    Name VARCHAR(255),
    Description VARCHAR(255)
);


