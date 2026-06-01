import { useEffect } from "react";
import { useRouter } from "expo-router";

import { Text, View, Image, SafeAreaView } from "react-native";
import { Link } from "expo-router";

import { icons, Images } from "../constants"

import "../global.css";

export default function Index() {
  const route = useRouter()


  useEffect(() => {
    const timer = setTimeout(()=>{
      route.push('/(auth)/sign-in')
      // route.push('/(tabs)/requests')
      // route.push('/documents')
    }, 3000)



    return () => clearTimeout(timer)
  }, [])
  

  return (
    <SafeAreaView
      className="bg-dblue flex flex-1 items-center justify-center text-white"
    >
      <Image source={Images.LogoShadow} resizeMode="contain" className="h-[32em] w-[32em] absolute -right-10 bottom-0 opacity-5 bg-blend-overlay" />
      
      <Image source={icons.Logo} resizeMode="contain" className="w-20 h-20" />


      <Text className="text-gray-300 absolute bottom-16 text-sm">Terms & conditions are applied</Text>

    </SafeAreaView>
  );
}
