import { View, Text, SafeAreaView, ScrollView, Image, Alert, Platform, Linking } from 'react-native';
import React, { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import * as Device from 'expo-device';

import { icons, Images } from '../../constants';
import { CustomInput, CustomButton } from '../../components';

import { useUser } from '../../Context/UserContext';
import apiClient, { databaseUrl } from '../../services/apiClient';

const SignIn = () => {
  const { setSession } = useUser();
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfa, setMfa] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [completedSession, setCompletedSession] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  const finishSignIn = async ({ token, accessToken, refreshToken, user }) => {
    const finalToken = token || accessToken;
    if (user?.role?.toLowerCase() !== 'patient') {
      Alert.alert("Patient account required", "Please sign in with a patient account to use the mobile app.");
      return;
    }
    await setSession({ accessToken: finalToken, refreshToken, user });
    router.replace('/(tabs)/home');
  };

  const handleSignIn = async () => {
    const { email, password } = form;

    if (!email || !password) {
      Alert.alert("All fields are required");
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);

    try {
      const clientType = Platform.OS === 'ios' ? 'ios' : 'android';
      const deviceLabel = `${Device.modelName || Device.deviceName || 'Mobile Device'} (${Platform.OS})`;

      const response = await apiClient.post(
        databaseUrl('/login'),
        { email, password, clientType, deviceLabel },
        { skipAuth: true }
      );

      const payload = response.data?.data || response.data;
      if (payload.mfaRequired) {
        setMfa(payload);
        setMfaCode('');
        return;
      }
      await finishSignIn(payload);
    } catch (error) {
      Alert.alert("Login failed", error.response?.data?.error || error.message || "Something went wrong.");
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setIsSubmitting(false);
      }, 1000);
    }
  };

  const handleMfaVerification = async () => {
    if (!mfaCode.trim()) return Alert.alert('Authentication code required');
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(databaseUrl('/auth/mfa/verify'),
        { challenge: mfa.challenge, code: mfaCode.trim() }, { skipAuth: true });
      const payload = response.data?.data || response.data;
      if (payload.recoveryCodes?.length) {
        setCompletedSession(payload);
        setRecoveryCodes(payload.recoveryCodes);
        return;
      }
      await finishSignIn(payload);
    } catch (error) {
      Alert.alert('Verification failed', error.response?.data?.error?.message || error.message || 'Invalid or expired authentication code.');
    } finally { setIsSubmitting(false); }
  };

  const openAuthenticator = async () => {
    try {
      const supported = await Linking.canOpenURL(mfa.setup.provisioningUri);
      if (!supported) return Alert.alert('Authenticator app unavailable', 'Install Google Authenticator or enter the manual setup key in another authenticator app.');
      await Linking.openURL(mfa.setup.provisioningUri);
    } catch {
      Alert.alert('Unable to open authenticator', 'Enter the manual setup key in Google Authenticator.');
    }
  };

  if (recoveryCodes) return <SafeAreaView className="bg-dblue h-full"><ScrollView>
    <View className="px-8 py-16"><Text className="text-white text-3xl font-bold">Save recovery codes</Text>
      <Text className="text-gray-200 mt-4">Store these one-time codes securely. They will not be shown again.</Text>
      <View className="bg-white rounded-xl p-5 mt-5">{recoveryCodes.map((code)=><Text selectable key={code} className="font-mono text-lg py-1">{code}</Text>)}</View>
      <CustomButton text="I have saved these codes" handleClick={()=>finishSignIn(completedSession)} style="mt-8" />
    </View></ScrollView></SafeAreaView>;

  if (mfa) return <SafeAreaView className="bg-dblue h-full"><ScrollView>
    <View className="px-8 py-16"><Text className="text-white text-3xl font-bold">Two-step verification</Text>
      {mfa.enrollmentRequired ? <View className="mt-5">
        <Text className="text-gray-200">Add this account in Google Authenticator, then enter its six-digit code.</Text>
        <CustomButton text="Open authenticator app" handleClick={openAuthenticator} style="mt-5" />
        <Text className="text-gray-300 mt-5">Manual setup key</Text><Text selectable className="text-white font-mono mt-2">{mfa.setup.secret}</Text>
      </View> : <Text className="text-gray-200 mt-5">Enter your authenticator code or an unused recovery code.</Text>}
      <View className="mt-8"><CustomInput handleChange={setMfaCode} type={mfa.enrollmentRequired ? 'number-pad' : 'default'} autoComplete="one-time-code" value={mfaCode} label="Authentication or recovery code" placeHolder="123456" /></View>
      <CustomButton text={isSubmitting ? 'Verifying...' : 'Verify and sign in'} handleClick={handleMfaVerification} style="mt-8" disabled={isSubmitting} />
    </View></ScrollView></SafeAreaView>;

  return (
    <SafeAreaView className="bg-dblue h-full">
      <Image source={Images.LogoShadow} resizeMode="contain" className="h-[32em] w-[32em] absolute -right-10 bottom-0 opacity-5" />

      <ScrollView>
        <View className="flex min-h-full px-8 py-16">
          <View className="flex gap-4 mb-10">
            <Image source={icons.Logo} resizeMode='cover' className="w-16 h-16" />
            <Text className="text-white text-3xl font-bold">BC Dentistry</Text>
          </View>

          <View className="flex flex-col gap-y-8">
            <CustomInput
              handleChange={(text) => setForm({ ...form, email: text })}
              type="email-address"
              value={form.email}
              label='Email'
              placeHolder="user@example.com"
            />
            <CustomInput
              handleChange={(text) => setForm({ ...form, password: text })}
              type="password"
              value={form.password}
              label='Password'
              placeHolder="password"
            />
          </View>

          <CustomButton
            text={isSubmitting ? 'Logging in...' : 'Login'}
            handleClick={handleSignIn}
            style='mt-12'
            disabled={isSubmitting}
          />

          <View className="mt-4 px-2">
            <Text className="text-gray-400 text-xs text-center leading-4">
              Need an account? Contact your registered dental clinic for patient onboarding credentials.
            </Text>
          </View>
        </View>

        {isLoading && (
          <View className="w-60 h-52 flex flex-col gap-3 absolute top-60 left-[22vw] items-center justify-center bg-gray-800 p-4 rounded-xl shadow-lg shadow-black/20">
            <Image source={icons.Loading} resizeMode='contain' className='w-14 h-14' />
            <Text className="text-center text-white text-2xl">Loading ⏳</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;
