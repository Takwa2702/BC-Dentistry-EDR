import PatientsCards from "../Sections/Patients/PatientsCards";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import Lo from "../images/icons/calendar.svg";
import { authHeaders, databaseUrl } from "../config/api.js";
import { getStoredUser } from "../utils/auth.js";

const Patients = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAddPatientOpen, setAddPatientOpen] = useState(false);
    const addPatientButton = useRef(null);
    const closeAddPatient = () => { setAddPatientOpen(false); window.requestAnimationFrame(() => addPatientButton.current?.focus()); };
    const user = getStoredUser(); // Retrieve user details
    const role = user?.role?.toLowerCase();

    useEffect(() => {
        if (!user || !user.id || !user.role) {
            setError('Your session is missing required identity details. Please log in again.');
            setLoading(false);
            return;
        }

        const fetchPatients = async () => {
            try {
                let response;
                if (role === "admin" && user.organizationId) {
                    response = await axios.get(databaseUrl('/patients'), { headers: authHeaders() });
                } else if (role === "doctor" && user.blockchainID) {
                    response = await axios.get(databaseUrl('/doctor/me/assigned-patients'), { headers: authHeaders() });
                } else {
                    setError('Your account does not have a usable clinic or doctor identity.');
                    return;
                }
                setPatients(response.data.data || response.data);
            } catch (error) {
                setError(error.response?.data?.error?.message || 'Unable to load patients.');
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
    }, [user?.id, user?.role, user?.organizationId, user?.blockchainID, role]); // Run when persisted user changes

    if (!user) {
        return <div className="w-full border rounded-xl p-4 text-center">Please log in to view patients.</div>;
    }

    if (loading) return <div role="status" className="w-full border rounded-xl p-4 text-center">Loading patients…</div>;
    if (error) return <div role="alert" className="w-full border border-red-300 bg-red-50 rounded-xl p-4 text-red-800">{error}</div>;

    return (
        <div id="Patients" className="w-full">
            <div className="flex flex-col w-full gap-y-4">
                <div className="flex items-center border bg-white px-4 py-4 rounded-xl w-full justify-between">
                    <h1 className="patients-header text-2xl font-bold">Patients</h1>

                    {role === "admin" && (
                        <div className="new-patient bg-gradient-to-r from-blue-800 to-blue-950 py-2 px-3 rounded-md text-white flex items-center gap-x-3 w-fit">
                            <div className="icon">
                                <img className="w-5 h-5" src={Lo} alt="" />
                            </div>
                            <button ref={addPatientButton} type="button" onClick={() => setAddPatientOpen(true)} id="addNewPatientBtn" className="icon">Add a new Patient</button>
                        </div>
                    )}
                </div>
                <PatientsCards patients={patients} role={role} isAddPatientOpen={isAddPatientOpen} onCloseAddPatient={closeAddPatient} onChanged={() => window.location.reload()} />
            </div>
        </div>
    );
};

export default Patients;
