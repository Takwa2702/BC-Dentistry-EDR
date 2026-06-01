import Logo from "../images/logo.png"

const NavLogo = () => {
    return (
        <div id="NavLogo" className="mx-auto w-full">
            <a href="/">
                <img className="w-full" src={Logo} alt="" />
            </a>
        </div>
    )
}

export default NavLogo;