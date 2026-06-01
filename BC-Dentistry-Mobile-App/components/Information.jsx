import { View, Text, ScrollView } from 'react-native'
import React from 'react'

import { MedicalInfo, PersonalInfo } from './index'

const Information = ({data}) => {
  return (
    <ScrollView className='gap-y-8 max-h-[40vh]'>
        <PersonalInfo pdata={[data]} />
        <MedicalInfo mdata={data} />
    </ScrollView>
  )
}

export default Information