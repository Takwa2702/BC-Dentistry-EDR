import { View, Text, Image, TouchableOpacity } from 'react-native'
import React from 'react'

const COLOR_MAP = {
  'green-600': 'bg-green-600',
  'red-600': 'bg-red-600',
  'blue-950': 'bg-blue-950',
  'blue-900': 'bg-blue-900',
  'purple-900': 'bg-purple-900',
};

const CustomExpandable = ({ bgColor = 'blue-900', textColor = 'white', icon, text, handlePress, containerClasses = '', textClasses = '' }) => {
  const bgClass = COLOR_MAP[bgColor] || (bgColor.startsWith('bg-') ? bgColor : `bg-${bgColor}`);

  return (
    <TouchableOpacity onPress={handlePress} className={`flex rounded-xl p-4 ${bgClass} ${containerClasses}`}>
        <View>
            {icon ? <Image source={icon} tintColor={'white'} resizeMode='contain' className='w-7 h-7' /> : null}
        </View>
        <View className=''>
            <Text className={`text-${textColor} text-md ${textClasses}`}>{text}</Text>
        </View>
    </TouchableOpacity>
  )
}

export default CustomExpandable