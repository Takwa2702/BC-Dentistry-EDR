import { View, Text, Animated, Image } from 'react-native';
import React, { useRef, useEffect } from 'react';

const StatusUpdateLoading = ({ reff, status, requestLoadingStatus }) => {
  const animatedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (requestLoadingStatus) {
      Animated.timing(animatedHeight, {
        toValue: 460,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(animatedHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [requestLoadingStatus]);

  return (
    <Animated.View
      style={{ height: animatedHeight, overflow: 'hidden' }}
      ref={reff}
      className="bg-white p-8 flex items-center justify-center gap-4 w-full absolute left-0 top-0 z-50 overflow-hidden"
    >
      <View className="rounded-full">
        <Image
          source={require('../assets/images/icons/gear.gif')}
          resizeMode="contain"
          className="w-10 h-10"
        />
      </View>
      <Text className="text-lg font-semibold text-gray-800">Updating your request status...</Text>
    </Animated.View>
  );
};

export default StatusUpdateLoading;