import { View, Text, Animated, Image } from 'react-native'
import React, { useRef } from 'react'

import { icons } from '../constants'

const StatusUpdateLoading = ({reff, status, requestLoadingStatus, setrequestLoadingFunc}) => {


  const animatedHeight = useRef(new Animated.Value(0)).current


  if(!requestLoadingStatus){
    Animated.timing(animatedHeight, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false
    }).start(() => setrequestLoadingFunc(false))
  }
  else{
    setrequestLoadingFunc(true)
    Animated.timing(animatedHeight, {
      toValue: 460,
      duration: 300,
      useNativeDriver: false
    }).start()
    
  }


  return (
    <Animated.View style={{ height: animatedHeight ,overflow: 'hidden'}} ref={reff} className={`bg-white ${status} p-8 flex items-center justify-center gap-4 w-full absolute left-0 top-0 z-50 overflow-hidden`}>
        <View className={`rounded-full`}>
          <Image source={require('../assets/images/icons/gear.gif')} resizeMode='contain' className='w-10 h-10' />
        </View>
        <Text>Updating your request Status...</Text>
    </Animated.View>
  )
}

export default StatusUpdateLoading