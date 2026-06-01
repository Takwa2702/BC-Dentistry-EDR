import { View, Text, Image } from 'react-native'
import React from 'react'

import { icons } from '../constants'

const Document = ({title, type, size, content}) => {
  return (
    <View className="flex flex-row gap-x-4 w-full min-h-20 rounded-2xl items-center bg-gray-50 border border-gray-300 px-5 py-4">
      <Image source={type == 'pdf' ? icons.Document : type == 'jpeg' || type == 'jpg' ? icons.ImageIcon : type == 'dicom' ? icons.DicomIcon : ''} resizeMode='contain' className='w-10 h-10 ' />
        
      <View className="flex flex-row items-center justify-between grow">
        <View>
            <Text className='text-xl font-semibold'>{title}</Text>
            <View className='flex flex-row'>
                <Text className='text-sm font-thing'>{type}</Text>
                <Text className='text-sm font-thing'> - </Text>
                <Text className='text-sm font-thing'>{size}</Text>
            </View>
        </View>
        <Image source={icons.Download} resizeMode='contain' className='w-7 h-7 ' />

      </View>
    </View>
  )
}

export default Document