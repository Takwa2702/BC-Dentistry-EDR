import { View, Text, SafeAreaView, ScrollView, Image, TouchableOpacity, Alert, KeyboardAvoidingView, Platform  } from 'react-native'
import React, { useState } from 'react'

import { icons, Images } from "../../constants"
import CustomInput from '../CustomInput'
import CustomButton from '../CustomButton'
import { Link } from 'expo-router'




const signUp = () => {

    const [ form, setForm ] = useState({
            firstName: "", 
            lastName: "", 
            email: "", 
            password: ""
        })

    const [ isSubmitting, setIsSubmitting ] = useState(false)




    const SignUpFunc = () => {
        if(form.firstName == "" || form.lastName == "" || form.email == "" || form.password == ""){
            Alert.alert("All fields are required")
            return;
        }

        
        
        try{
            setIsSubmitting(true)


            
            // console.log(form);
            route.replace('/home')
        }catch(error){
            console.log(error);
        }
        finally{
            setIsSubmitting(false)
        }



    //     console.log('====================================');
    //     console.log(form);
    //     console.log('====================================');
    }


  return (
    <SafeAreaView className="bg-dblue h-full">
        <Image source={Images.LogoShadow} resizeMode="contain" className="h-[32em] w-[32em] absolute -right-10 bottom-0 opacity-5 bg-blend-overlay" />
        <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 32 : 0}
                
        >
            <ScrollView>
                <View className="flex min-h-full px-8 py-16">
                    <View className="flex gap-4 mb-10">
                        <Image source={icons.Logo} resizeMode='cover' className="w-16 h-16"/>
                        <Text className="text-white text-3xl font-bold">BC Dentistry</Text>
                    </View>

                    <View className="flex flex-col gap-y-6">
                        <CustomInput 
                            type="text"
                            handleChange={(text) => setForm({...form, firstName: text})} 
                            label={'First Name'} 
                            value={form.firstName}
                            placeHolder={"e. g. Ali"} 
                            style={''}
                        />
                            <CustomInput 
                            type="text"
                            handleChange={(text) => setForm({...form, lastName: text})} 
                            label={'Last Name'} 
                            value={form.lastName}
                            placeHolder={"e. g. Hasan"} style={''} 
                        />
                        
                        <CustomInput 
                            type="email-address"
                            handleChange={(text) => setForm({...form, email: text})} 
                            label={'Email'} 
                            value={form.email}
                            placeHolder={"user@example.com"} 
                            style={''}
                        />
                            <CustomInput 
                            type="password"
                            handleChange={(text) => setForm({...form, password: text})} 
                            label={'Password'} 
                            value={form.password}
                            placeHolder={"password"} 
                            style={''} 
                        />

                    </View>




                    <CustomButton text={'Sign Up'} handleClick={SignUpFunc} style='mt-12' />



                    <View className="mt-4">
                        <Text className='text-gray-400 text-sm'>
                            Have an account? <Link href="/sign-in" className='underline'>Sign in</Link> here
                        </Text>
                    </View>




                </View>

                
            </ScrollView>
        </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default signUp