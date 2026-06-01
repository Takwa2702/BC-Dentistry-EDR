import { View, Text, Image } from 'react-native'
import React from 'react'

const Statstic = ({label, number, style, icon}) => {
  return (
    <View className="bg-white flex flex-col gap-y-3 w-40 p-5 mr-4 rounded-2xl">
        <View className="flex flex-row justify-between items-end">
            <Text className="text-5xl font-bold">{number}</Text>
            <View className="border-gray-300 border-[0.5px] rounded-lg w-14 h-14 items-center justify-center">
                <Image source={icon} resizeMode='cover' className="w-8 h-8" />
            </View>
        </View>
        <Text className="text-lg">{label}</Text>
    </View>
  )
}

export default Statstic