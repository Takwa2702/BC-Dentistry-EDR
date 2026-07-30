import { View, Text, SafeAreaView, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import React, { useState } from 'react';
import axios from 'axios';
import { Link, useRouter } from 'expo-router';

import { icons, Images } from "../../constants";
import CustomInput from '../CustomInput';
import CustomButton from '../CustomButton';

import { useUser } from '../../Context/UserContext';
import { databaseUrl } from '../../utils/api';

const SignIn = () => {
  const { setUser, setToken } = useUser(); // no need to use user here
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    const { email, password } = form;

    if (!email || !password) {
      Alert.alert("All fields are required");
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);

    try {
      const response = await axios.post(databaseUrl('/login'), { email, password });
      const { token, user } = response.data;

      if (user?.role?.toLowerCase() !== 'patient') {
        Alert.alert("Patient account required", "Please sign in with a patient account to use the mobile app.");
        return;
      }

      setToken(token);
      setUser(user);
      router.replace('/home'); // Navigate to home
    } catch (error) {
      Alert.alert("Login failed", error.response?.data?.error || error.message || "Something went wrong.");
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setIsSubmitting(false);
      }, 1000);
    }
  };

  return (
    <SafeAreaView className="bg-dblue h-full">
      <Image source={Images.LogoShadow} resizeMode="contain" className="h-[32em] w-[32em] absolute -right-10 bottom-0 opacity-5" />

      <ScrollView>
        <View className="flex min-h-full px-8 py-16">
          <View className="flex gap-4 mb-10">
            <Image source={icons.Logo} resizeMode='cover' className="w-16 h-16"/>
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

          <View className="mt-4">
            <Text className='text-gray-400 text-sm'>
              Don't have an account? <Link href="/sign-up" className='underline'>Sign up</Link> here
            </Text>
          </View>
        </View>

        {isLoading && (
          <View className="w-60 h-52 flex flex-col gap-3 absolute top-60 left-[22vw] items-center justify-center bg-gray-800 p-4 rounded-xl shadow-lg shadow-black/20">
            <Image source={icons.Loading} resizeMode='contain' className='w-14 h-14'  />
            <Text className="text-center text-white text-2xl">Loading ⏳</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignIn;
