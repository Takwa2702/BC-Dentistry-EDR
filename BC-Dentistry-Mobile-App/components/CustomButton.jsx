import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';

const CustomButton = ({
  reff,
  text,
  classes = '',
  textClasses = 'text-white text-center text-xl font-bold',
  containerClasses = 'bg-blue-800 px-8 py-4 my-4 rounded-2xl',
  style = '',
  disabled = false,
  handleClick,
}) => {
  return (
    <TouchableOpacity
      ref={reff}
      className={classes}
      onPress={handleClick}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View className={`${containerClasses} ${style}`}>
        <Text className={textClasses}>{text}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default CustomButton;