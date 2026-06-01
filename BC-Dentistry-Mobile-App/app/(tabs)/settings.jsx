import { SafeAreaView, View, Text } from 'react-native'
import { Brief, Information, PageHeader } from '../../components'


const sample = [{
  "address": "123 Main Street, Dubai",
  "clinicIDs": [
    2
  ],
  "contactNumber": "0501234567",
  "createdDate": "2025-03-13T07:07:01.374Z",
  "dateOfBirth": "1980-01-01",
  "dentalChart": [
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 1, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "1",
      "Status": "E",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 2, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "2",
      "Status": "E",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 3, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "3",
      "Status": "E",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 4, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "4",
      "Status": "E",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 5, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "5",
      "Status": "E",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 6, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "6",
      "Status": "E",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 7, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "7",
      "Status": "C",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 8, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "8",
      "Status": "C",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 9, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "9",
      "Status": "C",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 10, requires filling.",
      "Phase": "10",
      "Pre_Auth": "approved",
      "Site": "9",
      "Status": "C",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 11, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "11",
      "Status": "C",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 12, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "12",
      "Status": "C",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 13, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "13",
      "Status": "C",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    },
    {
      "Audit_Date": "2024-10-04",
      "Category": "Restorative",
      "Code": "R123",
      "Created_Date": "2024-10-01",
      "Diagnoses": "Cavity",
      "Discipline": "General Dentistry",
      "Doctor_ID": 101,
      "Estimate": 200,
      "ID": 1,
      "Notes": "Small cavity on molar 14, requires filling.",
      "Phase": "1",
      "Pre_Auth": "approved",
      "Site": "14",
      "Status": "C",
      "Sub_Category": "Filling",
      "Suf": "MODBL"
    }
  ],
  "docType": "patient",
  "doctors": [
    "Doctor2"
  ],
  "email": "john.doe@example.com",
  "emiratesID": "1234567890",
  "firstName": "John",
  "gender": "Male",
  "lastName": "Doe",
  "medicalRecords": [
    {
      "allergies": [
        {
          "allergyId": "A001",
          "description": "Allergic reaction to peanuts, causing potential anaphylaxis.",
          "name": "Peanuts"
        }
      ],
      "medications": [
        {
          "doses": "81 mg daily",
          "drugName": "Aspirin",
          "frequency": 5,
          "intakeTime": "Morning",
          "medicationId": "11111113",
          "strength": "81",
          "type": "Antiplatelet"
        }
      ]
    }
  ],
  "patientID": "Patient1",
  "role": "patient",
  "sharedWith": [
    "Doctor2",
    "Doctor1"
  ]
}]


import { useUser } from '../../Context/UserContext'


import React, { useEffect } from 'react'

const settings = () => {

  const { user } = useUser()



  useEffect(() => {
    console.log('====================================');
    console.log(user);
    console.log('==================================== from settings page');
    
  }, [])




  return (
    <SafeAreaView>
      <View className='flex flex-col items-center'>
        
        <PageHeader headerText={'Info'} />


        <View className='bg-white-off p-6 flex flex-col gap-y-8'>
          <Brief name={`${user?.firstName} ${user?.lastName}`} id={user.emiratesID} />
          
          <Information data={user} />
           
        </View>

      </View>
    </SafeAreaView>
  )
}

export default settings