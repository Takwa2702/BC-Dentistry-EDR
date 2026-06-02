-- MySQL dump 10.13  Distrib 9.0.1, for Linux (x86_64)
--
-- Host: localhost    Database: mydatabase
-- ------------------------------------------------------
-- Server version	9.0.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Admin`
--

DROP TABLE IF EXISTS `Admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Admin` (
  `Organization_ID` int NOT NULL,
  `User_ID` int NOT NULL,
  PRIMARY KEY (`Organization_ID`),
  KEY `fk_admin_user` (`User_ID`),
  CONSTRAINT `fk_admin_user` FOREIGN KEY (`User_ID`) REFERENCES `User` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Admin`
--

LOCK TABLES `Admin` WRITE;
/*!40000 ALTER TABLE `Admin` DISABLE KEYS */;
INSERT INTO `Admin` VALUES (2,9),(1,10);
/*!40000 ALTER TABLE `Admin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Allergies`
--

DROP TABLE IF EXISTS `Allergies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Allergies` (
  `ID` int NOT NULL,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Allergies`
--

LOCK TABLES `Allergies` WRITE;
/*!40000 ALTER TABLE `Allergies` DISABLE KEYS */;
/*!40000 ALTER TABLE `Allergies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Appointment`
--

DROP TABLE IF EXISTS `Appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Appointment` (
  `Meeting_For` text,
  `Appointment_ID` int NOT NULL,
  `Doctor_ID` int DEFAULT NULL,
  `Patient_ID` int DEFAULT NULL,
  `Date` date DEFAULT NULL,
  `Notes` text,
  PRIMARY KEY (`Appointment_ID`),
  KEY `Doctor_ID` (`Doctor_ID`),
  KEY `Patient_ID` (`Patient_ID`),
  CONSTRAINT `Appointment_ibfk_1` FOREIGN KEY (`Doctor_ID`) REFERENCES `Doctor` (`ID`),
  CONSTRAINT `Appointment_ibfk_2` FOREIGN KEY (`Patient_ID`) REFERENCES `Patient` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Appointment`
--

LOCK TABLES `Appointment` WRITE;
/*!40000 ALTER TABLE `Appointment` DISABLE KEYS */;
/*!40000 ALTER TABLE `Appointment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Appointment_Status`
--

DROP TABLE IF EXISTS `Appointment_Status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Appointment_Status` (
  `ID` int NOT NULL,
  `Status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Appointment_Status`
--

LOCK TABLES `Appointment_Status` WRITE;
/*!40000 ALTER TABLE `Appointment_Status` DISABLE KEYS */;
/*!40000 ALTER TABLE `Appointment_Status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Attachment_Type`
--

DROP TABLE IF EXISTS `Attachment_Type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Attachment_Type` (
  `ID` int NOT NULL,
  `Type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Attachment_Type`
--

LOCK TABLES `Attachment_Type` WRITE;
/*!40000 ALTER TABLE `Attachment_Type` DISABLE KEYS */;
/*!40000 ALTER TABLE `Attachment_Type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Attachments`
--

DROP TABLE IF EXISTS `Attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Attachments` (
  `ID` int NOT NULL,
  `Section_Type` varchar(255) DEFAULT NULL,
  `File_Path` text,
  `Size` int DEFAULT NULL,
  `Format` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Attachments`
--

LOCK TABLES `Attachments` WRITE;
/*!40000 ALTER TABLE `Attachments` DISABLE KEYS */;
/*!40000 ALTER TABLE `Attachments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Data_Access`
--

DROP TABLE IF EXISTS `Data_Access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Data_Access` (
  `ID` int NOT NULL,
  `Type` varchar(255) DEFAULT NULL,
  `From_Date` date DEFAULT NULL,
  `To_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Data_Access`
--

LOCK TABLES `Data_Access` WRITE;
/*!40000 ALTER TABLE `Data_Access` DISABLE KEYS */;
/*!40000 ALTER TABLE `Data_Access` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Data_Access_Type`
--

DROP TABLE IF EXISTS `Data_Access_Type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Data_Access_Type` (
  `ID` int NOT NULL,
  `Type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Data_Access_Type`
--

LOCK TABLES `Data_Access_Type` WRITE;
/*!40000 ALTER TABLE `Data_Access_Type` DISABLE KEYS */;
/*!40000 ALTER TABLE `Data_Access_Type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Dental_Chart`
--

DROP TABLE IF EXISTS `Dental_Chart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Dental_Chart` (
  `ID` int NOT NULL,
  `Category` varchar(255) DEFAULT NULL,
  `Sub_Category` varchar(255) DEFAULT NULL,
  `Code` varchar(255) DEFAULT NULL,
  `Site` varchar(255) DEFAULT NULL,
  `Suf` varchar(255) DEFAULT NULL,
  `Status` varchar(255) DEFAULT NULL,
  `Pre_Auth` varchar(255) DEFAULT NULL,
  `Phase` varchar(255) DEFAULT NULL,
  `Discipline` varchar(255) DEFAULT NULL,
  `Diagnoses` text,
  `Note` text,
  `Estimate` decimal(10,2) DEFAULT NULL,
  `Doctor_ID` int DEFAULT NULL,
  `Audit_Date` date DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Dental_Chart`
--

LOCK TABLES `Dental_Chart` WRITE;
/*!40000 ALTER TABLE `Dental_Chart` DISABLE KEYS */;
/*!40000 ALTER TABLE `Dental_Chart` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Dental_Chart_Category`
--

DROP TABLE IF EXISTS `Dental_Chart_Category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Dental_Chart_Category` (
  `ID` int NOT NULL,
  `Category` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Dental_Chart_Category`
--

LOCK TABLES `Dental_Chart_Category` WRITE;
/*!40000 ALTER TABLE `Dental_Chart_Category` DISABLE KEYS */;
/*!40000 ALTER TABLE `Dental_Chart_Category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Dental_Chart_Status`
--

DROP TABLE IF EXISTS `Dental_Chart_Status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Dental_Chart_Status` (
  `ID` int NOT NULL,
  `Status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Dental_Chart_Status`
--

LOCK TABLES `Dental_Chart_Status` WRITE;
/*!40000 ALTER TABLE `Dental_Chart_Status` DISABLE KEYS */;
/*!40000 ALTER TABLE `Dental_Chart_Status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Dental_History`
--

DROP TABLE IF EXISTS `Dental_History`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Dental_History` (
  `ID` int NOT NULL,
  `Category` varchar(255) DEFAULT NULL,
  `Question_Type` varchar(255) DEFAULT NULL,
  `Answer` text,
  `Note` text,
  `Verified_Date` date DEFAULT NULL,
  `Is_Approved` tinyint(1) DEFAULT NULL,
  `Modified_Date` date DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Dental_History`
--

LOCK TABLES `Dental_History` WRITE;
/*!40000 ALTER TABLE `Dental_History` DISABLE KEYS */;
/*!40000 ALTER TABLE `Dental_History` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Discipline`
--

DROP TABLE IF EXISTS `Discipline`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Discipline` (
  `ID` int NOT NULL,
  `Name` varchar(255) DEFAULT NULL,
  `Description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Discipline`
--

LOCK TABLES `Discipline` WRITE;
/*!40000 ALTER TABLE `Discipline` DISABLE KEYS */;
/*!40000 ALTER TABLE `Discipline` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Doctor`
--

DROP TABLE IF EXISTS `Doctor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Doctor` (
  `ID` int NOT NULL,
  `Works_At` varchar(255) DEFAULT NULL,
  `Specialty` varchar(255) DEFAULT NULL,
  `Blockchain_ID` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Blockchain_ID` (`Blockchain_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Doctor`
--

LOCK TABLES `Doctor` WRITE;
/*!40000 ALTER TABLE `Doctor` DISABLE KEYS */;
INSERT INTO `Doctor` VALUES (1,'Smile Dental Clinic','Orthodontics',NULL),(2,'Bright Smiles Clinic','Periodontics',NULL),(3,'Healthy Teeth Dental','Endodontics',NULL),(4,'Advanced Dental Care','Oral Surgery',NULL),(5,'Family Dentistry Center','Pediatric Dentistry',NULL),(15,'Dental Clinic A','Orthodontist','Doctor1'),(16,'Dental Clinic B','Orthodontist','Doctor2');
/*!40000 ALTER TABLE `Doctor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Finances`
--

DROP TABLE IF EXISTS `Finances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Finances` (
  `ID` int NOT NULL,
  `Balance` decimal(10,2) DEFAULT NULL,
  `Insurance_ID` int DEFAULT NULL,
  `Modified_Date` date DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `Insurance_ID` (`Insurance_ID`),
  CONSTRAINT `Finances_ibfk_1` FOREIGN KEY (`Insurance_ID`) REFERENCES `Insurance` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Finances`
--

LOCK TABLES `Finances` WRITE;
/*!40000 ALTER TABLE `Finances` DISABLE KEYS */;
/*!40000 ALTER TABLE `Finances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Insurance`
--

DROP TABLE IF EXISTS `Insurance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Insurance` (
  `ID` int NOT NULL,
  `Name` varchar(255) DEFAULT NULL,
  `Address` text,
  `Description` text,
  `Created_Date` date DEFAULT NULL,
  `Modified_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Insurance`
--

LOCK TABLES `Insurance` WRITE;
/*!40000 ALTER TABLE `Insurance` DISABLE KEYS */;
/*!40000 ALTER TABLE `Insurance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Lab_Prescriptions`
--

DROP TABLE IF EXISTS `Lab_Prescriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Lab_Prescriptions` (
  `ID` int NOT NULL,
  `Type` varchar(255) DEFAULT NULL,
  `Prescription` text,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Lab_Prescriptions`
--

LOCK TABLES `Lab_Prescriptions` WRITE;
/*!40000 ALTER TABLE `Lab_Prescriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `Lab_Prescriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Lab_Results`
--

DROP TABLE IF EXISTS `Lab_Results`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Lab_Results` (
  `ID` int NOT NULL,
  `Order_ID` int DEFAULT NULL,
  `Case_ID` int DEFAULT NULL,
  `Lab_Procedure` varchar(255) DEFAULT NULL,
  `Site_ID` int DEFAULT NULL,
  `Discipline` varchar(255) DEFAULT NULL,
  `Lab` varchar(255) DEFAULT NULL,
  `isCompleted` tinyint(1) DEFAULT NULL,
  `Status` varchar(255) DEFAULT NULL,
  `State` varchar(255) DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Order_ID` (`Order_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Lab_Results`
--

LOCK TABLES `Lab_Results` WRITE;
/*!40000 ALTER TABLE `Lab_Results` DISABLE KEYS */;
/*!40000 ALTER TABLE `Lab_Results` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Lab_Treatment`
--

DROP TABLE IF EXISTS `Lab_Treatment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Lab_Treatment` (
  `ID` int NOT NULL,
  `Order_ID` int DEFAULT NULL,
  `Teeth_Details_ID` int DEFAULT NULL,
  `Design_Type` varchar(255) DEFAULT NULL,
  `Material_Used` varchar(255) DEFAULT NULL,
  `Metal_Type` varchar(255) DEFAULT NULL,
  `Ceramic_Type` varchar(255) DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `Order_ID` (`Order_ID`),
  KEY `Teeth_Details_ID` (`Teeth_Details_ID`),
  CONSTRAINT `Lab_Treatment_ibfk_1` FOREIGN KEY (`Order_ID`) REFERENCES `Lab_Results` (`Order_ID`),
  CONSTRAINT `Lab_Treatment_ibfk_2` FOREIGN KEY (`Teeth_Details_ID`) REFERENCES `Teeth_Details` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Lab_Treatment`
--

LOCK TABLES `Lab_Treatment` WRITE;
/*!40000 ALTER TABLE `Lab_Treatment` DISABLE KEYS */;
/*!40000 ALTER TABLE `Lab_Treatment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Lab_Treatment_Teeth_Details`
--

DROP TABLE IF EXISTS `Lab_Treatment_Teeth_Details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Lab_Treatment_Teeth_Details` (
  `ID` int NOT NULL,
  `Details` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Lab_Treatment_Teeth_Details`
--

LOCK TABLES `Lab_Treatment_Teeth_Details` WRITE;
/*!40000 ALTER TABLE `Lab_Treatment_Teeth_Details` DISABLE KEYS */;
/*!40000 ALTER TABLE `Lab_Treatment_Teeth_Details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Medical_History`
--

DROP TABLE IF EXISTS `Medical_History`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Medical_History` (
  `ID` int NOT NULL,
  `Category` varchar(255) DEFAULT NULL,
  `Question_Type` varchar(255) DEFAULT NULL,
  `Answer` text,
  `Note` text,
  `Verified_Date` date DEFAULT NULL,
  `Is_Approved` tinyint(1) DEFAULT NULL,
  `Modified_Date` date DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Medical_History`
--

LOCK TABLES `Medical_History` WRITE;
/*!40000 ALTER TABLE `Medical_History` DISABLE KEYS */;
/*!40000 ALTER TABLE `Medical_History` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Medical_History_Answer`
--

DROP TABLE IF EXISTS `Medical_History_Answer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Medical_History_Answer` (
  `ID` int NOT NULL,
  `Answer` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Medical_History_Answer`
--

LOCK TABLES `Medical_History_Answer` WRITE;
/*!40000 ALTER TABLE `Medical_History_Answer` DISABLE KEYS */;
/*!40000 ALTER TABLE `Medical_History_Answer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Medical_History_Category`
--

DROP TABLE IF EXISTS `Medical_History_Category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Medical_History_Category` (
  `ID` int NOT NULL,
  `Category` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Medical_History_Category`
--

LOCK TABLES `Medical_History_Category` WRITE;
/*!40000 ALTER TABLE `Medical_History_Category` DISABLE KEYS */;
/*!40000 ALTER TABLE `Medical_History_Category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Medical_History_Health_Impression`
--

DROP TABLE IF EXISTS `Medical_History_Health_Impression`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Medical_History_Health_Impression` (
  `ID` int NOT NULL,
  `Impression` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Medical_History_Health_Impression`
--

LOCK TABLES `Medical_History_Health_Impression` WRITE;
/*!40000 ALTER TABLE `Medical_History_Health_Impression` DISABLE KEYS */;
/*!40000 ALTER TABLE `Medical_History_Health_Impression` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Medical_History_Question_Type`
--

DROP TABLE IF EXISTS `Medical_History_Question_Type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Medical_History_Question_Type` (
  `ID` int NOT NULL,
  `Question_Type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Medical_History_Question_Type`
--

LOCK TABLES `Medical_History_Question_Type` WRITE;
/*!40000 ALTER TABLE `Medical_History_Question_Type` DISABLE KEYS */;
/*!40000 ALTER TABLE `Medical_History_Question_Type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Medications`
--

DROP TABLE IF EXISTS `Medications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Medications` (
  `ID` int NOT NULL,
  `Drug` varchar(255) DEFAULT NULL,
  `Dose` varchar(255) DEFAULT NULL,
  `Total` int DEFAULT NULL,
  `Refills` int DEFAULT NULL,
  `Start_Date` date DEFAULT NULL,
  `End_Date` date DEFAULT NULL,
  `Frequency` varchar(255) DEFAULT NULL,
  `Approved_By` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Medications`
--

LOCK TABLES `Medications` WRITE;
/*!40000 ALTER TABLE `Medications` DISABLE KEYS */;
/*!40000 ALTER TABLE `Medications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Notification`
--

DROP TABLE IF EXISTS `Notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Notification` (
  `Notification_ID` int NOT NULL,
  `Type` varchar(255) DEFAULT NULL,
  `Message` text,
  `Description` varchar(255) DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  `User_ID` int DEFAULT NULL,
  PRIMARY KEY (`Notification_ID`),
  KEY `User_ID` (`User_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Notification`
--

LOCK TABLES `Notification` WRITE;
/*!40000 ALTER TABLE `Notification` DISABLE KEYS */;
/*!40000 ALTER TABLE `Notification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Notification_Status`
--

DROP TABLE IF EXISTS `Notification_Status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Notification_Status` (
  `ID` int NOT NULL,
  `Status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Notification_Status`
--

LOCK TABLES `Notification_Status` WRITE;
/*!40000 ALTER TABLE `Notification_Status` DISABLE KEYS */;
/*!40000 ALTER TABLE `Notification_Status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Notification_Type`
--

DROP TABLE IF EXISTS `Notification_Type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Notification_Type` (
  `ID` int NOT NULL,
  `Type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Notification_Type`
--

LOCK TABLES `Notification_Type` WRITE;
/*!40000 ALTER TABLE `Notification_Type` DISABLE KEYS */;
/*!40000 ALTER TABLE `Notification_Type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Organization`
--

DROP TABLE IF EXISTS `Organization`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Organization` (
  `Organization_ID` int NOT NULL,
  `Name` varchar(255) DEFAULT NULL,
  `Address` text,
  `Description` text,
  `Coordinates` varchar(255) DEFAULT NULL,
  `Type` varchar(255) DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  `Modified_Date` date DEFAULT NULL,
  PRIMARY KEY (`Organization_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Organization`
--

LOCK TABLES `Organization` WRITE;
/*!40000 ALTER TABLE `Organization` DISABLE KEYS */;
/*!40000 ALTER TABLE `Organization` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Organization_Type`
--

DROP TABLE IF EXISTS `Organization_Type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Organization_Type` (
  `ID` int NOT NULL,
  `Type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Organization_Type`
--

LOCK TABLES `Organization_Type` WRITE;
/*!40000 ALTER TABLE `Organization_Type` DISABLE KEYS */;
/*!40000 ALTER TABLE `Organization_Type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Patient`
--

DROP TABLE IF EXISTS `Patient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Patient` (
  `ID` int NOT NULL,
  `Date_of_Birth` date DEFAULT NULL,
  `Gender` varchar(50) DEFAULT NULL,
  `Emirates_ID` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Patient`
--

LOCK TABLES `Patient` WRITE;
/*!40000 ALTER TABLE `Patient` DISABLE KEYS */;
INSERT INTO `Patient` VALUES (17,'1980-01-01','Male','1234567890'),(18,'1990-02-02','Female','9876543210'),(19,'1985-03-03','Male','1357924680');
/*!40000 ALTER TABLE `Patient` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Permissions`
--

DROP TABLE IF EXISTS `Permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Permissions` (
  `ID` int NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Permissions`
--

LOCK TABLES `Permissions` WRITE;
/*!40000 ALTER TABLE `Permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `Permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Request`
--

DROP TABLE IF EXISTS `Request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Request` (
  `Request_ID` int NOT NULL,
  `Request_Type` varchar(255) DEFAULT NULL,
  `Organization_ID` int DEFAULT NULL,
  `Data_Access_ID` int DEFAULT NULL,
  `Status` varchar(255) DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  `Modified_Date` date DEFAULT NULL,
  `Approved_Date` date DEFAULT NULL,
  `Requested_To` int DEFAULT NULL,
  `Requested_By` int DEFAULT NULL,
  PRIMARY KEY (`Request_ID`),
  KEY `Request_ibfk_1` (`Requested_To`),
  KEY `Request_ibfk_2` (`Requested_By`),
  CONSTRAINT `Request_ibfk_1` FOREIGN KEY (`Requested_To`) REFERENCES `User` (`ID`),
  CONSTRAINT `Request_ibfk_2` FOREIGN KEY (`Requested_By`) REFERENCES `User` (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Request`
--

LOCK TABLES `Request` WRITE;
/*!40000 ALTER TABLE `Request` DISABLE KEYS */;
/*!40000 ALTER TABLE `Request` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Request_Status`
--

DROP TABLE IF EXISTS `Request_Status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Request_Status` (
  `ID` int NOT NULL,
  `Status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Request_Status`
--

LOCK TABLES `Request_Status` WRITE;
/*!40000 ALTER TABLE `Request_Status` DISABLE KEYS */;
/*!40000 ALTER TABLE `Request_Status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Request_Type`
--

DROP TABLE IF EXISTS `Request_Type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Request_Type` (
  `ID` int NOT NULL,
  `Type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Request_Type`
--

LOCK TABLES `Request_Type` WRITE;
/*!40000 ALTER TABLE `Request_Type` DISABLE KEYS */;
/*!40000 ALTER TABLE `Request_Type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Sys_Admin`
--

DROP TABLE IF EXISTS `Sys_Admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Sys_Admin` (
  `Organization_ID` int NOT NULL,
  PRIMARY KEY (`Organization_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Sys_Admin`
--

LOCK TABLES `Sys_Admin` WRITE;
/*!40000 ALTER TABLE `Sys_Admin` DISABLE KEYS */;
/*!40000 ALTER TABLE `Sys_Admin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Teeth_Details`
--

DROP TABLE IF EXISTS `Teeth_Details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Teeth_Details` (
  `ID` int NOT NULL,
  `Order_ID` int DEFAULT NULL,
  `Question_Type` varchar(255) DEFAULT NULL,
  `Answer` text,
  `Note` text,
  `Created_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `Order_ID` (`Order_ID`),
  CONSTRAINT `Teeth_Details_ibfk_1` FOREIGN KEY (`Order_ID`) REFERENCES `Lab_Results` (`Order_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Teeth_Details`
--

LOCK TABLES `Teeth_Details` WRITE;
/*!40000 ALTER TABLE `Teeth_Details` DISABLE KEYS */;
/*!40000 ALTER TABLE `Teeth_Details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `First_Name` varchar(255) DEFAULT NULL,
  `Last_Name` varchar(255) DEFAULT NULL,
  `Password` varchar(255) DEFAULT NULL,
  `Email` varchar(255) DEFAULT NULL,
  `Contact_Number` varchar(255) DEFAULT NULL,
  `Role_ID` int DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT NULL,
  `Last_Login_Date` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `Role_ID` (`Role_ID`),
  CONSTRAINT `User_ibfk_1` FOREIGN KEY (`Role_ID`) REFERENCES `UserRole` (`Role_ID`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User`
--

LOCK TABLES `User` WRITE;
/*!40000 ALTER TABLE `User` DISABLE KEYS */;
INSERT INTO `User` VALUES (9,'Admin2','User2','$2b$10$v5lsbuAYwdZQzZ/hN.FVL.6lYJwnZLBjfD6sW66/H8GqMXFtncwGK','admin2@gmail.com','1234567890',2,'2025-02-03',1,'2025-07-17'),(10,'Admin1','User1','$2b$10$WEDbeiz3VjsRUcgYiKhw..2oTKmGE/lxeMNV2Haqx05MlASU7/hI2','admin1@gmail.com','1234567890',2,'2025-02-03',1,'2025-07-17'),(15,'Alice','Wong','$2b$10$VDdk6Dc75k7jJp.bNsDjM.scicJoNlBJGqdzAs2b0Layd5sN1so3G','doctor1@example.com','0509876543',3,'2025-02-03',1,'2025-07-17'),(16,'Bob','Smith','$2b$10$tg8rV6u4PeIxDKy.TcoB.eIHsV3TLABYxSs3ZgPR9CHPVgFs4M42a','doctor2@example.com','0509871234',3,'2025-02-03',1,'2025-06-17'),(17,'John','Doe','$2b$10$ZJP0KFBm9N.CjOCvJX6pQOKV.3fyqyd2kyu1irqsjjEy9MZBSFgl6','john.doe@example.com','0501234567',4,'2025-03-26',1,'2025-05-08'),(18,'Jane','Doe','$2b$10$JKimR5gHhcYtI50k0FvDveM7dEsqq6s7gbmlTOh2sahbhTOabsveG','jane.doe@example.com','0507654321',4,'2025-03-26',1,NULL),(19,'Mark','Lee','$2b$10$jTozqpdqC0uSi1DNcT8VG.CY/bdUqhIvafgoN.wXJ8wkRSTjJhkz.','mark.lee@example.com','0502468135',4,'2025-03-26',1,NULL);
/*!40000 ALTER TABLE `User` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserRole`
--

DROP TABLE IF EXISTS `UserRole`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserRole` (
  `Role_ID` int NOT NULL,
  `Name` varchar(255) DEFAULT NULL,
  `Access_Level` int DEFAULT NULL,
  `IsActive` tinyint(1) DEFAULT NULL,
  `Created_Date` date DEFAULT NULL,
  `Modified_Date` date DEFAULT NULL,
  PRIMARY KEY (`Role_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserRole`
--

LOCK TABLES `UserRole` WRITE;
/*!40000 ALTER TABLE `UserRole` DISABLE KEYS */;
INSERT INTO `UserRole` VALUES (1,'Sys Admin',1,1,'2025-01-22',NULL),(2,'Admin',2,1,'2025-01-22',NULL),(3,'Doctor',3,1,'2025-01-22',NULL),(4,'Patient',4,1,'2025-01-22',NULL);
/*!40000 ALTER TABLE `UserRole` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `User_Activity_Status`
--

DROP TABLE IF EXISTS `User_Activity_Status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User_Activity_Status` (
  `ID` int NOT NULL,
  `Status` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User_Activity_Status`
--

LOCK TABLES `User_Activity_Status` WRITE;
/*!40000 ALTER TABLE `User_Activity_Status` DISABLE KEYS */;
/*!40000 ALTER TABLE `User_Activity_Status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'mydatabase'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-02  2:45:31
