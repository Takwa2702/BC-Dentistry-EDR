import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import LoginSection from "../Sections/LoginSection";

const Login = () => {
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






    return (
        <div className={`loginTh ${ isVisible ? "absolute" : "hidden"} w-full gap-y-8  items-center justify-center bg-gray-100 h-[100vh] w-[100vw] z-[999] top-0 left-0`}>

            <LoginSection />
        </div>
    )
}

export default Login;