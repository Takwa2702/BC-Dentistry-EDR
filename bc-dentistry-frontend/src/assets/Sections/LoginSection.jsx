import React, { useEffect, useRef, useState } from 'react';
import {  useNavigate, useLocation } from 'react-router-dom';
import UserRole from '../components/UserRole';
import Input from '../components/Input';
import LoginOption from '../components/LoginOption';
import LoginSignUpBtn from '../components/LoginSignUpBtn';
import axios from 'axios';

const LoginSection = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [ isSignup, setIsSignup ] = useState(false);
    const path = useLocation().pathname;
    const [isVisible, setIsVisible] = useState(false)


    useEffect(() => {
        if(path == '/' || path == '/login'){
            setIsVisible(true);
        }
        else{
            setIsVisible(false);
        }

    }, [])

    const handleLogin = async (email, password) => {
        // console.log('email:', email); // Add this
        // console.log('Password:', password); // Add this
    
        try {
            const response = await axios.post('http://localhost:8080/login', {
                email,
                password,
            });
    
            const { token, user } = response.data;
    
            // Store the token and user details in localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
    
            // Redirect to the dashboard
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError('Invalid email or password');
        }
    };


    return (
        <div className='loginTh2 h-full flex flex-col justify-center absolute px-16 top-0 right-0'>
            <div className="rounded-lg p-6 w-[36em] z-40 ">
                <form id="login-form">
                    <div className='flex justify-between items-center'>
                        <h2 className="text-4xl font-semibold text-left mb-4">Welcome Back !</h2>
                        <UserRole />
                    </div>
                    {error && <p className="text-red-500">{error}</p>}
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <Input
                            Id={"email"}
                            Type={'text'}
                            isRequired={true}
                            Classes={'w-full'}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                    </div>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>

                        <Input
                            Type={'password'}
                            Id={"password"}
                            isRequired={true}
                            Classes={'w-full'}
                            onChange={(e) => setPassword(e.target.value)}
                        /> 

                    </div>
                        {/* <LoginSignUpBtn text={"Login"} 
                        email={email}
                        password={password}
                        onLogin={handleLogin}
                        /> */}
                        <LoginSignUpBtn
                            text="Login"
                            onLogin={() => handleLogin(email, password)} // Use the current state values
                        />


         
                    <LoginOption toLink={"/signup"} option={"Signup"} />
                    
                </form>
            </div>
        </div>

    );
};

export default LoginSection;
