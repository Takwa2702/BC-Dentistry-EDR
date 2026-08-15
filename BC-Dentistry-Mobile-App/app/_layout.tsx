import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from "expo-router";
import * as Notifications from 'expo-notifications';
import { View, ActivityIndicator, Platform } from 'react-native';

import { UserProvider, useUser } from "../Context/UserContext"
import { logFcmToken } from '../utils/getFcmToken';
import { logExpoPushToken } from '../utils/getExpoPushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function InitialLayout() {
  const { isAuthenticated, isLoading } = useUser();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inProtectedGroup = segments[0] === '(tabs)' || ['proceedRequests', 'rejectedRequests', 'documents', 'notifications', 'auditHistory', 'patients'].includes(segments[0]);
    const isRootIndex = segments[0] === undefined || segments[0] === 'index';

    if (!isAuthenticated && (inProtectedGroup || isRootIndex)) {
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && (inAuthGroup || isRootIndex)) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b192c' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="proceedRequests" options={{ headerShown: true, headerTitle: 'Approved Requests', headerBackTitle: 'Info' }} />
      <Stack.Screen name="rejectedRequests" options={{ headerShown: true, headerTitle: 'Rejected Requests', headerBackTitle: 'Info' }} />
      <Stack.Screen name="documents" options={{ headerShown: true, headerTitle: 'Documents', headerBackTitle: 'docs' }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, headerTitle: 'Notifications', headerBackTitle: 'Home' }} />
      <Stack.Screen name="auditHistory" options={{ headerShown: true, headerTitle: 'Access Audit History', headerBackTitle: 'Info' }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      logFcmToken();
    } else if (Platform.OS === 'ios') {
      logExpoPushToken();
    }
  }, []);

  return (
    <UserProvider>
      <InitialLayout />
    </UserProvider>
  );
}
