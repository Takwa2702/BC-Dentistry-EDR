import { useEffect, useRef, useState } from "react";
import PatientRequestInput from "./PatientRequestInput";
import RequestPatientCardSubmit from "./RequestPatientCardSubmit";
import { blockchainUrl, jsonHeaders } from "../../config/api.js";
import { getStoredUser } from "../../utils/auth.js";

const RequestPatientCard = () => {
    const requestDataForm = useRef();
    const [patientName, setPatientName] = useState('');
    const [patientID, setPatientID] = useState('');
    const [clinicID, setClinicID] = useState('');
    const [dataType, setDataType] = useState('Medical and Dental Records');
    const [purpose, setPurpose] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState({ loading: false, error: '', notice: '' });
    const user = getStoredUser(); 
    const doctorID = user?.blockchainID; 

    const expandRequestForm = () => {
        requestDataForm.current.classList.replace("h-0", "h-[34rem]");
    };

    useEffect(() => {
        const handleClicksOutside = (e) => {
            if (
                requestDataForm.current &&
                !requestDataForm.current.contains(e.target) &&
                !e.target.classList.contains("patient-card-btn")
            ) {
                requestDataForm.current.classList.replace("h-[34rem]", "h-0");
            }
        };

        document.addEventListener("click", handleClicksOutside);
        return () => {
            document.removeEventListener("click", handleClicksOutside);
        };
    }, []);

    // Function to submit data to API
    const handleSubmit = async () => {
        if (!doctorID || !patientID || !clinicID || !dataType || !purpose) {
            setStatus({ loading: false, error: 'Enter the patient, clinic, data type, and request purpose before submitting.', notice: '' });
            return;
        }

        setStatus({ loading: true, error: '', notice: '' });
        try {
            const response = await fetch(blockchainUrl('/requestAccess'), {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify({
                    doctorID,
                    patientID,
                    dataOriginClinicID: clinicID,
                    dataType,
                    purpose,
                    reason: purpose,
                    notes,
                }),
            });

            const payload = await response.json();
            if (response.ok) {
                setStatus({ loading: false, error: '', notice: `Request sent successfully. Request ID: ${payload.data.requestID}` });
                setPatientName(''); setPatientID(''); setClinicID(''); setPurpose(''); setNotes('');
            } else {
                setStatus({ loading: false, error: payload?.error?.message || 'Failed to request access.', notice: '' });
            }
        } catch (error) {
            console.error("Failed to send request:", error);
            setStatus({ loading: false, error: 'Error submitting request. Please try again later.', notice: '' });
        }
    };

    return (
        <div className="patient-card relative flex flex-col text-center text-gray-400 border border-[.2em] border-dashed border-gray-300 rounded-md p-5 gap-y-3 h-56 justify-between">
            <button type="button" onClick={expandRequestForm} aria-label="Request access to a patient at another clinic" className="patient-card-btn text-8xl font-extralight">+</button>
            <div>
                <p>Click here to request data for a specific patient</p>
            </div>

            <div ref={requestDataForm} className="request-form flex flex-col gap-y-4 absolute top-0 left-0 w-full h-0 overflow-hidden rounded-md bg-white drop-shadow-xl">
                <div className="flex flex-col items-end gap-y-4 p-5 text-left">
                    <PatientRequestInput
                        header={'Patient name:'}
                        placeHolder={"Patient full name here"}
                        value={patientName}
                        onChange={(e) => {
                            setPatientName(e.target.value);
                        }}
                    />
                    <PatientRequestInput
                        header={'Patient ID:'}
                        placeHolder={"Enter Patient ID"}
                        value={patientID}
                        onChange={(e) => {
                            setPatientID(e.target.value);
                        }}
                    />
                    <PatientRequestInput
                        header={'Clinic ID:'}
                        placeHolder={"Enter Clinic ID"}
                        value={clinicID}
                        onChange={(e) => {
                            setClinicID(e.target.value);
                        }}
                    />
                    <PatientRequestInput
                        header={'Data type:'}
                        placeHolder={"Medical, dental, DICOM, or complete record"}
                        value={dataType}
                        onChange={(e) => setDataType(e.target.value)}
                    />
                    <PatientRequestInput
                        header={'Purpose:'}
                        placeHolder={"Clinical reason for access"}
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                    />
                    <PatientRequestInput
                        header={'Notes:'}
                        placeHolder={"Optional supporting details"}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                    {status.error && <p role="alert" className="w-full rounded bg-red-50 p-2 text-sm text-red-800">{status.error}</p>}
                    {status.notice && <p role="status" className="w-full rounded bg-green-50 p-2 text-sm text-green-800">{status.notice}</p>}
                    <RequestPatientCardSubmit onClick={handleSubmit} disabled={status.loading} />
                </div>
            </div>
        </div>
    );
};

export default RequestPatientCard;
