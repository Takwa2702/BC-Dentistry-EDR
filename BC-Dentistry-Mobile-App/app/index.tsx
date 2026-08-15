import { Text, View, Image, SafeAreaView } from "react-native";
import { icons, Images } from "../constants";
import "../global.css";

export default function Index() {
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
