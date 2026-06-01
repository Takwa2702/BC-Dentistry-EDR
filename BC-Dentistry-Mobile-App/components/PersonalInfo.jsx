import { View, Text } from 'react-native'
import React from 'react'
import {Field} from './index'

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

const personalTags = {
    'emiratesID':"Emirates Id",
    'firstName':"First Name",
    'lastName':"Last Name",
    'dateOfBirth':"Birth Data",
    'address':"Address",
    'contactNumber':"Mobile Phone",
    'email':"Email address",
    'gender':"Gender",
}

const sortedDetails = {
    'Emirates Id': "",
    'First Name': "",
    'Last Name': "",
    'Birth Data': "",
    'Address': "",
    'Mobile Phone': "",
    'Email address': "",
    'Gender': "",
}




const PersonalInfo = ({pdata}) => {

    const getPatient = (id) => {
        return (
            pdata?.filter((patient) => {return patient.emiratesID == id})
        )
    }
    


    return (
    <View className='flex flex-col gap-2'>
        <Text className="text-2xl font-bold bg-gray-200 rounded-lg p-3">Personal Info</Text>
        <View className='mb-4 p-2 gap-5'>

            {
                Object.entries(getPatient(pdata[0].emiratesID)[0]).map((data, i) => {
                    if(Object.keys(personalTags).includes(data[0])){
                        return (
                            <Field key={i} fieldTitle={personalTags[data[0]]} fieldText={typeof data[1] == 'string' ? data[1] : typeof data[1] == 'number' ? data[1] : ""} />
                        )

                    }
                })
            }


        </View>
    </View>
  )
}

export default PersonalInfo