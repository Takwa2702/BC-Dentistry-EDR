import { SafeAreaView, View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native'
import React, { useEffect, useState } from 'react'
import { Brief, Information, PageHeader, CustomButton } from '../../components'
import { useUser } from '../../Context/UserContext'
import apiClient, { databaseUrl, getPatientBlockchainID } from '../../services/apiClient'

const Settings = () => {
  const { user, signOut } = useUser()
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const patientID = getPatientBlockchainID(user)

  useEffect(() => {
    const fetchPatientProfile = async () => {
      if (!patientID) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const response = await apiClient.get(databaseUrl(`/patients/${patientID}`));
        const payload = response.data?.data || response.data;
        setProfileData(payload);
      } catch (error) {
        console.error('[Settings] Error fetching patient profile:', error.response?.data || error.message);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientProfile();
  }, [patientID]);

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView className="bg-white flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex flex-col items-center">
          <PageHeader headerText={'Info'} />
          <View className="w-full px-6 flex flex-col gap-y-6 mt-5">
            {loading ? (
              <ActivityIndicator size="large" color="#1E3A8A" className="mt-12" />
            ) : error || !profileData ? (
              <Text className="text-center text-red-500 mt-6 font-semibold">
                Unable to load patient profile data.
              </Text>
            ) : (
              <>
                <Brief
                  name={`${profileData?.firstName || ''} ${profileData?.lastName || ''}`.trim() || user?.name || 'Patient'}
                  id={profileData?.emiratesID || profileData?.patientID || user?.blockchainID || 'N/A'}
                />
                <Information data={profileData} />
              </>
            )}

            <CustomButton
              text="Log out"
              handleClick={handleLogout}
              classes="w-full mt-4"
              containerClasses="bg-red-600 p-4 rounded-xl items-center justify-center"
              textClasses="text-white font-bold text-lg text-center"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default Settings
