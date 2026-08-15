import { View, Alert } from 'react-native';
import React, { useState } from 'react';
import CustomButton from './CustomButton';
import apiClient, { databaseUrl } from '../services/apiClient';

const AccesptReject = ({ requestID, patientID, updateStatus, setCardStatus, setrequestLoadingFunc }) => {
    const [loading, setLoading] = useState(false);
    const handleAccept = async () => {
        setLoading(true);
        if (setrequestLoadingFunc) setrequestLoadingFunc(true);

        try {
            const endpoint = databaseUrl('/grantConsent');
            const response = await apiClient.post(endpoint, {
                patientID,
                requestID,
            });

            Alert.alert("Consent Granted", "Request accepted successfully!");
            if (updateStatus) updateStatus(response.data?.data?.status || "ACTIVE");
        } catch (error) {
            console.error("Error Accepting Request:", error.response?.data || error.message);
            Alert.alert("Action Failed", error.response?.data?.error?.message || error.response?.data?.message || error.message || "Could not accept request.");
        } finally {
            if (setrequestLoadingFunc) setrequestLoadingFunc(false);
            setLoading(false);
            if (setCardStatus) setCardStatus(false);
        }
    };

    const submitRejection = async (reason) => {
        setLoading(true);
        if (setrequestLoadingFunc) setrequestLoadingFunc(true);

        try {
            const endpoint = databaseUrl('/patient/rejectRequest');
            await apiClient.post(endpoint, {
                patientID,
                requestID,
                rejectionReason: reason,
            });

            Alert.alert("Request Rejected", "Request rejected successfully.");
            if (updateStatus) updateStatus("REJECTED");
        } catch (error) {
            console.error("Error Rejecting Request:", error.response?.data || error.message);
            Alert.alert("Action Failed", error.response?.data?.error?.message || error.response?.data?.message || error.message || "Could not reject request.");
        } finally {
            if (setrequestLoadingFunc) setrequestLoadingFunc(false);
            setLoading(false);
            if (setCardStatus) setCardStatus(false);
        }
    };

    const handleRejectPrompt = () => {
        Alert.alert(
            "Reject Access Request",
            "Please select a reason for rejecting this record access request:",
            [
                { text: "Privacy Preference", onPress: () => submitRejection("Privacy preference") },
                { text: "Not Authorized", onPress: () => submitRejection("Not authorized") },
                { text: "Second Opinion Needed", onPress: () => submitRejection("Second opinion needed") },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    return (
        <View className="flex flex-row gap-x-4">
            <CustomButton
                key="reject"
                classes={"grow"}
                containerClasses={"border border-red-500 p-2 rounded-xl bg-red-500"}
                text={"Reject"}
                textClasses={"text-center text-white font-semibold text-lg"}
                handleClick={handleRejectPrompt}
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
