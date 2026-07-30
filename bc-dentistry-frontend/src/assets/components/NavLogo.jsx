import { Link } from 'react-router-dom';
import Logo from "../images/logo.png"

const NavLogo = () => {
    return (
        <div id="NavLogo" className="mx-auto w-full">
            <Link to="/dashboard"><img className="w-full" src={Logo} alt="Electronic Dental Record dashboard" /></Link>
        </div>
    )
}

export default NavLogo;
