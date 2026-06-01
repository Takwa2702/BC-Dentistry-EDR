import { View, Text, Image, Alert } from 'react-native'
import React, { useEffect } from 'react'

import { icons } from "../constants"

import { useUser } from '../Context/UserContext'



const UserBar = () => {

  const { user } = useUser()

  useEffect(() => {

    console.log('----the is the user----');
    console.log(user?.email);
    console.log('----the is the user----');
    

  }, [])

  return (
    <View className="w-full h-16 z-50 flex flex-row justify-between items-center ">
      <View className='flex flex-row gap-4'>

        <View className="w-16 h-16 bg-gray-300 rounded-xl">
          {false && <Image source={icons.Logo} resizeMode='contain' className="w-full h-full" />}
        </View>

        <View className="">
          <Text className="leading- m-0 text-gray-900 font-light text-xl">Hello,</Text>
          <Text className="leading- m-0 text-gray-900 font-bold text-3xl">{`${user.firstName}, ${user.lastName}`} !</Text>
        </View>



      </View>


      <View>
        <Image source={icons.Bell} resizeMode='contain' className="w-6 h-6"/>
      </View>

    </View>
  )
}

export default UserBar