// import Box from "../../components/Box"
// import PatientCard from "../../components/Patients/PatientCard";
// import Data from '../../../../data'
// import NewPatientDialog from "../../components/Patients/NewPatientDialog";
// import RequestPatientCard from "../../components/Patients/RequestPatientCard";

// const PatientsCards = () => {

//     let medicalRecordObj = {appointments: [], medications: [], allergies: [], link: '#medical'}
//     let dentalRecordObj = {details: [], link: '#addNewPatient'}

//     let d = new Date

//     const patientsCards = Data.map((patient) => {
//         medicalRecordObj.medications = patient.medications
//         medicalRecordObj.appointments = patient.appointments
//         medicalRecordObj.allergies = patient.allergies
//         medicalRecordObj.link = '#medical'
        
//         dentalRecordObj.details = patient["dental-details"]
//         dentalRecordObj.link = '#dental'


//         return (
//             <PatientCard
//                 key={patient.id}
//                 patientId={patient.id}
//                 fullName={patient.name}
//                 age={d.getFullYear() - patient['date-of-birth'].split('.').pop()}
//                 gender={patient.gender}
//                 insurance={patient.insurance['company-name']}
//                 medicalRecord={medicalRecordObj}
//                 dentalRecord={dentalRecordObj}
//             />
//         )
//     })



//     return (
//         <div id="PatientsCards" className="rounded-md">
//             <div className='grid grid-cols-3 2xl:grid-cols-4 gap-3 p-0'>
//                 <RequestPatientCard />
//                 {patientsCards}
//             </div>




//             <NewPatientDialog />
//         </div>
//     )
// }

// export default PatientsCards;

import Box from "../../components/Box"
import PatientCard from "../../components/Patients/PatientCard";
// import Data from '../../../../data'
import NewPatientDialog from "../../components/Patients/NewPatientDialog";
import RequestPatientCard from "../../components/Patients/RequestPatientCard";

const PatientsCards = ({ patients }) => {
    // Current date for age calculation
    let d = new Date();

    // let medicalRecordObj = {appointments: [], medications: [], allergies: [], link: '#medical'}
    // let dentalRecordObj = {details: [], link: '#addNewPatient'}

    // let d = new Date

    // const patientsCards = Data.map((patient) => {
    //     medicalRecordObj.medications = patient.medications
    //     medicalRecordObj.appointments = patient.appointments
    //     medicalRecordObj.allergies = patient.allergies
    //     medicalRecordObj.link = '#medical'
        
    //     dentalRecordObj.details = patient["dental-details"]
    //     dentalRecordObj.link = '#dental'


    //     return (
    //         <PatientCard
    //             key={patient.id}
    //             patientId={patient.id}
    //             fullName={patient.name}
    //             age={d.getFullYear() - patient['date-of-birth'].split('.').pop()}
    //             gender={patient.gender}
    //             insurance={patient.insurance['company-name']}
    //             medicalRecord={medicalRecordObj}
    //             dentalRecord={dentalRecordObj}
    //         />
    //     )
    // })
    const patientsCards = patients.map((patient) => {
        const medicalRecordObj = {
            medications: patient.medicalRecords?.[0]?.medications || [], // Safely access medications array
            allergies: patient.medicalRecords?.[0]?.allergies || [], // Safely access allergies array
            link: '#medical',
        };

        const dentalRecordObj = {
            details: patient.dentalChart || [], // Access the dental chart array
            link: '#dental',
        };


        return (
            <PatientCard
            key={patient.patientID}
            patientId={patient.patientID}
            fullName={`${patient.firstName} ${patient.lastName}`}
            age={d.getFullYear() - new Date(patient.dateOfBirth).getFullYear()} // Calculate age
            gender={patient.gender}
            contactNumber={patient.contactNumber}
            address={patient.address}
            emiratesID={patient.emiratesID}
            email={patient.email}
            createdDate={new Date(patient.createdDate).toLocaleDateString()}
            medicalRecord={medicalRecordObj}
            dentalRecord={dentalRecordObj}
            insurance={"N/A"}
            />
        )
    })


    return (
        <div id="PatientsCards" className="rounded-md">
            <div className='grid grid-cols-3 2xl:grid-cols-4 gap-3 p-0'>
                <RequestPatientCard />
                {patientsCards.length > 0 ? patientsCards : <p>No patients found.</p>}
            </div>




            <NewPatientDialog />
        </div>
    )
}

export default PatientsCards;