import { View, Text, SafeAreaView, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { RequestsHeader, DataRequest, NoRequests } from '../../components';

const API_BASE_URL = 'http://openuae.fortiddns.com:28081'; 

import { useUser } from '../../Context/UserContext';


const Requests = () => {

    const { user } = useUser()


    // useEffect(() => {
    //     console.log('====================================');
    //     console.log(user);
    //     console.log('====================================');
    // }, [])





    const [requests, setRequests] = useState([]); // Store API response
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/getAllRequestsForPatient/Patient1`);
                // console.log("Fetched Requests:", response.data);
                
                if (response.data.length > 0) {
                    setRequests(response.data.filter((request) => request.status == 'PENDING_PATIENT_CONSENT'));
                } else {
                    console.warn("No pending requests found.");
                }
            } catch (error) {
                console.error("API Error:", error.response?.data || error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
    }, []);

    return (
        <View>
            <StatusBar style='light' />

            {/* Requests Header */}
            <RequestsHeader requests={requests} />

            <ScrollView className='px-8 flex flex-col gap-y-8 h-[60vh]'>

                <View className="flex flex-col gap-6 py-10">
                    {/* <DataRequest
                        key={101}  // Use API ID
                        type={"on-chain"}  
                        from={"Ali"}
                        to={"Ahmad"}
                        status={'PENDING_PATIENT_CONSENT'}
                        id={'017a2f8212e23b45eadf4a519460434b40a23eee754a48b5e0625bba9dc5c086'}
                        about={ "N/A"}
                        date={ "N/A"}
                        time={ "N/A"}
                    /> */}
                    {loading ? (
                        <Text>Loading requests...</Text>
                    ) : requests.length === 0 ? (
                        <NoRequests text={"All done, you don't have any pending requests!"} />
                    ) : (
                        requests.filter((request) => request.status == 'PENDING_PATIENT_CONSENT').map((request) => (
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
                            />
                        ))
                    )}
                </View>

            </ScrollView>
        </View>
    );
};

export default Requests;
