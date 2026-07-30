import { View, Text, ScrollView, SafeAreaView, Alert, TouchableOpacity } from 'react-native'
import React, { useEffect, useState } from 'react'

import { DataRequest, NoRequests } from '../components'
import axios from 'axios';
import { authHeaders, blockchainUrl, getPatientBlockchainID } from '../utils/api';
import { useUser } from '../Context/UserContext';

const ProceedRequests = () => {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const { user, token } = useUser()
  const patientID = getPatientBlockchainID(user)

  const loadRequests = () => {
    if (!token || !patientID) return

    setIsLoading(true)
    axios.get(blockchainUrl(`/getAllRequestsForPatient/${patientID}`), {
      headers: authHeaders(token),
    })
    .then((response) => {
      setRequests(response.data?.data || response.data || [])
    })
    .finally(() => {
      setIsLoading(false)
    })
  }

  useEffect(() => {
    loadRequests()
  }, [token, patientID])

  const revokeConsent = async (requestID) => {
    try {
      await axios.post(blockchainUrl('/patient/revokeConsent'), {
        patientID,
        requestID,
        revocationReason: 'Revoked from patient mobile app',
      }, {
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      })
      Alert.alert('Consent revoked', 'The doctor can no longer access this request through consent.')
      loadRequests()
    } catch (error) {
      Alert.alert('Unable to revoke consent', error.response?.data?.error?.message || error.message)
    }
  }

  const grantedRequests = requests.filter((request) => request.status === 'CONSENT_GRANTED')

  return (
    <SafeAreaView>
      <View className='flex flex-col gap-4 p-6'>
        <View>
          <Text className='text-2xl font-semibold'>Approved Requests</Text>
          <Text className='text-lg font-light leading-2x'>Here you can review and revoke data-sharing consent you have granted.</Text>
        </View>

        <ScrollView className='pb-4 h-[82vh]'>
          <View className="flex flex-col gap-y-4">
            {isLoading && <View><Text>Loading requests...</Text></View>}

            {!isLoading && grantedRequests.length === 0 && (
              <NoRequests text={"You have not granted consent for any requests."} />
            )}

            {!isLoading && grantedRequests.map((request) => (
              <View key={request.requestID} className="flex flex-col gap-y-2">
                <DataRequest
                  type={request.type || "on-chain"}
                  from={request.doctorID}
                  to={request.patientID}
                  status={request.status}
                  id={request.requestID}
                  about={request.purpose || request.reason || request.dataType || "N/A"}
                  date={request.requestedAt ? request.requestedAt.slice(0, 10) : "N/A"}
                  time={request.requestedAt ? request.requestedAt.slice(11, 16) : "N/A"}
                  optionsVisible={false}
                />
                <TouchableOpacity className="bg-red-600 rounded-xl p-3" onPress={() => revokeConsent(request.requestID)}>
                  <Text className="text-center text-white font-semibold">Revoke Consent</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

export default ProceedRequests
