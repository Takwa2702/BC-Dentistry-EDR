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
import { useParams } from "react-router-dom";
import { MainContainer } from "../components";
import PatientMainBar from "../components/Patient/PatientMainBar";
import PatientPersonalInfo from "../components/Patient/PatientPersonalInfo";
import MedicalRecord from "../components/Patient/MedicalRecord";
import DentalRecord from "../components/Patient/DentalRecord";
import { useRole } from '../Context/RoleContext.jsx';
import { useEffect, useState } from "react";
import axios from "axios";
import { authHeaders, databaseUrl } from "../config/api.js";
import { getStoredUser } from "../utils/auth.js";
import RadiographicFiles from "../components/Patient/RadiographicFiles.jsx";
import ClinicalRecords from "../components/Patient/ClinicalRecords.jsx";

const Patient = ({ patientID: patientIDOverride }) => {
    const { id: routePatientID } = useParams();
    const { userRole } = useRole();
    const user = getStoredUser(); // Retrieve user details

    // const patientDetails = Data.filter((patient) => {
    //     return patient.id == path.split('/').pop();
    // })
    const patientId = patientIDOverride || routePatientID;

    const [patientDetails, setPatientDetails] = useState(null); // State to hold the patient data
    const [loading, setLoading] = useState(true); // Loading state
    const [error, setError] = useState('');

    // Fetch patient details when the component mounts
    useEffect(() => {
        const fetchPatientDetails = async () => {
            try {
                const response = await axios.get(databaseUrl(`/patients/${encodeURIComponent(patientId)}`), { headers: authHeaders() });
                setPatientDetails(response.data.data);
                
                setLoading(false);
            } catch (error) {
                setError(error.response?.data?.error?.message || 'Unable to load patient details.');
                setLoading(false);
            }
        };

        fetchPatientDetails();
    }, [patientId]);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!patientDetails) {
        return <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error || 'Patient not found.'}</div>;
    }

    if (!user) {
        return <div>Please log in to view patient details.</div>;
    }

    const canViewClinicalRecords = userRole === 'doctor';
    
    return (
        <MainContainer classes={'w-full my-6'}>
            <div className="col-span-12 flex flex-col gap-y-4">
                <PatientMainBar id={patientDetails.patientID}  fullName={`${patientDetails.firstName} ${patientDetails.lastName}`} gender={patientDetails.gender} dob={patientDetails.dateOfBirth} />
                <PatientPersonalInfo patientDetail={patientDetails}/>
                <RadiographicFiles patientID={patientDetails.patientID || patientId} canUpload={userRole === 'doctor'} />
                <ClinicalRecords patientID={patientDetails.patientID || patientId} role={userRole} />
                
                 {/* Show medical records only for doctors */}
                 {canViewClinicalRecords ? (
                    patientDetails.medicalRecords?.length > 0 ? (
                        <MedicalRecord medicalDetails={patientDetails.medicalRecords} />
                    ) : (
                        <p>No medical records available.</p>
                    )
                ) : (
                    userRole === 'doctor' && <p>Medical records are unavailable for this patient.</p>
                )}

                {/* Show dental records only for doctors */}
                {canViewClinicalRecords ? (
                    patientDetails.dentalChart?.length > 0 ? (
                        <DentalRecord dentalDetails={patientDetails.dentalChart} />
                    ) : (
                        <p>No dental records available.</p>
                    )
                ) : (
                    userRole === 'doctor' && <p>Dental records are unavailable for this patient.</p>
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
