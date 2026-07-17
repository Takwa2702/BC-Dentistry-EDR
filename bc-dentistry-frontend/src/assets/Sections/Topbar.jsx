import SearchBar from "../components/SearchBar";
import Notifications from "../components/Notifications";
import { useNavigate } from "react-router-dom";
import { clearSession } from "../utils/auth.js";

const Topbar = () => {
    const navigate = useNavigate();
    const logout = () => { clearSession(); navigate('/login', { replace: true }); };
    return (
        <div id="top-bar" className="px-10 border rounded-xl bg-white py-3 w-full h-fit z-50 shadow-sm mb-8">
            <div className="flex justify-between w-full">
                <SearchBar />
                <Notifications />
                <button type="button" onClick={logout} className="rounded-md border px-3 py-2 text-sm font-semibold">Log out</button>
            </div>
            {/* <div id="rect" className="border-b my-5"></div> */}
        </div>
    )
}

export default Topbar;
