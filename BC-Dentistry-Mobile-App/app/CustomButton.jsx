import { View, Text, TouchableOpacity  } from 'react-native'
import React from 'react'

const CustomButton = ({text, handleClick, style}) => {
  return (
      <TouchableOpacity onPress={handleClick}>
        <View className={`bg-blue-800 px-8 py-4 my-4 rounded-2xl ${style}`}>
            <Text className='text-white text-center text-xl font-bold'>{text}</Text>
        </View>
      </TouchableOpacity>
  )
}

export default CustomButton