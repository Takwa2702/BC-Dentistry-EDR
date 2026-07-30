import { useEffect, useRef, useState } from 'react';
import { authHeaders, databaseUrl, handleUnauthorizedResponse } from '../../config/api.js';

const emptyForm = { patientID: '', doctorID: '', appointmentDateTime: '', specialty: '', meetingFor: '', notes: '' };

const NewAppointmentDialog = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef(null);
  const firstField = useRef(null);

  useEffect(() => {
    firstField.current?.focus();
    Promise.all(['/patients', '/appointment-options/doctors'].map(async (path) => {
      const response = await fetch(databaseUrl(path), { headers: authHeaders() });
      handleUnauthorizedResponse(response);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load appointment options');
      return payload.data || [];
    })).then(([patientRows, doctorRows]) => { setPatients(patientRows); setDoctors(doctorRows); }).catch((reason) => setError(reason.message));

    const handleKey = (event) => {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key !== 'Tab' || !dialog.current) return;
      const controls = [...dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, saving]);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch(databaseUrl('/appointments'), { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(form) });
      handleUnauthorizedResponse(response);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to create appointment');
      setForm(emptyForm); onCreated?.(payload.data); onClose();
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title" className="my-auto max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-4 sm:px-7 sm:py-5">
        <div><h2 id="appointment-dialog-title" className="text-2xl font-bold text-gray-950">Create appointment</h2><p className="mt-1 text-sm text-gray-600">Schedule a clinic patient with an available doctor.</p></div>
        <button type="button" onClick={onClose} disabled={saving} className="rounded-md px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Close</button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-5 p-5 sm:p-7 md:grid-cols-2">
        <label className="text-sm font-semibold text-gray-800">Patient<select ref={firstField} required value={form.patientID} onChange={(event) => setForm({ ...form, patientID: event.target.value })} className="mt-2 block w-full rounded-lg border border-gray-300 bg-white p-3"><option value="">Select patient</option>{patients.map((patient) => <option key={patient.patientID} value={patient.patientID}>{patient.firstName} {patient.lastName} ({patient.patientID})</option>)}</select></label>
        <label className="text-sm font-semibold text-gray-800">Doctor<select required value={form.doctorID} onChange={(event) => { const doctor = doctors.find((item) => item.doctorID === event.target.value); setForm({ ...form, doctorID: event.target.value, specialty: doctor?.speciality || doctor?.specialty || '' }); }} className="mt-2 block w-full rounded-lg border border-gray-300 bg-white p-3"><option value="">Select doctor</option>{doctors.map((doctor) => <option key={doctor.doctorID} value={doctor.doctorID}>{doctor.firstName} {doctor.lastName} ({doctor.doctorID})</option>)}</select></label>
        <label className="text-sm font-semibold text-gray-800">Date and time<input required type="datetime-local" value={form.appointmentDateTime} onChange={(event) => setForm({ ...form, appointmentDateTime: event.target.value })} className="mt-2 block w-full rounded-lg border border-gray-300 p-3" /></label>
        <label className="text-sm font-semibold text-gray-800">Specialty<input required value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} className="mt-2 block w-full rounded-lg border border-gray-300 p-3" /></label>
        <label className="text-sm font-semibold text-gray-800 md:col-span-2">Reason<input required value={form.meetingFor} onChange={(event) => setForm({ ...form, meetingFor: event.target.value })} className="mt-2 block w-full rounded-lg border border-gray-300 p-3" /></label>
        <label className="text-sm font-semibold text-gray-800 md:col-span-2">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 block min-h-24 w-full resize-y rounded-lg border border-gray-300 p-3" /></label>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 md:col-span-2">{error}</p>}
        <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end md:col-span-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-5 py-3 font-semibold">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-900 px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Create appointment'}</button></div>
      </form>
    </div>
  </div>;
};

export default NewAppointmentDialog;
