import { View, Text } from 'react-native'
import React from 'react'

const NoRequests = ({text}) => {
  return (
    <View className='p-8 flex flex-col items-center rounded-2xl border-[0.5px] bg-gray-50 border-gray-300'>
      <Text className='text-8xl font-black text-gray-400 leading-[3rem]'>...</Text>
      <Text className=' text-gray-400'>{text}</Text>
    </View>
  )
}

export default NoRequests