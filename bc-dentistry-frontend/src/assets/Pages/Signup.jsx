import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Input from '../components/Input';
import LoginSignUpBtn from '../components/LoginSignUpBtn';
import LoginOption from '../components/LoginOption';
import axios from 'axios';
import { apiRequestErrorMessage, databaseUrl, jsonHeaders } from '../config/api.js';
const Signup = () => {

    
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [username, setUsername] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [organizationId, setOrganizationId] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [isSignup, setIsSignup] = useState(false);
    const path = useLocation().pathname;
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (path === '/signup') {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [path]);

    const handleSignup = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        try {
            const response = await axios.post(databaseUrl('/register'), {
                firstName: firstname,
                lastName: lastname,
                username,
                contactNumber,
                organizationId,
                password,
            }, {
                headers: jsonHeaders(),
            });
            setSuccess(response.data.message);
            setError('');
            // console.log({
            //     firstName: firstname,
            //     lastName: lastname,
            //     username,
            //     contactNumber,
            //     password,
            //     roleId: 2,
            // });
            // Redire[ct to the dashboard
            navigate('/login');
        } catch (err) {
            console.error(err);
            setError(apiRequestErrorMessage(err, 'Registration failed.'));
        }
    };
    
    

    return (
        <div className={`loginTh ${isVisible ? 'absolute' : 'hidden'} w-full gap-y-8 items-center justify-center bg-gray-100 h-[100vh] w-[100vw] z-[999] top-0 left-0`}>
            <div className="loginTh2 h-full w-full md:w-auto flex flex-col justify-center px-4 sm:px-8 md:px-16 top-0 right-0">
                <div className="rounded-lg p-6 w-full md:w-[36em] z-40">
                    <form id="signup-form">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-4xl font-semibold text-left">Create Account</h2>
                        </div>
                        <div className="mb-4">
                            <label htmlFor="firstname" className="block text-sm font-medium text-gray-700">First Name</label>
                            <Input
                                Id={"firstname"}
                                Type={'text'}
                                isRequired={true}
                                Classes={'w-full'}
                                onChange={(e) =>  setFirstname(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="lastname" className="block text-sm font-medium text-gray-700">Last Name</label>
                            <Input
                                Id={"lastname"}
                                Type={'text'}
                                isRequired={true}
                                Classes={'w-full'}
                                onChange={(e) => setLastname(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Email</label>
                            <Input
                                Id={"username"}
                                Type={'text'}
                                isRequired={true}
                                Classes={'w-full'}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="contactnumber" className="block text-sm font-medium text-gray-700">Contact Number</label>
                            <Input
                                Id={"contactnumber"}
                                Type={'text'}
                                isRequired={true}
                                Classes={'w-full'}
                                onChange={(e) => setContactNumber(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700">Organization ID</label>
                            <Input
                                Id={"organizationId"}
                                Type={'number'}
                                isRequired={true}
                                Classes={'w-full'}
                                onChange={(e) => setOrganizationId(e.target.value)}
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
                        <div className="mb-4">
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
                            <Input
                                Type={'password'}
                                Id={"confirmPassword"}
                                isRequired={true}
                                Classes={'w-full'}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                        {/* <LoginSignUpBtn text={"Signup"} /> */}
                        <LoginSignUpBtn text={'Signup'} onLogin={handleSignup} />
                        <LoginOption toLink={"/login"} option={"Login"} />
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Signup;
