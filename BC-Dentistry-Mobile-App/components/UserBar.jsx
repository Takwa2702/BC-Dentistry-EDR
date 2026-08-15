import { View, Text, Image, TouchableOpacity } from 'react-native'
import React from 'react'
import { useRouter } from 'expo-router'
import { icons } from "../constants"
import { useUser } from '../Context/UserContext'

const UserBar = () => {
  const { user } = useUser();
  const router = useRouter();

  return (
    <View className="w-full h-16 z-50 flex flex-row justify-between items-center ">
      <View className='flex flex-row gap-4 items-center'>
        <View className="w-14 h-14 bg-blue-900 rounded-xl items-center justify-center">
          <Text className="text-white text-2xl font-bold">
            {(user?.firstName?.[0] || user?.name?.[0] || 'P').toUpperCase()}
          </Text>
        </View>

        <View className="">
          <Text className="text-gray-600 font-light text-lg">Hello,</Text>
          <Text className="text-gray-900 font-bold text-2xl">{`${user?.firstName || user?.name || 'Patient'}`}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => router.push('/notifications')}
        className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center border border-gray-200"
        activeOpacity={0.7}
      >
        <Image source={icons.Bell} resizeMode='contain' className="w-6 h-6" />
      </TouchableOpacity>
    </View>
  )
}

export default UserBar