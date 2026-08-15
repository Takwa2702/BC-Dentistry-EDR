import { View, Text, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native'
import React, { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'

import { DataRequest, NoRequests } from '../components'
import { fetchPatientRequests, getPatientBlockchainID, getRequestLifecycleStatus } from '../services/apiClient';
import { useUser } from '../Context/UserContext';

const RejectedRequests = () => {
  const { user } = useUser();
  const [reqests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const patientID = getPatientBlockchainID(user);

  const fetchRequests = useCallback(async () => {
    if (!patientID) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setFetchError('');
    try {
      setRequests(await fetchPatientRequests(patientID));
    } catch (error) {
      console.error("[RejectedRequests] Error:", error.message);
      setFetchError(error.response?.data?.error?.message || error.message || 'Unable to load rejected requests.');
    } finally {
      setIsLoading(false);
    }
  }, [patientID]);

  useFocusEffect(useCallback(() => {
    fetchRequests();
  }, [fetchRequests]));

  const rejectedList = reqests.filter((request) => ['REQUEST_REJECTED', 'REJECTED'].includes(getRequestLifecycleStatus(request)));

  return (
    <SafeAreaView className="bg-white flex-1">
      <View className='flex flex-col gap-4 p-6'>
        <View>
          <Text className='text-2xl font-semibold'>Rejected Requests</Text>
          <Text className='text-lg font-light leading-6 text-gray-500'>
            Here you can find all the data access requests you have declined.
          </Text>
        </View>

        <ScrollView className='pb-4 h-[82vh]'>
          <View className="flex flex-col gap-y-4">
            {
              isLoading ? (
                <ActivityIndicator size="large" color="#1E3A8A" className="mt-8" />
              ) : !patientID ? (
                <NoRequests text={"Unable to load your data. Patient account ID is missing."} />
              ) : fetchError ? (
                <NoRequests text={fetchError} />
              ) : rejectedList.length === 0 ? (
                <NoRequests text={"No rejected requests found."} />
              ) : (
                rejectedList.map((request) => {
                  return (
                    <DataRequest
                      key={request.requestID}
                      type={request.type || "on-chain"}
                      doctorName={request.doctorName || 'Requesting doctor'}
                      clinicName={request.requestingClinicName || request.doctorClinicName || 'Clinic unavailable'}
                      to={request.patientID}
                      status={getRequestLifecycleStatus(request)}
                      id={request.requestID}
                      about={request.about || "N/A"}
                      requestedAt={request.requestedAt}
                      optionsVisible={false}
                    />
                  )
                })
              )
            }
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

export default RejectedRequests;
