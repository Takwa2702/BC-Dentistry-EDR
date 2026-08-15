import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { databaseUrl, jsonHeaders } from '../../config/api.js';
import { getStoredUser } from '../../utils/auth.js';
import ActionDialog from '../ActionDialog.jsx';
import NewPatientDialog from './NewPatientDialog.jsx';

const PatientCard = ({ patientId, fullName, age, gender, insurance, patient, onChanged }) => {
  const isAdmin = getStoredUser()?.role?.toLowerCase() === 'admin';
  const isOperational = patient?.operationalAccess !== false;
  const [dialog, setDialog] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctorID, setDoctorID] = useState('');
  const [deactivationImpact, setDeactivationImpact] = useState(null);
  const [status, setStatus] = useState({ busy: false, error: '', notice: '' });

  useEffect(() => {
    if (dialog !== 'assign') return;
    fetch(databaseUrl('/appointment-options/doctors'), { headers: jsonHeaders() }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to load doctors');
      setDoctors(result.data || []);
    }).catch((error) => setStatus({ busy: false, error: error.message, notice: '' }));
  }, [dialog]);

  useEffect(() => {
    if (dialog !== 'delete') return;
    setDeactivationImpact(null);
    setStatus({ busy: true, error: '', notice: '' });
    fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}/deactivation-impact`), { headers: jsonHeaders() }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to calculate deactivation impact');
      setDeactivationImpact(result.data); setStatus({ busy: false, error: '', notice: '' });
    }).catch((error) => setStatus({ busy: false, error: error.message, notice: '' }));
  }, [dialog, patientId]);

  const assign = async () => {
    if (!doctorID) return setStatus({ busy: false, error: 'Select a doctor to continue.', notice: '' });
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const response = await fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}/assign`), { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ doctorID }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Assignment failed');
      const message = result?.message || 'Doctor assigned successfully.';
      setDialog(''); setStatus({ busy: false, error: '', notice: message }); onChanged?.({ ...result, message });
    } catch (error) { setStatus({ busy: false, error: error.message, notice: '' }); }
  };

  const unassign = async () => {
    if (!doctorID) return;
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const response = await fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}/unassign`), { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ doctorID }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Unassignment failed');
      const message = result?.message || 'Doctor unassigned successfully.';
      setDialog(''); setStatus({ busy: false, error: '', notice: message }); onChanged?.({ ...result, message });
    } catch (error) { setStatus({ busy: false, error: error.message, notice: '' }); }
  };

  const remove = async () => {
    if (!deactivationImpact) return setStatus({ busy: false, error: 'Dependency impact must load before deactivation.', notice: '' });
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const response = await fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}`), { method: 'DELETE', headers: jsonHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Delete failed');
      setDialog(''); onChanged?.();
    } catch (error) { setStatus({ busy: false, error: error.message, notice: '' }); }
  };

  return <div className="patient-card min-h-64 rounded-xl border bg-white p-6 flex flex-col gap-y-2 justify-between">
    <p className="text-sm text-gray-500">{patient?.emiratesID || patient?.email || patient?.contactNumber || 'Patient contact details unavailable'}</p>
    {!isOperational && <p role="status" className="rounded bg-amber-50 p-2 text-sm font-semibold text-amber-900">Transferred to Clinic {patient?.clinicID}. Historical directory entry — no clinical or administrative actions are permitted.</p>}
    <Link to={`/patients/${patientId}`}><h2 className="text-xl font-bold">{fullName}</h2></Link>
    <div><span className="font-semibold">Age: </span>{age} · {gender}</div>
    <div><span className="font-semibold">Insurance: </span>{insurance}</div>
    <Link className="text-sm font-semibold text-blue-700 underline" to={`/patients/${patientId}`}>View authorized patient record</Link>
    {status.notice && <p role="status" className="rounded bg-green-50 p-2 text-sm text-green-800">{status.notice}</p>}
    {isAdmin && isOperational && <div className="flex flex-wrap gap-2 text-sm"><button type="button" onClick={() => setDialog('edit')} className="rounded border p-2">Update</button><button type="button" onClick={() => { setDoctorID(''); setStatus({busy:false,error:'',notice:''}); setDialog('assign'); }} className="rounded border p-2">Assign</button>{(patient?.doctors || []).map((id) => <button key={id} type="button" onClick={() => { setDoctorID(id); setStatus({busy:false,error:'',notice:''}); setDialog('unassign'); }} className="rounded border p-2">Unassign {id}</button>)}<button type="button" onClick={() => { setStatus({busy:false,error:'',notice:''}); setDialog('delete'); }} className="rounded border border-red-600 p-2 text-red-700">Deactivate</button></div>}
    {dialog === 'edit' && <NewPatientDialog patient={patient} onClose={() => setDialog('')} onSaved={() => { setStatus({busy:false,error:'',notice:'Patient updated successfully.'}); onChanged?.(); }} />}
    {dialog === 'assign' && <ActionDialog title={`Assign doctor to ${fullName}`} description="Choose a doctor from this clinic. Repeating an existing assignment is safe and will not create a duplicate." confirmLabel="Assign doctor" busy={status.busy} error={status.error} onClose={() => setDialog('')} onConfirm={assign}><label className="text-sm font-semibold">Doctor<select value={doctorID} onChange={(event) => setDoctorID(event.target.value)} className="mt-2 block w-full rounded-md border p-3"><option value="">Select a doctor</option>{doctors.map((doctor) => { const assigned = (patient?.doctors || []).map(String).includes(String(doctor.doctorID)); return <option key={doctor.doctorID} value={doctor.doctorID}>{doctor.firstName} {doctor.lastName} ({doctor.doctorID}){assigned ? ' — already assigned' : ''}</option>; })}</select></label></ActionDialog>}
    {dialog === 'unassign' && <ActionDialog title={`Unassign doctor from ${fullName}?`} description={`Remove ${doctorID} from both patient and doctor assignment records.`} confirmLabel="Unassign doctor" busy={status.busy} error={status.error} onClose={() => setDialog('')} onConfirm={unassign} />}
    {dialog === 'delete' && <ActionDialog title={`Deactivate ${fullName}?`} description={deactivationImpact ? `This will cancel ${deactivationImpact.appointments.activeToCancel} active appointment(s), remove ${deactivationImpact.assignedDoctors} doctor assignment(s), preserve ${deactivationImpact.appointments.completedToPreserve + deactivationImpact.appointments.cancelledToPreserve} completed/cancelled appointment(s), preserve ${deactivationImpact.clinicalRecordsToPreserve} clinical record(s) and ${deactivationImpact.labResultsToPreserve} lab result(s), disable access, and retain ledger history.` : 'Checking linked appointments and clinical records before deactivation…'} confirmLabel="Deactivate patient" danger busy={status.busy} error={status.error} onClose={() => setDialog('')} onConfirm={remove} />}
  </div>;
};

export default PatientCard;
