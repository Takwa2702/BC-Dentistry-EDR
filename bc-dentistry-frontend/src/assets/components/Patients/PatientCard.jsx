import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { databaseUrl, jsonHeaders } from '../../config/api.js';
import { getStoredUser } from '../../utils/auth.js';
import ActionDialog from '../ActionDialog.jsx';
import NewPatientDialog from './NewPatientDialog.jsx';

const PatientCard = ({ patientId, fullName, age, gender, insurance, patient, onChanged }) => {
  const isAdmin = getStoredUser()?.role?.toLowerCase() === 'admin';
  const [dialog, setDialog] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctorID, setDoctorID] = useState('');
  const [status, setStatus] = useState({ busy: false, error: '', notice: '' });

  useEffect(() => {
    if (dialog !== 'assign') return;
    fetch(databaseUrl('/appointment-options/doctors'), { headers: jsonHeaders() }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to load doctors');
      setDoctors(result.data || []);
    }).catch((error) => setStatus({ busy: false, error: error.message, notice: '' }));
  }, [dialog]);

  const assign = async () => {
    if (!doctorID) return setStatus({ busy: false, error: 'Select a doctor to continue.', notice: '' });
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const response = await fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}/assign`), { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ doctorID }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Assignment failed');
      setDialog(''); setStatus({ busy: false, error: '', notice: 'Doctor assigned successfully.' }); onChanged?.();
    } catch (error) { setStatus({ busy: false, error: error.message, notice: '' }); }
  };

  const remove = async () => {
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const response = await fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}`), { method: 'DELETE', headers: jsonHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Delete failed');
      setDialog(''); onChanged?.();
    } catch (error) { setStatus({ busy: false, error: error.message, notice: '' }); }
  };

  return <div className="patient-card min-h-64 rounded-xl border bg-white p-6 flex flex-col gap-y-2 justify-between">
    <p className="text-sm text-gray-500">ID: {patientId}</p>
    <Link to={`/patients/${patientId}`}><h2 className="text-xl font-bold">{fullName}</h2></Link>
    <div><span className="font-semibold">Age: </span>{age} · {gender}</div>
    <div><span className="font-semibold">Insurance: </span>{insurance}</div>
    <Link className="text-sm font-semibold text-blue-700 underline" to={`/patients/${patientId}`}>View authorized patient record</Link>
    {status.notice && <p role="status" className="rounded bg-green-50 p-2 text-sm text-green-800">{status.notice}</p>}
    {isAdmin && <div className="flex gap-2 text-sm"><button type="button" onClick={() => setDialog('edit')} className="rounded border p-2">Update</button><button type="button" onClick={() => { setDoctorID(''); setStatus({busy:false,error:'',notice:''}); setDialog('assign'); }} className="rounded border p-2">Assign</button><button type="button" onClick={() => { setStatus({busy:false,error:'',notice:''}); setDialog('delete'); }} className="rounded border border-red-600 p-2 text-red-700">Delete</button></div>}
    {dialog === 'edit' && <NewPatientDialog patient={patient} onClose={() => setDialog('')} onSaved={() => { setStatus({busy:false,error:'',notice:'Patient updated successfully.'}); onChanged?.(); }} />}
    {dialog === 'assign' && <ActionDialog title={`Assign doctor to ${fullName}`} description="Choose a doctor from this clinic." confirmLabel="Assign doctor" busy={status.busy} error={status.error} onClose={() => setDialog('')} onConfirm={assign}><label className="text-sm font-semibold">Doctor<select value={doctorID} onChange={(event) => setDoctorID(event.target.value)} className="mt-2 block w-full rounded-md border p-3"><option value="">Select a doctor</option>{doctors.map((doctor) => <option key={doctor.doctorID} value={doctor.doctorID}>{doctor.firstName} {doctor.lastName} ({doctor.doctorID})</option>)}</select></label></ActionDialog>}
    {dialog === 'delete' && <ActionDialog title={`Delete ${fullName}?`} description="This permanently removes the patient identity and its Fabric metadata reference." confirmLabel="Delete patient" danger busy={status.busy} error={status.error} onClose={() => setDialog('')} onConfirm={remove} />}
  </div>;
};

export default PatientCard;
