import { View, Text } from 'react-native'
import { Stack } from "expo-router"
import React from 'react'

const authLayout = () => {
  return (
    <Stack screenOptions={{
        headerShown: false
    }}>

        <Stack.Screen
            name='sign-in'
            options={{
                headerShown: false
            }}
        />
        <Stack.Screen
            name='sign-up'
            options={{
                headerShown: false
            }}
        />

    </Stack>
  )
}

export default authLayout