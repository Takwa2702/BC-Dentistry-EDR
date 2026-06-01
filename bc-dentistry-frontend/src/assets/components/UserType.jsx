// const UserType = ({type}) => {
//     const t = {
//         Doctor: 'Dr',
//         Admin: 'A',
//     }
//     return(
//         <div id="UserType" className="flex items-center gap-x-4 rounded-md">
//             <div className="pfp flex items-center justify-center w-9 h-9 bg-blue-950 rounded-md text-white">
//                 {t[type]}
//             </div>
//             <h2 className="w-32 ">Welcome back, <span className="font-bold">{t[type]}. </span></h2>
//         </div>
//     )
// }

// export default UserType;

import { useEffect, useState } from 'react';

const UserType = () => {
    const [userData, setUserData] = useState(null);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) {
            setUserData(storedUser);
        }
    }, []);

    const rolePrefix = userData?.role === "Doctor" ? "Dr." : "A.";

    return (
        <div id="UserType" className="flex items-center gap-x-4 rounded-md">
            <div className="pfp flex items-center justify-center w-9 h-9 bg-blue-950 rounded-md text-white">
                {rolePrefix}
            </div>
            <h2 className="w-32">Welcome back, <span className="font-bold">{rolePrefix} {userData?.name}</span></h2>
        </div>
    );
};

export default UserType;