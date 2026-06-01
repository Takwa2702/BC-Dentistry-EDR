// import { useRole } from '../Context/RoleContext.jsx';
// import PatientsCards from "../Sections/Patients/PatientsCards";
// import PatientsFilters from "../Sections/Patients/PatientsFilters";

// import Lo from "../images/icons/calendar.svg"



// const Patients = () => {
//     const { userRole } = useRole();
    
//     return (
//         <div id="Patients" className="grid grid-cols-12 gap-x-8" style={{gridTemplateColumns: '2fr 8fr'}}>
//             <PatientsFilters />

            
//             <div className="flex flex-col w-full gap-y-4">
//                 <div className="flex items-center border bg-white px-4 py-4 rounded-xl w-full justify-between">
//                     <h1 className="patients-header text-2xl font-bold">Patients</h1>

//                     {userRole != 'admin' && (
//                         <div className="new-patient bg-gradient-to-r from-blue-800 to-blue-950 py-2 px-3 rounded-md text-white flex items-center gap-x-3 w-fit">
//                             <div className="icon"><img className='w-5 h-5' src={Lo} alt="" /></div>
//                             <button onClick={() => {document.getElementById('AddNewPatientDialog').lastElementChild.scrollTop = 0}} id="addNewPatientBtn" className="icon">
//                                 <a href="#addNewPatient">Add a new Patient</a>
//                             </button>
//                         </div>
//                     )}
//                 </div>
//                 <PatientsCards />
//             </div>
//         </div>
//     )
// }

// export default Patients;
import PatientsCards from "../Sections/Patients/PatientsCards";
import PatientsFilters from "../Sections/Patients/PatientsFilters";
import axios from "axios";
import { useEffect, useState } from "react";
import Lo from "../images/icons/calendar.svg";

const Patients = () => {
    const [patients, setPatients] = useState([]);
    const user = JSON.parse(localStorage.getItem("user")); // Retrieve user details

    useEffect(() => {
        console.log("✅ User Details:", user); // Debugging

        if (!user || !user.id || !user.role) {
            console.error("🚨 Missing user details. Cannot fetch patients.");
            return;
        }

        const fetchPatients = async () => {
            try {
                let response;
                const role = user.role.toLowerCase(); // Convert role to lowercase for comparison
                console.log("role:", role);
                console.log("user.organizationId:", user.organizationId);
                console.log("user.blockchainID:", user.blockchainID);

                if (role === "admin" && user.organizationId) {
                    console.log("🟢 Admin fetching patients for clinic:", user.organizationId);
                    response = await axios.get(`http://localhost:8081/getPatientsByClinic/${user.organizationId}`);
                } else if (role === "doctor" && user.blockchainID) {
                    console.log("🔵 Doctor fetching assigned patients:", user.blockchainID);
                    response = await axios.get(`http://localhost:8081/getPatientsAssignedToDoctor/${user.blockchainID}`);
                } else {
                    console.error("🚨 Invalid role or missing organization/blockchain ID.");
                    return;
                }

                console.log("✅ Patients fetched:", response.data);
                setPatients(response.data);
            } catch (error) {
                console.error("❌ Error fetching patients:", error.response?.data || error.message);
            }
        };

        fetchPatients();
    }, []); // Run once after component mounts

    return (
        <div id="Patients" className="grid grid-cols-12 gap-x-8" style={{ gridTemplateColumns: "2fr 8fr" }}>
            <PatientsFilters />
            <div className="flex flex-col w-full gap-y-4">
                <div className="flex items-center border bg-white px-4 py-4 rounded-xl w-full justify-between">
                    <h1 className="patients-header text-2xl font-bold">Patients</h1>

                    {user.role.toLowerCase() === "admin" && (
                        <div className="new-patient bg-gradient-to-r from-blue-800 to-blue-950 py-2 px-3 rounded-md text-white flex items-center gap-x-3 w-fit">
                            <div className="icon">
                                <img className="w-5 h-5" src={Lo} alt="" />
                            </div>
                            <button onClick={() => { document.getElementById("AddNewPatientDialog").lastElementChild.scrollTop = 0 }} id="addNewPatientBtn" className="icon">
                                <a href="#addNewPatient">Add a new Patient</a>
                            </button>
                        </div>
                    )}
                </div>
                <PatientsCards patients={patients} />
            </div>
        </div>
    );
};

export default Patients;

