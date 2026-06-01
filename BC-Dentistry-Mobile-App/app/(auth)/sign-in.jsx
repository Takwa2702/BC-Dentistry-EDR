import { View, Text, SafeAreaView, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useRouter } from 'expo-router';

import { icons, Images } from "../../constants";
import CustomInput from '../CustomInput';
import CustomButton from '../CustomButton';

import { useUser } from '../../Context/UserContext';

const API_BASE_URL = 'http://openuae.fortiddns.com:28081';

const SignIn = () => {
  const { setUser } = useUser(); // no need to use user here
  const router = useRouter();

  const [form, setForm] = useState({ email: "", password: "" });
  const [usersData, setUsersData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all users on load
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/getAllPatients`);
        const filteredUsers = response.data?.filter(user => user.firstName);
        setUsersData(filteredUsers);
      } catch (error) {
        console.log("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  const handleSignIn = async () => {
    const { email, password } = form;

    if (!email || !password) {
      Alert.alert("All fields are required");
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);

    try {
      // Simulate login (optional: verify with /login if needed)
      const foundUser = usersData.find(
        user => user.email.trim().toLowerCase() === email.trim().toLowerCase()
      );

      if (foundUser) {
        setUser(foundUser); // Set the user in context
        router.replace('/home'); // Navigate to home
      } else {
        Alert.alert(
          "No account found",
          "Email does not exist. Contact the clinic to check your account credentials."
        );
      }

    } catch (error) {
      Alert.alert("Error", error.message || "Something went wrong.");
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











// import { View, Text, SafeAreaView, ScrollView, Image,TouchableOpacity, Alert } from 'react-native'
// import React, { useState, useEffect } from 'react'

// import { icons, Images } from "../../constants"
// import CustomInput from '../CustomInput'
// import CustomButton from '../CustomButton'
// import { Link, router, useRouter } from 'expo-router'
// import axios from 'axios'

// const API_BASE_URL = 'http://openuae.fortiddns.com:28081'; 

// import { useUser } from '../../Context/UserContext'

// const signIn = () => {


//     const { user, setUser } = useUser()


//     console.log(user);
    

//     const [ form, setForm ] = useState({
//         email: "", 
//         password: ""
//     })

//     const [ usersEmails, setUsersEmails ] = useState([])

//     const [ isLoading, setIsLoading ] = useState(false)

//     const [ usersData, setUsersData ] = useState(null)

//     const [ isRegistered, setIsRegistered ] = useState(false)


//     useEffect(() => {
    
//             const fetchUsers = async () => {
//                 try {
//                     const response = await axios.get(`${API_BASE_URL}/getAllPatients`)

//                     setUsersData(response.data?.filter((data) => data.firstName))

//                     setUsersEmails(response.data?.map((detail) => detail.email))
    
//                 } catch (error) {
//                     console.log(error);
                    
//                 }
//             }
    
    
//             fetchUsers()
    

    
        
//         }, [])



//     const [ isSubmitting, setIsSubmitting ] = useState(false)

//     const route = useRouter()


//     const signIn = () => {
//         if(form.email == "" || form.password == "") {Alert.alert("All fields are required"); return}
        

//         setIsSubmitting(true)



//         const checkUser = async () => {
//             const response = await fetch(`${API_BASE_URL}/login`, {
//                 method: 'POST',
//                 headers: {'Content-Type' : "application/json"},
//                 body: JSON.stringify({email: form['email'], password:form['password']})
//             })

//             const json = response.json()

            
            
//             if(response.ok){
//                 // console.log(response);

//                 if(json.name != undefined){
//                     setIsRegistered(true)
//                 }
//                 else{
//                     setIsRegistered(false)
//                 }
//             }


//             return isRegistered
//         }




//         try{
//             setIsLoading(true)


//             // console.log(form);

//             // console.log(usersEmails, form.email, usersEmails.includes(form.email));
            

//             // if(usersEmails.includes(form.email) && isRegistered){
//             //     route.replace('/home')
//             // }
//             if(usersEmails.includes(form.email)){
                

//                 // password is in the following format: <firstName>@<last4Digits of id>$
                
//                 console.log('-----------------------------------------------------');
//                 console.log(usersData.filter((data) => data.email == String(form.email).toLowerCase().trim()))

//                 setUser(usersData.filter((data) => data.email == String(form.email).toLowerCase().trim()))

//                 console.log('-----------------------------------------------------');


//                 console.log('-----------------------------------------------------');
//                 console.log(user);
//                 console.log('-----------------------------------------------------');
                
//                 route.replace('/home')
//             }
//             else{
//                 setIsLoading(false)
//                 Alert.alert("No account found", "Email does not exisit, contact the clinic to check your account credentials")
//             }


//             // route.replace('/home')
//         }catch(error){
//             Alert.alert("Error", error.message)
//         } 
//         finally{
//             setTimeout(() => {
//                 setIsLoading(false)
                
//                 // console.log(user);
                
//                 console.log(form.email);
//                 // setUser(form.email)

//                 // if(!isLoading){
//                 //     Alert.alert("Error", "Pas")
//                 // }
//                 setIsSubmitting(false)
//             }, 1500)
//         }
//     }




//   return (
//     <SafeAreaView className="bg-dblue h-full">
//         <Image source={Images.LogoShadow} resizeMode="contain" className="h-[32em] w-[32em] absolute -right-10 bottom-0 opacity-5 bg-blend-overlay" />
//         <ScrollView>
//             <View className="flex min-h-full px-8 py-16">
//                 <View className="flex gap-4 mb-10">
//                     <Image source={icons.Logo} resizeMode='cover' className="w-16 h-16"/>
//                     <Text className="text-white text-3xl font-bold">BC Dentistry</Text>
//                 </View>

//                 <View className="flex flex-col gap-y-8">
//                     <CustomInput 
//                         handleChange={(text) => setForm({...form, email: text})} 
//                         type="email-address" 
//                         value={form.email}
//                         label='Email'
//                         placeHolder={"user@example.com"} 
//                         inputStyle={''} 
//                     />
//                     <CustomInput 
//                         handleChange={(text) => setForm({...form, password: text})} 
//                         type="password" 
//                         value={form.password}
//                         label='Password'
//                         placeHolder={"password"}
//                         inputStyle={''} 
//                     />

//                 </View>




//                 <CustomButton text={'Login'} handleClick={signIn} style='mt-12' />



//                 <View className="mt-4">
//                     <Text className='text-gray-400 text-sm'>
//                         Don't have an account? <Link href="/sign-up" className='underline'>Sign up</Link> here
//                     </Text>
//                 </View>




//             </View>

//             {
//                 isLoading &&
//                 <View className="w-60 h-52 flex flex-col gap-3 absolute top-60 left-[22vw] items-center justify-center bg-gray-800 p-4 rounded-xl shadow-lg shadow-black/20">
//                     <Image source={icons.Loading} resizeMode='contain' className='w-14 h-14'  />
//                     <Text className="text-center text-white text-2xl">
//                         Loading ⏳
//                     </Text>
//                 </View> 
//             }



            
//         </ScrollView>
//     </SafeAreaView>
//   )
// }

// export default signIn