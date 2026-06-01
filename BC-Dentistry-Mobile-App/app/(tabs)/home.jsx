import { SafeAreaView, View, Text, ScrollView } from 'react-native'
import React from 'react'

import { UserBar, Statstic, AppointmentsSection } from '../../components/index'

import { icons } from '../../constants'
import { StatusBar } from 'expo-status-bar'


const home = () => {
  return (
    <SafeAreaView>

      <StatusBar style='dark' />

      <View className="bg-white-off p-6 flex flex-col gap-y-8">
        <UserBar />

        <ScrollView horizontal className="flex flex-row gap-6">
          <Statstic icon={icons.greenClock} label="Completed" number="2" />
          <Statstic icon={icons.blueClock} label="Pending" number="5" />
          <Statstic icon={icons.redClock} label="Canceled" number="1" />

        </ScrollView>


        <AppointmentsSection />



      </View>
    </SafeAreaView>
  )
}

export default home