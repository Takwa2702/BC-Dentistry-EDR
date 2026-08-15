import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import apiClient, { databaseUrl } from '../services/apiClient';
import { NoRequests } from '../components';

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiClient.get(databaseUrl('/notifications?status=ALL'));
      const list = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
        ? response.data
        : response.data?.notifications || [];

      setNotifications(list);
    } catch (error) {
      console.error('[Notifications] Error fetching notifications:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (item, notifId) => {
    const isAlreadyRead = item.isRead || item.status === 'READ';
    if (isAlreadyRead) return;

    // Optimistically mark as read locally
    setNotifications((prev) =>
      prev.map((n, idx) => {
        const currentId = n.notificationID || n.Notification_ID || n.notificationId || n.id || n.ID || idx;
        return currentId === notifId ? { ...n, isRead: true, status: 'READ' } : n;
      })
    );

    // Call API if valid server ID exists
    if (typeof notifId !== 'number') {
      try {
        await apiClient.post(databaseUrl(`/notifications/${notifId}/read`));
      } catch (error) {
        console.error('[Notifications] Failed to mark as read:', error.response?.data || error.message);
      }
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <SafeAreaView className="bg-white flex-1">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} tintColor="#1E3A8A" />
        }
      >
        <View className="flex flex-col gap-4 p-6">
          <Text className="text-2xl font-bold mb-2">Notifications</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#1E3A8A" className="mt-8" />
          ) : notifications.length === 0 ? (
            <NoRequests text="You have no notifications at this time." />
          ) : (
            notifications.map((item, index) => {
              const realNotifId = item.notificationID || item.Notification_ID || item.notificationId || item.id || item.ID || index;
              const isUnread = !item.isRead && item.status !== 'READ';
              const createdDate = item.createdAt || item.createdDate || item.Date ? new Date(item.createdAt || item.createdDate || item.Date).toLocaleDateString() : '';

              return (
                <TouchableOpacity
                  key={realNotifId || index}
                  onPress={() => handleMarkAsRead(item, realNotifId)}
                  activeOpacity={0.7}
                  className={`p-4 rounded-2xl border flex flex-col gap-y-2 relative ${
                    isUnread ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <View className="flex flex-row justify-between items-center">
                    <Text className="text-lg font-bold text-gray-900">{item.title || item.Title || 'Notification'}</Text>
                    {isUnread && (
                      <View className="bg-blue-600 px-2 py-1 rounded-full">
                        <Text className="text-white text-xs font-bold uppercase">New</Text>
                      </View>
                    )}
                  </View>

                  <Text className="text-base text-gray-700 leading-5">{item.message || item.body || item.text || item.Message || 'N/A'}</Text>

                  {createdDate ? <Text className="text-xs text-gray-400 font-light mt-1">{createdDate}</Text> : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationsScreen;
