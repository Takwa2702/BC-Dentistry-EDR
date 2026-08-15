import SearchBar from "../components/SearchBar";
import Notifications from "../components/Notifications";
import { useNavigate } from "react-router-dom";
import { clearSession } from "../utils/auth.js";
import { disableWebPush } from "../../config/firebaseMessaging.js";
import { authHeaders, databaseUrl } from "../config/api.js";

const Topbar = () => {
    const navigate = useNavigate();
    const logout = async () => {
        try {
            await disableWebPush();
        } catch (error) {
            console.warn("Unable to unregister browser push during logout", error);
        }
        try {
            await fetch(databaseUrl('/auth/logout'), { method: 'POST', credentials: 'include', headers: authHeaders() });
        } finally {
            clearSession();
            navigate('/login', { replace: true });
        }
    };
    return (
        <div id="top-bar" className="mb-8 h-fit w-full rounded-xl border bg-white px-4 py-3 shadow-sm z-50 sm:px-6 lg:px-8">
            <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <SearchBar />
                <div className="flex flex-wrap items-center justify-end gap-3">
                    <Notifications />
                    <button type="button" onClick={() => navigate('/sessions')} className="h-10 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold">Active sessions</button>
                    <button type="button" onClick={logout} className="h-10 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold">Log out</button>
                </div>
            </div>
            {/* <div id="rect" className="border-b my-5"></div> */}
        </div>
    )
}

export default Topbar;
