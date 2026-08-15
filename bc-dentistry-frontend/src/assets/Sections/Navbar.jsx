import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { NavLogo, NavLink } from "../components";
import Icon1 from "../images/icons/dashboard.png";
import Icon2 from "../images/icons/appointments.png";
import Icon3 from "../images/icons/patients.png";
import Icon4 from "../images/icons/medicines.png";
import Icon5 from "../images/icons/plans.png";
import Icon6 from "../images/icons/settings.png";
import Icon7 from "../images/icons/info.png";
import { useRole } from "../Context/RoleContext.jsx";

const Navbar = () => {
    const location = useLocation();
    const [currentPath, setCurrentPath] = useState(location.pathname.split("/").pop());
    const { userRole } = useRole();

    useEffect(() => {
        setCurrentPath(location.pathname.split("/").pop());
    }, [location]);

    const normalizedRole = userRole?.toLowerCase();
    const navList = normalizedRole === 'system' ? [
        { title: "Clinics", link:'Clinics', icon: Icon1 },
    ] : normalizedRole === 'patient' ? [
        { title: "My Record", link:'My-Record', icon: Icon3 },
        { title: "Appointments", link:'Appointments', icon: Icon2 },
        { title: "Lab Results", link:'LabResults', icon: Icon4 },
        { title: "Data Requests", link:'Patient-Requests', icon: Icon5 },
    ] : [
        { title: "Dashboard", link:'Dashboard', icon: Icon1 },
        { title: "Appointments", link:'Appointments', icon: Icon2 },
        { title: "Patients", link:'Patients', icon: Icon3 },
        ...(normalizedRole === 'admin' ? [{ title: "Doctors", link:'Doctors', icon: Icon3 }] : []),
        { title: "Lab Results", link:'LabResults', icon: Icon4 },
        ...(normalizedRole === 'admin' ? [{ title: "Data Requests", link:'DataRequests', icon: Icon5 }] : []),
    ];

    const renderNavLinks = () =>
        navList.map((nav) => {
            const isActive = nav.link.toLowerCase() === currentPath.toLowerCase();
            return (
                <Link className="w-full" key={nav.title} to={`/${nav.link.toLowerCase()}`}>
                    <NavLink icon={nav.icon} title={nav.title} link={nav.link} classes={isActive ? "font-bold" : "font-light"} />
                </Link>
            );
        });

    return (
        <nav id="Navbar" aria-label="Primary navigation" className="fixed inset-x-3 top-3 z-40 overflow-hidden rounded-xl bg-[#000814] px-3 py-2 lg:inset-x-auto lg:h-[95vh] lg:w-[14%] lg:px-6 lg:py-10">
            <div className="hidden lg:block"><NavLogo /></div>
            <div id="Navlinks" className="flex overflow-x-auto text-white lg:mt-16 lg:flex-col lg:gap-y-12 lg:overflow-visible">
                <div className="main flex min-w-max items-center gap-2 lg:min-w-0 lg:flex-col lg:gap-y-6">
                    {renderNavLinks()}
                </div>
                <div className="personal ml-auto flex min-w-max items-center gap-2 lg:ml-0 lg:flex-col lg:gap-y-6">
                    {['admin','doctor'].includes(normalizedRole) && <Link className="w-full" to="/settings"><NavLink icon={Icon6} title={"Settings"} link={"settings"} /></Link>}
                    {['admin','doctor'].includes(normalizedRole) && <Link className="w-full" to="/info"><NavLink icon={Icon7} title={"Info"} link={"info"} /></Link>}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
