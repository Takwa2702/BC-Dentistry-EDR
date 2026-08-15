import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { RequestsHeader, DataRequest, NoRequests } from '../../components';
import { fetchPatientRequests, getPatientBlockchainID, getRequestLifecycleStatus } from '../../services/apiClient';
import { useUser } from '../../Context/UserContext';

const Requests = () => {
    const { user } = useUser();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const patientID = getPatientBlockchainID(user);

    const fetchRequests = useCallback(async () => {
        if (!patientID) {
            setLoading(false);
            return;
        }

        try {
            const list = await fetchPatientRequests(patientID);

            if (list.length > 0) {
                setRequests(list.filter((request) => getRequestLifecycleStatus(request) === 'PENDING_PATIENT_CONSENT'));
            } else {
                setRequests([]);
            }
        } catch (error) {
            console.error("API Error:", error.response?.data || error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [patientID]);

    useFocusEffect(
        useCallback(() => {
            fetchRequests();
        }, [fetchRequests])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchRequests();
    }, [fetchRequests]);

    const handleStatusChange = (requestId, newStatus) => {
        if (newStatus !== 'PENDING_PATIENT_CONSENT') {
            setRequests((prev) => prev.filter((r) => r.requestID !== requestId));
        }
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar style='light' />
            <RequestsHeader requests={requests} />
            <ScrollView
                className='px-8 flex flex-col gap-y-8 h-[60vh]'
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} tintColor="#1E3A8A" />
                }
            >
                <View className="flex flex-col gap-6 py-10">
                    {loading ? (
                        <Text className="text-center text-gray-500">Loading requests...</Text>
                    ) : !patientID ? (
                        <NoRequests text={"Unable to load your data. Patient account ID is missing."} />
                    ) : requests.length === 0 ? (
                        <NoRequests text={"All done, you don't have any pending requests!"} />
                    ) : (
                        requests.filter((request) => getRequestLifecycleStatus(request) === 'PENDING_PATIENT_CONSENT').map((request) => (
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
                                onStatusChange={handleStatusChange}
                            />
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

export default Requests;
