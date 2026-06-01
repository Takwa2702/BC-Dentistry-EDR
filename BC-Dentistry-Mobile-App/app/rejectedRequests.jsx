import { View, Text, ScrollView, SafeAreaView } from 'react-native'
import React, { useEffect, useState } from 'react'

import { DataRequest, NoRequests } from '../components'
import axios from 'axios';

const API_BASE_URL = 'http://openuae.fortiddns.com:28081'; 


const rejectedRequests = () => {

  const [reqests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(false)


  useEffect(() => {
    axios.get(`${API_BASE_URL}/getAllRequestsForPatient/Patient1`)
    .then((response)=> {
      setRequests(response.data)
      setIsLoading(true)
    })
    .finally(() => {
      setIsLoading(false)
    })



  }, [])





  return (
    <SafeAreaView>
        <View className='flex flex-col gap-4 p-6'>
          <View>
            <Text className='text-2xl font-semibold mb-2'>Rejected Requests</Text>
            <Text className='text-lg font-light text-justify leading-6'>here you can find all the request that you rejected to share your data with</Text>
          </View>

          <ScrollView className='pb-4 h-[82vh]'>
            <View className="flex flex-col gap-y-4">
              {
                isLoading && <View><Text>it is loading</Text></View>
              }

              {
                !isLoading && reqests.filter((request)=>request.status == 'REJECTED').map((request) => {
                  return (
                    <DataRequest
                        key={request.requestID}  // Use API ID
                        type={request.type || "on-chain"}  
                        from={request.doctorID}
                        to={request.patientID}
                        status={request.status}
                        id={request.requestID}
                        about={request.about || "N/A"}
                        date={request.date || "N/A"}
                        time={request.time || "N/A"}
                        optionsVisible={false}
                    />
                  )
                })
              }

              {
                isLoading && <NoRequests text={"You didn't reject and data requests"} />
              }





            </View>
               
          </ScrollView>
        </View>


    </SafeAreaView>
  )
}

export default rejectedRequests