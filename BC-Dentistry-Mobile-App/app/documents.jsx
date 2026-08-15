import { View, Text, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native'
import { useEffect, useState } from 'react';
import React from 'react'
import { NoRequests, Document } from '../components';
import apiClient, { databaseUrl, getPatientBlockchainID } from '../services/apiClient';
import { useUser } from '../Context/UserContext';

const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileType = (fileName, mediaType) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'dcm' || ext === 'dicom' || mediaType?.includes('dicom')) return 'dicom';
    if (ext === 'pdf' || mediaType?.includes('pdf')) return 'pdf';
    if (ext === 'jpg' || ext === 'jpeg' || mediaType?.includes('image')) return 'jpeg';
    return 'dicom';
};

const Documents = () => {
    const { user } = useUser();
    const [files, setFiles] = useState([])
    const [loading, setIsLoading] = useState(true)

    const patientID = getPatientBlockchainID(user);

    useEffect(() => {
        const fetchRadiographicFiles = async () => {
            if (!patientID) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const response = await apiClient.get(databaseUrl(`/patients/${patientID}/radiographic-files`));
                const list = Array.isArray(response.data?.data)
                    ? response.data.data
                    : Array.isArray(response.data)
                        ? response.data
                        : [];

                setFiles(list);
            } catch (error) {
                console.error("[Documents] Error fetching radiographic files:", error.response?.data || error.message);
            } finally {
                setIsLoading(false);
            }
        }

        fetchRadiographicFiles();
    }, [patientID])

    return (
        <SafeAreaView className="bg-white flex-1">
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <View className='flex flex-col gap-4 p-6'>
                    <Text className="text-2xl font-bold mb-2">Radiographic Files</Text>

                    {loading ? (
                        <ActivityIndicator size="large" color="#1E3A8A" className="mt-8" />
                    ) : !patientID ? (
                        <NoRequests text={"Unable to load your data. Patient account ID is missing."} />
                    ) : files.length === 0 ? (
                        <NoRequests text={"No radiographic or medical files found."} />
                    ) : (
                        files.map((file) => (
                            <Document
                                key={file.fileID || file.sha256}
                                fileID={file.fileID}
                                title={file.fileName || 'Radiographic File'}
                                type={getFileType(file.fileName, file.mediaType)}
                                size={formatFileSize(file.fileSize)}
                                content={file.storageReference}
                            />
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export default Documents;
