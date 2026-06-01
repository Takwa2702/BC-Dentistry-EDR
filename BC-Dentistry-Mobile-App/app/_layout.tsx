import { Stack } from "expo-router";

import { UserProvider } from "../Context/UserContext"


export default function RootLayout() {
  return (
    <UserProvider>
      <Stack>
        <Stack.Screen name="index" options={{headerShown: false}} />
        <Stack.Screen name="proceedRequests" options={{headerShown: true, headerTitle:'Approved Requests', headerBackTitle:'Info'}} />
        <Stack.Screen name="rejectedRequests" options={{headerShown: true, headerTitle:'Rejected Requests', headerBackTitle:'Info'}} />
        <Stack.Screen name="documents" options={{headerShown: true, headerTitle:'Documents', headerBackTitle:'docs'}} />
        <Stack.Screen name="(auth)" options={{headerShown: false}} />
        <Stack.Screen name="(tabs)" options={{headerShown: false}} />
      </Stack>
    </UserProvider>
) 
}
