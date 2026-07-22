import PatientsCards from '../Sections/Patients/PatientsCards';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import Lo from '../images/icons/calendar.svg';
import { authHeaders, databaseUrl } from '../config/api.js';
import { getStoredUser } from '../utils/auth.js';

const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddPatientOpen, setAddPatientOpen] = useState(false);
  const addPatientButton = useRef(null);
  const user = getStoredUser();
  const role = user?.role?.toLowerCase();
  const closeAddPatient = () => { setAddPatientOpen(false); window.requestAnimationFrame(() => addPatientButton.current?.focus()); };

  const fetchPatients = useCallback(async () => {
    if (!user?.id || !user?.role) { setError('Your session is missing required identity details. Please log in again.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      let response;
      if (role === 'admin' && user.organizationId) response = await axios.get(databaseUrl('/patients'), { headers: authHeaders() });
      else if (role === 'doctor' && user.blockchainID) response = await axios.get(databaseUrl('/doctor/me/assigned-patients'), { headers: authHeaders() });
      else throw new Error('Your account does not have a usable clinic or doctor identity.');
      setPatients(response.data.data || response.data);
    } catch (requestError) { setError(requestError.response?.data?.error?.message || requestError.message || 'Unable to load patients.'); }
    finally { setLoading(false); }
  }, [user?.id, user?.role, user?.organizationId, user?.blockchainID, role]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  if (!user) return <div className="w-full rounded-xl border p-4 text-center">Please log in to view patients.</div>;

  return <div id="Patients" className="w-full">
    <div className="flex w-full flex-col gap-y-4">
      <div className="flex w-full items-center justify-between rounded-xl border bg-white px-4 py-4">
        <h1 className="patients-header text-2xl font-bold">Patients</h1>
        {role === 'admin' && <div className="new-patient flex w-fit items-center gap-x-3 rounded-md bg-gradient-to-r from-blue-800 to-blue-950 px-3 py-2 text-white"><img className="h-5 w-5" src={Lo} alt="" /><button ref={addPatientButton} type="button" onClick={() => setAddPatientOpen(true)} id="addNewPatientBtn">Add a new Patient</button></div>}
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</div>}
      {loading ? <div role="status" className="rounded-xl border p-4 text-center">Loading patients…</div> : <PatientsCards patients={patients} role={role} isAddPatientOpen={isAddPatientOpen} onCloseAddPatient={closeAddPatient} onChanged={fetchPatients} />}
    </div>
  </div>;
};

export default Patients;
