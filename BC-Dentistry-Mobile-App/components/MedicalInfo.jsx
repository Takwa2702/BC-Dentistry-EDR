import { View, Text } from 'react-native'
import React from 'react'
import Field from './Field';

const MedicalInfo = ({mdata}) => {
  console.log('sssssssss====================================');
  console.log(mdata?.medicalRecords);
  console.log('sssssss====================================');
  return (
    <View>
      <Text className="text-2xl font-bold bg-gray-200 rounded-lg p-3">Medical Info</Text>
      <View className='mb-4 p-2 gap-5'>
        <View className='flex flex-row gap-x-8'>
          <Field fieldTitle={'Allergies'} fieldText={mdata.medicalRecords[0].allergies[0].name} />
          <Field fieldTitle={'Allergies Description'} fieldText={mdata.medicalRecords[0].allergies[0].description} textClasses={'text-xl'} />
        </View>


        <View className='flex flex-row gap-x-8'>
          <Field fieldTitle={'Medication'} fieldText={mdata.medicalRecords[0].medications[0].drugName} />
          <Field fieldTitle={'Doses'} fieldText={mdata.medicalRecords[0].medications[0].doses} textClasses={'text-xl'} />
          <Field fieldTitle={'Strength'} fieldText={mdata.medicalRecords[0].medications[0].strength} textClasses={'text-xl'} />
        </View>
      </View>
    </View>
  )
}

export default MedicalInfo