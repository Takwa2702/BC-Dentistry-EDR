import { View, Text } from 'react-native'
import React from 'react'
import Field from './Field'

const PersonalInfo = ({ pdata }) => {
  const user = Array.isArray(pdata) ? pdata[0] : pdata;

  return (
    <View className="flex flex-col gap-2">
      <Text className="text-2xl font-bold bg-gray-200 rounded-lg p-3">Personal Info</Text>
      <View className="mb-4 p-2 gap-5">
        <Field fieldTitle="First Name" fieldText={user?.firstName || 'Not provided'} />
        <Field fieldTitle="Last Name" fieldText={user?.lastName || 'Not provided'} />
        <Field fieldTitle="Emirates ID" fieldText={user?.emiratesID || 'Not provided'} />
        <Field fieldTitle="Email" fieldText={user?.email || 'Not provided'} />
        <Field fieldTitle="Mobile Phone" fieldText={user?.contactNumber || 'Not provided'} />
        <Field fieldTitle="Birth Date" fieldText={user?.dateOfBirth || 'Not provided'} />
        <Field fieldTitle="Gender" fieldText={user?.gender || 'Not provided'} />
        <Field fieldTitle="Nationality" fieldText={user?.nationality || 'Not provided'} />
        <Field fieldTitle="Address" fieldText={user?.address || 'Not provided'} />
      </View>
    </View>
  )
}

export default PersonalInfo
