import React from 'react';

const LoginSignUpBtn = ({ text, onLogin }) => {
    const handleClick = (e) => {
        e.preventDefault(); // Prevent default behavior
        if (onLogin) {
            onLogin(e); // Pass the event object if needed
        }
    };

    return (
        <button
            type="button"
            className="w-full bg-blue-500 text-white font-semibold py-2 rounded-md hover:bg-blue-600 transition duration-200"
            onClick={handleClick}
        >
            {text}
        </button>
    );
};

export default LoginSignUpBtn;
