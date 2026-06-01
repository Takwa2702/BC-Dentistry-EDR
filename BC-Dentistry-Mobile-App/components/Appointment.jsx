import { View, Text, Image, TouchableOpacity } from 'react-native'
import React from 'react'

import { icons } from '../constants'

const Appointment = ({date, time, dr}) => {
  return (
    <View className="bg-white flex flex-col gap-y-4 p-4 rounded-2xl">
      <View id='AppointmentDetails' className="flex flex-row justify-between items-center">
        <View className="flex flex-row items-center gap-x-3">
            <Image source={icons.time} resizeMode='contain' className="w-6 h-6" />
            <View>
                <Text>{date}</Text>
                <Text>{time}</Text>
            </View>

        </View>
        <TouchableOpacity>
            <Image source={icons.options} resizeMode='contain' className="w-4 h-4" />
        </TouchableOpacity>
      </View>
      

      
      <View id='DrDetails' className="flex flex-row gap-x-3 border-t border-gray-400 pt-4">
        <View className="w-12 h-12 bg-gray-300 rounded-lg">
            <Image source={""} resizeMode='contain' />
        </View>

        <View className=" ">
            <Text className="text-xl font-bold leading-6">{`Dr. ${dr.name}`}</Text>
            <Text className="text-gray-400">{dr.specialization}</Text>
        </View>
        

      </View>





    </View>
  )
}

export default Appointment