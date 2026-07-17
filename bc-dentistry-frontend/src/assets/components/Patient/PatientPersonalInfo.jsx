import DetailInfo from "./DetailInfo";
import { useLocation } from 'react-router-dom';

const PatientPersonalInfo = ({patientDetail}) => {
    // const id = useLocation().pathname.split('/').pop();
    // const patientDetail = Data.filter((d) => {return d.id == id})[0];


    return (
        <div className="patient-personal-info bg-white border rounded-xl flex gap-x-10 items-left flex flex-col gap-y-6 w-full px-16 py-6">
            <h2 className="text-3xl font-bold">Personal Details</h2>
            <div className="details grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <DetailInfo classes={'grow'} header={'Patient ID'} info={patientDetail.patientID} />
                <DetailInfo classes={'grow'} header={'Insurance Provider'} info={patientDetail.insuranceProvider || 'Not recorded'} />
                <DetailInfo classes={'grow'} header={'Policy Number'} info={patientDetail.policyNumber || 'Not recorded'} />
                <DetailInfo classes={'grow'} header={'Coverage Type'} info={patientDetail.coverageType || 'Not recorded'} />
                <DetailInfo classes={'grow'} header={'Emirates ID'} info={patientDetail.emiratesID} />
                <DetailInfo classes={'grow'} header={'Nationality'} info={patientDetail.nationality || 'Not recorded'} />
                <DetailInfo classes={'grow'} header={'Address'} info={patientDetail.address || 'Not recorded'} />
                <DetailInfo classes={'grow'} header={'Blood Type'} info={patientDetail.bloodType || 'Not recorded'} />
                <DetailInfo classes={'grow'} header={'Phone Number'} info={patientDetail.contactNumber} />
                <DetailInfo classes={'grow'} header={'Email'} info={patientDetail.email} />
                <DetailInfo classes={'grow'} header={'Clinic'} info={patientDetail.clinicID || 'Not recorded'} />
                <DetailInfo classes={'grow'} header={'Assigned Doctors'} info={(patientDetail.doctors || []).join?.(', ') || patientDetail.doctors || 'None'} />
                {/* <DetailInfo classes={'grow'} header={'Phone Number'} info={patientDetail['phone-number']} /> */}
            </div>
        </div>
    )
}

export default PatientPersonalInfo;
