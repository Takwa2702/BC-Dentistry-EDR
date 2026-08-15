import { View, Text, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native'
import React, { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'

import { DataRequest, NoRequests } from '../components'
import { fetchPatientRequests, getPatientBlockchainID, getRequestLifecycleStatus } from '../services/apiClient';
import { useUser } from '../Context/UserContext';

const ProceedRequests = () => {
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
      console.error("[ProceedRequests] Error:", error.message);
      setFetchError(error.response?.data?.error?.message || error.message || 'Unable to load approved requests.');
    } finally {
      setIsLoading(false);
    }
  }, [patientID]);

  useFocusEffect(useCallback(() => {
    fetchRequests();
  }, [fetchRequests]));

  const handleStatusChange = (requestId, newStatus) => {
    if (newStatus === 'REVOKED' || newStatus === 'REJECTED') {
      setRequests((prev) => prev.filter((r) => r.requestID !== requestId));
    }
  };

  const activeGrantedRequests = reqests.filter((request) => getRequestLifecycleStatus(request) === 'ACTIVE');

  return (
    <SafeAreaView className="bg-white flex-1">
      <View className='flex flex-col gap-4 p-6'>
        <View>
          <Text className='text-2xl font-semibold'>Approved Requests</Text>
          <Text className='text-lg font-light leading-6 text-gray-500'>
            Here you can find all the requests that you have agreed to share information for.
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
              ) : activeGrantedRequests.length === 0 ? (
                <NoRequests text={"You haven't approved any active data requests yet."} />
              ) : (
                activeGrantedRequests.map((request) => {
                  return (
                    <DataRequest
                      key={request.requestID}
                      type={request.type || "on-chain"}
                      doctorName={request.doctorName || 'Requesting doctor'}
                      clinicName={request.requestingClinicName || request.doctorClinicName || 'Clinic unavailable'}
                      to={request.patientID}
                      status={getRequestLifecycleStatus(request)}
                      id={request.requestID}
                      about={request.purpose || request.reason || request.dataType || request.about || "N/A"}
                      requestedAt={request.requestedAt}
                      optionsVisible={false}
                      showRevoke={true}
                      onStatusChange={handleStatusChange}
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

export default ProceedRequests;
