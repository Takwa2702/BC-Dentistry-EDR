import { View, Text, TextInput, Image, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'

import { icons } from '../constants'


const CustomInput = ({label, type, value, placeHolder, inputStyle, handleChange}) => {

  const [showPassword, setShowPassword] = useState(false)


  return (
    <View className="flex gap-y-1">

        <Text className="text-white text-md">{label}</Text>

        <View className="border rounded-xl p-4 flex flex-row items-center justify-between bg-[rgba(37,42,67,1)] min-h-14">
          <TextInput
              className={` text-white grow h-full text-lg leading-5  ${inputStyle}`}
              value={value}
              placeholderTextColor="grey"
              placeholder={placeHolder}
              onChangeText={handleChange}
              secureTextEntry={type== 'password' ? !showPassword: showPassword}
          />


          {
            label == "Password" && 
            <TouchableOpacity className=" " onPress={() => {setShowPassword(password => !password)}}>
              <Image resizeMode='contain' className="w-6 h-6" source={showPassword? icons.Eye : icons.EyeHide} />
            </TouchableOpacity>
          }        

        </View>

          


    </View>
  )
}

export default CustomInput