import { View, Text } from 'react-native'
import React from 'react'

const Field = ({fieldTitle, fieldText, titleClasses, textClasses}) => {
  return (
    <View>
        <Text className={`text-lg ${titleClasses}`}>{fieldTitle}</Text>
        <Text className={`text-2xl font-semibold ${textClasses}`}>{fieldText}</Text>
    </View>
  )
}

export default Field