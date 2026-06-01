import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'

const CustomButton = ({reff, text, classes, textClasses, containerClasses, handleClick}) => {
  return (
    <TouchableOpacity ref={reff} className={classes} onPress={handleClick}>
        <View className={containerClasses}>
            <Text className={textClasses}>{text}</Text>
        </View>

    </TouchableOpacity>
  )
}

export default CustomButton