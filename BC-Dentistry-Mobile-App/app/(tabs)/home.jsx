import { SafeAreaView, View, ScrollView, RefreshControl } from 'react-native'
import React, { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'

import { UserBar, Statstic, AppointmentsSection } from '../../components/index'
import { icons } from '../../constants'
import { StatusBar } from 'expo-status-bar'
import { fetchPatientRequests, getPatientBlockchainID, getRequestLifecycleStatus } from '../../services/apiClient'
import { useUser } from '../../Context/UserContext'

const Home = () => {
  const { user } = useUser();
  const [counts, setCounts] = useState({ completed: 0, pending: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const patientID = getPatientBlockchainID(user);

  const fetchDashboardCounts = useCallback(async () => {
    if (!patientID) {
      setLoading(false);
      return;
    }

    try {
      const list = await fetchPatientRequests(patientID);

      const completed = list.filter((r) => ['ACTIVE', 'COMPLETED'].includes(getRequestLifecycleStatus(r))).length;
      const pending = list.filter((r) => getRequestLifecycleStatus(r) === 'PENDING_PATIENT_CONSENT').length;
      const rejected = list.filter((r) => ['REJECTED', 'REQUEST_REJECTED'].includes(getRequestLifecycleStatus(r))).length;

      setCounts({ completed, pending, rejected });
    } catch (error) {
      console.error('[Home] Error fetching dashboard counts:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientID]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardCounts();
    }, [fetchDashboardCounts])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardCounts();
  }, [fetchDashboardCounts]);

  return (
    <SafeAreaView className="bg-[#F8F8F8] flex-1">
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} tintColor="#1E3A8A" />
        }
      >
        <View className="bg-[#F8F8F8] p-6 flex flex-col gap-y-8 flex-1">
          <UserBar />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex flex-row gap-6">
            <Statstic icon={icons.greenClock} label="Completed" number={loading ? "..." : String(counts.completed)} />
            <Statstic icon={icons.blueClock} label="Pending" number={loading ? "..." : String(counts.pending)} />
            <Statstic icon={icons.redClock} label="Canceled" number={loading ? "..." : String(counts.rejected)} />
          </ScrollView>

          <AppointmentsSection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Home;
