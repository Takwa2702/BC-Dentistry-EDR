import { View, Text } from 'react-native'
import React from 'react'

const PageHeader = ({headerText}) => {
  return (
    <View className='w-11/12 border-b p-2'>
        <Text className='text-xl text-center'>{headerText}</Text>
    </View>
  )
}

export default PageHeader