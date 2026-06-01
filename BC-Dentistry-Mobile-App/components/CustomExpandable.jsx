import { View, Text, Image, TouchableOpacity } from 'react-native'
import React from 'react'

import { icons } from '../constants'

const CustomExpandable = ({bgColor, textColor, icon, text, handlePress, containerClasses, textClasses}) => {
  return (

    <TouchableOpacity onPress={handlePress} className={`flex rounded-xl p-4 bg-${bgColor} ${containerClasses}`}>
        <View>
            <Image source={icon} tintColor={'white'} resizeMode='contain' className='w-7 h-7' />
        </View>
        <View className=''>
            <Text className={`text-${textColor} text-md ${textClasses}`}>{text}</Text>
        </View>
    </TouchableOpacity>
  )
}

export default CustomExpandable