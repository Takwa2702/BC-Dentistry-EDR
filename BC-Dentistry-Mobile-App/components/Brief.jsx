import { View, Text } from 'react-native'
import React from 'react'

import CustomExpandable from "./CustomExpandable"
import { icons } from '../constants'
import { useRouter } from 'expo-router'

const Brief = ({ name, id }) => {
  const route = useRouter();
  const initial = (name?.[0] || 'P').toUpperCase();

  return (
    <View className='gap-y-7 rounded-lg'>
        <View className='header w-full flex flex-row gap-x-6 items-center'>
            <View className="w-20 h-20 bg-blue-900 rounded-[1.5rem] items-center justify-center">
              <Text className="text-white text-3xl font-bold">{initial}</Text>
            </View>
            <View className='flex gap-y-1 justify-center flex-1'>
                <Text className='text-3xl font-bold text-gray-900' numberOfLines={1}>{name}</Text>
                <Text className='text-lg text-gray-600 font-medium'>ID: {id}</Text>
            </View>
        </View>
        
        <View className='gap-4'>
            <View className='flex w-full overflow-hidden justify-between flex-row gap-4'>
                <CustomExpandable
                    handlePress={() => {route.push('/proceedRequests')}}
                    icon={icons.Approve}
                    bgColor={'green-600'}
                    textColor={'white'}
                    text={'Approved Requests'}
                    containerClasses={'flex-col justify-between grow h-28'}
                    textClasses={'w-32'}
                />
                <CustomExpandable
                    handlePress={() => {route.push('/rejectedRequests')}}
                    icon={icons.Reject}
                    bgColor={'red-600'}
                    textColor={'white'}
                    text={'Rejected Requests'}
                    containerClasses={'flex-col justify-between grow h-28'}
                    textClasses={'w-32'}
                />
            </View>

            <CustomExpandable
                handlePress={() => {route.push('/documents')}}
                icon={icons.Attachment}
                bgColor={'blue-950'}
                textColor={'white'}
                text={'Documents'}
                containerClasses={'h-16 items-center flex-row gap-x-4'}
                textClasses={'text-lg'}
            />

            <CustomExpandable
                handlePress={() => {route.push('/auditHistory')}}
                icon={icons.blueClock}
                bgColor={'blue-900'}
                textColor={'white'}
                text={'Access Audit History'}
                containerClasses={'h-16 items-center flex-row gap-x-4'}
                textClasses={'text-lg'}
            />
        </View>
    </View>
  )
}

export default Brief;
