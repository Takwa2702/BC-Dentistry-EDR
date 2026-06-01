import { View, Text, Image } from 'react-native'
import React from 'react'
import { Tabs } from 'expo-router'

import { icons } from '../../constants'

const TabIcon = ({icon, color, name, focused}) => {
  return (
    <View className="w-16 h-16 flex flex-r gap-2 items-center justify-center">
      <Image
        source={icon}
        resizeMode='contain'
        tintColor={color}
        className="w-6 h-6 "
      />

      <Text className={`${focused? "font-bold" : "font-medium"} text-xs`}>
        {name}
      </Text>




    </View>
  )
}



const tabsLayout = () => {
  return (
    <Tabs screenOptions={{
      tabBarShowLabel: false ,
      tabBarStyle: {
        height: 85,
        paddingTop: 16
      },
      tabBarItemStyle: {
        alignItems: 'center',
        justifyContent: 'center',

      }


      }}>
       <Tabs.Screen
        name='home'
        options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icons.Home}
                color={color}
                name="Home"
                focused={focused}
              />
            )  
        }}
       /> 
       <Tabs.Screen
        name='requests'
        options={{
            title: 'Requests',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icons.Pending}
                color={color}
                name="Requests"
                focused={focused}
              />
            )  
        }}
       /> 
       {/* <Tabs.Screen
        name='appointments'
        options={{
            title: 'Appointments',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icons.Appointments}
                color={color}
                name="Dates"
                focused={focused}
              />
            )  
        }}
       />  */}
       <Tabs.Screen
        name='settings'
        options={{
            title: 'Settings',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icons.Personal}
                color={color}
                name="Info"
                focused={focused}
              />
            )  
        }}
       /> 
    </Tabs>
  )
}

export default tabsLayout