import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import axios from 'axios';
import { CustomButton } from './index';
import { authHeaders, blockchainUrl } from '../utils/api';
import { useUser } from '../Context/UserContext';

const AccesptReject = ({ requestID, patientID, updateStatus, setCardStatus, setrequestLoadingFunc, expandCardFunc }) => {
    const [loading, setLoading] = useState(false);
    const { token } = useUser();

    const completeAction = () => {
        setrequestLoadingFunc(false);
        expandCardFunc();
        setLoading(false);
        setCardStatus(false);
    };

    const handleAccept = async () => {
        if (!token) {
            Alert.alert('Login required', 'Please sign in again before approving requests.');
            return;
        }

        setLoading(true);
        setrequestLoadingFunc(true);
        try {
            await axios.post(blockchainUrl('/grantConsent'), { patientID, requestID }, { headers: authHeaders(token) });
            Alert.alert('Success', 'Request accepted successfully!');
            updateStatus('CONSENT_GRANTED');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error?.message || 'Failed to accept request.');
        } finally {
            completeAction();
        }
    };

    const handleReject = async () => {
        if (!token) {
            Alert.alert('Login required', 'Please sign in again before rejecting requests.');
            return;
        }

        setLoading(true);
        setrequestLoadingFunc(true);
        try {
            await axios.post(
                blockchainUrl('/patient/rejectRequest'),
                { patientID, requestID, rejectionReason: 'Not authorized' },
                { headers: authHeaders(token) }
            );
            Alert.alert('Success', 'Request rejected successfully!');
            updateStatus('REJECTED');
        } catch (error) {
            Alert.alert('Error', error.response?.data?.error?.message || 'Failed to reject request.');
        } finally {
            completeAction();
        }
    };

    return (
        <View className="flex flex-row gap-x-4">
            <CustomButton
                key="reject"
                classes="grow"
                containerClasses="border border-red-500 p-2 rounded-xl bg-red-500"
                text="Reject"
                textClasses="text-center text-white font-semibold text-lg"
                handleClick={handleReject}
                disabled={loading}
            />
            <CustomButton
                key="accept"
                classes="grow"
                containerClasses="border border-green-500 p-2 rounded-xl bg-green-500"
                text="Accept"
                textClasses="text-center text-white font-semibold text-lg"
                handleClick={handleAccept}
                disabled={loading}
            />
        </View>
    );
};

export default AccesptReject;
