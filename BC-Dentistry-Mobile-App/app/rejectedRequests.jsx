import { View, Text, ScrollView, SafeAreaView } from 'react-native'
import React, { useEffect, useState } from 'react'

import { DataRequest, NoRequests } from '../components'
import axios from 'axios';
import { authHeaders, blockchainUrl, getPatientBlockchainID } from '../utils/api';
import { useUser } from '../Context/UserContext';


const rejectedRequests = () => {

  const [reqests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const { user, token } = useUser()
  const patientID = getPatientBlockchainID(user)


  useEffect(() => {
    if (!token || !patientID) {
      return
    }

    axios.get(blockchainUrl(`/getAllRequestsForPatient/${patientID}`), {
      headers: authHeaders(token),
    })
    .then((response)=> {
      setRequests(response.data?.data || response.data || [])
      setIsLoading(true)
    })
    .finally(() => {
      setIsLoading(false)
    })

  }, [token, patientID])





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
                        about={request.rejectionReason || request.purpose || request.reason || "N/A"}
                        date={request.rejectedAt ? request.rejectedAt.slice(0, 10) : "N/A"}
                        time={request.rejectedAt ? request.rejectedAt.slice(11, 16) : "N/A"}
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
