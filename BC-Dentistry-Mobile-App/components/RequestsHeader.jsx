import { View, Text } from 'react-native'
import React from 'react'

const RequestsHeader = ({requests}) => {
  return (
    <View>
        <View className="bg-blue-950 px-8 pb-8 pt-[14%] rounded-b-[2rem]">
            <Text className="text-white font-medium text-2xl mb-5">Requests</Text>

            <View className="flex flex-row gap-x-4 p-6 bg-white rounded-3xl">
              <Text className="text-black text-8xl font-extrabold h-[5rem] min-w-16 w-16 text-center">{requests.filter((request) => request.status == 'PENDING_PATIENT_CONSENT').length}</Text>
              <Text className="text-black w-48 text-justify">data requests waiting for your consent</Text>
            </View>

        </View>

    </View>
  )
}

export default RequestsHeader