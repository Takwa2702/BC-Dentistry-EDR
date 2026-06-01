import { Link } from "react-router-dom";


const LoginOption = ({option, toLink}) => {
    return (
        <p className="mt-4 text-center text-sm">
            Don't have an account?
            <span className="underline">
                <Link to={toLink}> {option}</Link>
            </span>
        </p>
    )
}


export default LoginOption;