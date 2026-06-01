import { useLocation } from "react-router-dom";

const NavLink = ({icon, title, link, classes}) => {

    const path = useLocation().pathname;

    let weight = path.toLowerCase().split('/')[1] == title.toLowerCase().split(' ').join('') ? 'font-bold' : '';
    

     return (
        <div className={`nav-link flex gap-x-4 items-center justify-start w-full ${classes}`}>
            <div className="flex items-center justify-center icon w-8 h-8 ">
                <img src={icon} alt={link} className="w-full h-full" />
            </div>
            <div className="link">
                <p className={`${weight}`}>{title}</p>
            </div>
        </div>
     )
}

export default NavLink;