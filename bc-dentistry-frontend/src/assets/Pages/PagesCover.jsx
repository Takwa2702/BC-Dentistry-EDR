import { useRef } from "react";
import Logo from "../images/logo-icon.svg"
import LoadingBar from "../components/LoadingBar";

const PagesCover = () => {

    const cover = useRef();
 


    return (
        <div id="CoverPage" ref={cover} className="h-full w-full overflow-hidden text-white absolute flex justify-center items-center top-0 left-0 bg-[#000814] z-[99999]"> 
            <div className="flex flex-col gap-y-8 items-center p-10 text-center">
                <div className="img">
                    <img className="w-20" src={Logo} alt="" />
                </div>
                {/**<h2 className="text-4xl font-light w-10/12 text-justify">Welcome to BC-Dentistry System</h2>**/}
                <LoadingBar /> 
            </div>
        </div>
    )
}


export default PagesCover;