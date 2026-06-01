// import Data from "../../../data";
// import { useLocation } from "react-router-dom";
// import { MainContainer } from "../components";
// import PatientMainBar from "../components/Patient/PatientMainBar";
// import PatientPersonalInfo from "../components/Patient/PatientPersonalInfo";
// import MedicalRecord from "../components/Patient/MedicalRecord";
// import DentalRecord from "../components/Patient/DentalRecord";
// import { useRole } from '../Context/RoleContext.jsx';

// const Patient = () => {
//     const path = useLocation().pathname;
//     const { userRole } = useRole();

//     const patientDetails = Data.filter((patient) => {
//         return patient.id == path.split('/').pop();
//     })



    
//     return (
//         <MainContainer classes={'w-full my-6'}>
//             <div className="col-span-12 flex flex-col gap-y-4">
//                 <PatientMainBar id={patientDetails[0].id} fullName={patientDetails[0].name} gender={patientDetails[0].Gender} dob={patientDetails[0]["date-of-birth"]} />
//                 <PatientPersonalInfo />
//                 <MedicalRecord />
//                 <DentalRecord dentalDetails={patientDetails[0]['dental-details']} />
//                 {userRole === 'doctor' && (
//                     <DentalRecord dentalDetails={patientDetails[0]['dental-details']} />
//                 )}
//             </div>
//         </MainContainer>
//     )
// }

// export default Patient;

// import Data from "../../../data";
import { useLocation } from "react-router-dom";
import { MainContainer } from "../components";
import PatientMainBar from "../components/Patient/PatientMainBar";
import PatientPersonalInfo from "../components/Patient/PatientPersonalInfo";
import MedicalRecord from "../components/Patient/MedicalRecord";
import DentalRecord from "../components/Patient/DentalRecord";
import { useRole } from '../Context/RoleContext.jsx';
import { useEffect, useState } from "react";
import axios from "axios";

const Patient = () => {
    const path = useLocation().pathname;
    const { userRole } = useRole();
    const user = JSON.parse(localStorage.getItem("user")); // Retrieve user details

    // const patientDetails = Data.filter((patient) => {
    //     return patient.id == path.split('/').pop();
    // })
    const patientId = path.split('/').pop(); // Extract patient ID from URL
    console.log('Fetched Patient id:', patientId);

    const [patientDetails, setPatientDetails] = useState(null); // State to hold the patient data
    const [loading, setLoading] = useState(true); // Loading state

    // Fetch patient details when the component mounts
    useEffect(() => {
        const fetchPatientDetails = async () => {
            try {
                const response = await axios.get(`http://localhost:8081/ReadPatient/${patientId}`);
                console.error('Fetched patients:', response.data);
                setPatientDetails(response.data); // Store the fetched patient data
                
                setLoading(false);
            } catch (error) {
                console.error('Error fetching patient details:', error);
                setLoading(false);
            }
        };

        fetchPatientDetails();
    }, [patientId]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!patientDetails) {
        return <div>Patient not found</div>;
    }

    // Check if the patient has shared data with Doctor1
    const isSharedWithDoctor1 = patientDetails.sharedWith.includes(user.blockchainID);
    console.log('Result of checking deoctor shared with details:', isSharedWithDoctor1);
    
    return (
        <MainContainer classes={'w-full my-6'}>
            <div className="col-span-12 flex flex-col gap-y-4">
                <PatientMainBar id={patientDetails.patientID}  fullName={`${patientDetails.firstName} ${patientDetails.lastName}`} gender={patientDetails.gender} dob={patientDetails.dateOfBirth} />
                <PatientPersonalInfo patientDetail={patientDetails}/>
                
                 {/* Show medical records only for doctors */}
                 {userRole === 'doctor' && isSharedWithDoctor1 ? (
                    patientDetails.medicalRecords?.length > 0 ? (
                        <MedicalRecord medicalDetails={patientDetails.medicalRecords} />
                    ) : (
                        <p>No medical records available.</p>
                    )
                ) : (
                    userRole === 'doctor' && <p>No medical records available or not shared with Doctor.</p>
                )}

                {/* Show dental records only for doctors */}
                {userRole === 'doctor' && isSharedWithDoctor1 ? (
                    patientDetails.dentalChart?.length > 0 ? (
                        <DentalRecord dentalDetails={patientDetails.dentalChart} />
                    ) : (
                        <p>No dental records available.</p>
                    )
                ) : (
                    userRole === 'doctor' && <p>No dental records available or not shared with Doctor.</p>
                )}
                {/* <DentalRecord dentalDetails={patientDetails[0]['dental-details']} />
                {userRole === 'doctor' && (
                    <DentalRecord dentalDetails={patientDetails[0]['dental-details']} />
                )} */}
            </div>
        </MainContainer>
    )
}

export default Patient;