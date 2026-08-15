import { View, Text, Alert } from 'react-native'
import React, { useRef, useState, useEffect } from 'react'

import CustomButton from './CustomButton';
import DataRequestElement from './DataRequestElement';
import AccesptReject from './AccesptReject';
import StatusUpdateLoading from './StatusUpdateLoading';
import apiClient, { databaseUrl } from '../services/apiClient';

const formatRequestedAt = (requestedAt, legacyDate, legacyTime) => {
    if (requestedAt) {
        const timestamp = new Date(requestedAt);
        if (!Number.isNaN(timestamp.getTime())) {
            return timestamp.toLocaleString();
        }
    }

    if (legacyDate || legacyTime) {
        return [legacyDate, legacyTime].filter(Boolean).join(' : ');
    }

    return 'Date unavailable';
};

const DataRequest = ({ type, doctorName, clinicName, to, status, id, about, requestedAt, date, time, optionsVisible = true, showRevoke = false, onStatusChange }) => {
    const requestCard = useRef()
    const [isExpanded, setIsExpanded] = useState(false);
    const [requestLoading, setRequestLoading] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(status);
    const requestCardButton = useRef();

    useEffect(() => {
        setCurrentStatus(status);
    }, [status]);

    const expandCard = () => {
        setIsExpanded((expanded) => !expanded);
    };

    const handleRevokeConsent = () => {
        Alert.alert(
            "Revoke Record Access",
            "Are you sure you want to revoke consent for this record access request? The requesting doctor will no longer be able to view your data.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Revoke Access",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setRequestLoading(true);
                            await apiClient.post(databaseUrl('/patient/revokeConsent'), {
                                patientID: to,
                                requestID: id,
                                revocationReason: "Patient revoked consent",
                            });

                            Alert.alert("Consent Revoked", "Record access has been revoked successfully.");
                            setCurrentStatus("REVOKED");
                            if (onStatusChange) onStatusChange(id, "REVOKED");
                        } catch (error) {
                            console.error("[DataRequest] Revoke error:", error.response?.data || error.message);
                            Alert.alert("Revocation Failed", error.response?.data?.error?.message || error.response?.data?.message || error.message || "Could not revoke consent.");
                        } finally {
                            setRequestLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View className="bg-white relative rounded-xl overflow-hidden mb-2">
            {requestLoading && (
                <StatusUpdateLoading
                    reff={requestCard}
                    status={currentStatus}
                    requestLoadingStatus={requestLoading}
                    setrequestLoadingFunc={setRequestLoading}
                />
            )}

            <View className="flex p-4 flex-col gap-y-2 rounded-xl">
                <View className={`${(type || '').toLowerCase() === 'off-chain' ? "bg-red-600" : "bg-green-600"} rounded-xl`}>
                    <Text className="text-white px-3 py-2 text-2xl uppercase font-bold">{type || 'ON-CHAIN'}</Text>
                </View>

                <DataRequestElement 
                    containerClasses={""}
                    header={"Request from:"}
                    headerClasses={"text-xl"}
                    details={doctorName}
                    detailsClasses={"text-2xl font-bold"}
                />

                <DataRequestElement
                    containerClasses={"flex flex-row justify-between gap-x-8"}
                    header={"Clinic:"}
                    headerClasses={"text-xl"}
                    details={clinicName}
                    detailsClasses={"grow text-right text-xl font-semibold"}
                />

                {!optionsVisible && (
                    <DataRequestElement 
                        containerClasses={"flex flex-row justify-between"}
                        header={"Requested at:"}
                        headerClasses={"text-lg text-gray-300 font-normal italic"}
                        details={formatRequestedAt(requestedAt, date, time)}
                        detailsClasses={"text-lg text-gray-300 font-normal italic"}
                    />
                )}

                {isExpanded && (
                    <View>
                        <DataRequestElement 
                            header={"ID:"}
                            containerClasses={"flex flex-col justify-between overflow-hidden"}
                            details={id}
                            headerClasses={"text-xl"}
                            detailsClasses={"text-xl uppercase font-bold"}
                        />
                        <DataRequestElement 
                            header={"Request for:"}
                            containerClasses={""}
                            headerClasses={"text-xl"}
                            details={`${to}`}
                            detailsClasses={"text-2xl font-bold"}
                        />

                        <DataRequestElement 
                            header={"For: "}
                            containerClasses={"flex flex-row justify-between"}
                            headerClasses={"text-xl font-semibold"}
                            details={about || "N/A"}
                            detailsClasses={"text-xl font-semibold"}
                        />

                        <DataRequestElement 
                            containerClasses={"flex flex-row justify-between"}
                            header={"Requested at:"}
                            headerClasses={"text-lg text-gray-300 font-normal italic"}
                            details={formatRequestedAt(requestedAt, date, time)}
                            detailsClasses={"text-lg text-gray-300 font-normal italic"}
                        />
                            
                    </View>
                )}

                <DataRequestElement 
                    header={"Status:"}
                    containerClasses={"flex flex-row justify-between gap-x-8"}
                    headerClasses={"text-xl"}
                    details={
                        currentStatus === "ACTIVE" ? "ACTIVE" :
                        currentStatus === "COMPLETED" ? "COMPLETED" :
                        currentStatus === "PENDING_PATIENT_CONSENT" ? "PENDING" :
                        currentStatus === "REVOKED" ? "REVOKED" : "REJECTED"
                    }
                    detailsClasses={`grow text-right text-xl uppercase font-bold 
                        ${currentStatus === 'PENDING_PATIENT_CONSENT' ? 'text-[#FF9500]' :
                        (currentStatus === 'ACTIVE' || currentStatus === 'COMPLETED') ? 'text-green-500' :
                        'text-red-600'}`}
                />

                {currentStatus === 'PENDING_PATIENT_CONSENT' && (
                    <AccesptReject
                        requestID={id}
                        patientID={to}
                        updateStatus={(newStatus) => {
                            setCurrentStatus(newStatus);
                            if (onStatusChange) onStatusChange(id, newStatus);
                        }}
                        setCardStatus={setIsExpanded}
                        setrequestLoadingFunc={setRequestLoading}
                    />
                )}

                {showRevoke && currentStatus === 'ACTIVE' && (
                    <CustomButton
                        key="revoke"
                        containerClasses="bg-red-600 p-3 rounded-xl items-center mt-2"
                        text="Revoke Consent"
                        textClasses="text-white font-bold text-center text-lg"
                        handleClick={handleRevokeConsent}
                        disabled={requestLoading}
                    />
                )}

                {optionsVisible && (
                    <CustomButton
                        key={1}
                        reff={requestCardButton}
                        containerClasses={"border-t pt-3 mt-2"}
                        text={!isExpanded ? 'Show Details' : 'Hide Details'}
                        textClasses={"text-center"}
                        handleClick={expandCard}
                    />
                )}
            </View>
        </View>
    );
};

export default DataRequest;
