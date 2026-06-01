import SearchBar from "../components/SearchBar";
import Notifications from "../components/Notifications";

const Topbar = () => {
    return (
        <div id="top-bar" className="px-10 border rounded-xl bg-white py-3 w-full h-fit z-50 shadow-sm mb-8">
            <div className="flex justify-between w-full">
                <SearchBar />
                <Notifications />
            </div>
            {/* <div id="rect" className="border-b my-5"></div> */}
        </div>
    )
}

export default Topbar;