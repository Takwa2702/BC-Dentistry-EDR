import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/Input';
import LoginSignUpBtn from '../components/LoginSignUpBtn';
import axios from 'axios';
import { databaseUrl } from '../config/api.js';
import { useRole } from '../Context/RoleContext.jsx';

const LoginSection = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { setUserRole } = useRole();

    const handleLogin = async (email, password) => {
        // console.log('email:', email); // Add this
        // console.log('Password:', password); // Add this
    
        try {
            const response = await axios.post(databaseUrl('/login'), {
                email,
                password,
            });
    
            const { token, user } = response.data;
    
            // Store the token and user details in localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            setUserRole(user.role?.toLowerCase() || null);
    
            const role = user.role?.toLowerCase();
            const destination = user.mustChangePassword ? '/change-password' : role === 'system' ? '/clinics' : role === 'patient' ? '/my-record' : ['admin', 'doctor'].includes(role) ? '/dashboard' : '/unauthorized';
            navigate(destination, { replace: true });
        } catch {
            setError('Invalid email or password');
        }
    };


    return (
        <div className='loginTh2 h-full flex flex-col justify-center absolute px-16 top-0 right-0'>
            <div className="rounded-lg p-6 w-[36em] z-40 ">
                <form id="login-form" onSubmit={(event) => { event.preventDefault(); handleLogin(email, password); }}>
                    <div className='flex justify-between items-center'>
                        <h2 className="text-4xl font-semibold text-left mb-4">Welcome Back !</h2>
                    </div>
                    {error && <p className="text-red-500">{error}</p>}
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <Input
                            Id={"email"}
                            Type={'email'}
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
                        <LoginSignUpBtn text="Login" />


         
                </form>
            </div>
        </div>

    );
};

export default LoginSection;
