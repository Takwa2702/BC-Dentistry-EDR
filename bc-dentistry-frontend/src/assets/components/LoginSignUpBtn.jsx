const LoginSignUpBtn = ({ text }) => {
    return (
        <button
            type="submit"
            className="w-full bg-blue-500 text-white font-semibold py-2 rounded-md hover:bg-blue-600 transition duration-200"
        >
            {text}
        </button>
    );
};

export default LoginSignUpBtn;
