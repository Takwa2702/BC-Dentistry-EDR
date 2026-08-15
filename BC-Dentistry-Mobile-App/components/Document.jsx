import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import React, { useState } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { icons } from '../constants';
import { databaseUrl } from '../services/apiClient';
import { tokenStorage } from '../services/tokenStorage';

const Document = ({ fileID, title, type, size, content }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!fileID) {
      Alert.alert('Download Unavailable', 'File ID is missing for this document.');
      return;
    }

    try {
      setDownloading(true);
      const token = await tokenStorage.getAccessToken();
      const downloadUrl = databaseUrl(`/radiographic-files/${fileID}/content?purpose=radiographic%20image%20download`);
      console.log('[Document] Executing FileSystem.downloadAsync to URL:', downloadUrl);
      const sanitizeName = (title || `file-${fileID}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const localUri = `${FileSystem.documentDirectory}${sanitizeName}`;

      const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (downloadResult.status !== 200) {
        throw new Error(`Server returned HTTP ${downloadResult.status}`);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri);
      } else {
        Alert.alert('Download Complete', `Saved to:\n${downloadResult.uri}`);
      }
    } catch (error) {
      console.error('[Document] Download failed:', error.message || error);
      Alert.alert('Download Failed', error.message || 'Unable to download file.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View className="flex flex-row gap-x-4 w-full min-h-20 rounded-2xl items-center bg-gray-50 border border-gray-300 px-5 py-4">
      <Image
        source={type === 'pdf' ? icons.Document : type === 'jpeg' || type === 'jpg' ? icons.ImageIcon : icons.DicomIcon}
        resizeMode="contain"
        className="w-10 h-10"
      />

      <View className="flex flex-row items-center justify-between grow">
        <View className="shrink pr-2">
          <Text className="text-xl font-semibold" numberOfLines={1}>{title}</Text>
          <View className="flex flex-row">
            <Text className="text-sm font-light uppercase">{type}</Text>
            <Text className="text-sm font-light"> - </Text>
            <Text className="text-sm font-light">{size}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleDownload} disabled={downloading} className="p-2">
          {downloading ? (
            <ActivityIndicator size="small" color="#1E3A8A" />
          ) : (
            <Image source={icons.Download} resizeMode="contain" className="w-7 h-7" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Document;