import { View } from 'react-native'
import React from 'react'

import MedicalInfo from './MedicalInfo'
import PersonalInfo from './PersonalInfo'

const Information = ({ data }) => {
  return (
    <View className="gap-y-6">
      <PersonalInfo pdata={data} />
      <MedicalInfo mdata={data} />
    </View>
  )
}

export default Information