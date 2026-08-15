import { useEffect, useRef, useState } from 'react';
import Select from 'react-select';
import { authHeaders, databaseUrl, handleUnauthorizedResponse } from '../../config/api.js';

const emptyForm = { patientID: '', doctorID: '', appointmentDateTime: '', durationMinutes: '', specialty: '', meetingFor: '', notes: '' };

const NewAppointmentDialog = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [clinic, setClinic] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef(null);
  const firstField = useRef(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    firstField.current?.focus();
    Promise.all(['/clinic/me', '/patients?operationalOnly=true', '/appointment-options/doctors'].map(async (path) => {
      const response = await fetch(databaseUrl(path), { headers: authHeaders() });
      handleUnauthorizedResponse(response);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load appointment options');
      return payload.data || [];
    })).then(([clinicDetails, patientRows, doctorRows]) => { setClinic(clinicDetails); setPatients(patientRows); setDoctors(doctorRows); }).catch((reason) => setError(reason.message));

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
      const response = await fetch(databaseUrl('/appointments'), { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json', 'Idempotency-Key':idempotencyKey.current }), body: JSON.stringify(form) });
      handleUnauthorizedResponse(response);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to create appointment');
      setForm(emptyForm); onCreated?.(payload.data); onClose();
    } catch (reason) { setError(reason.message); } finally { setSaving(false); }
  };

  const patientOptions = patients.map((patient) => ({
    value: patient.patientID,
    label: `${patient.firstName} ${patient.lastName} — ${patient.emiratesID || patient.email || patient.contactNumber || 'contact details unavailable'}`,
  }));
  const doctorOptions = doctors.map((doctor) => ({ value: doctor.doctorID, label: `${doctor.firstName} ${doctor.lastName} — ${doctor.speciality || doctor.specialty || 'Specialty not recorded'} (${doctor.doctorID})` }));

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title" className="my-auto max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-4 sm:px-7 sm:py-5">
        <div><h2 id="appointment-dialog-title" className="text-2xl font-bold text-gray-950">Create appointment</h2><p className="mt-1 text-sm text-gray-600">Schedule a clinic patient with an available doctor.</p></div>
        <button type="button" onClick={onClose} disabled={saving} className="rounded-md px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">Close</button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 gap-5 p-5 sm:p-7 md:grid-cols-2">
        <label className="text-sm font-semibold text-gray-800 md:col-span-2">Clinic<input ref={firstField} readOnly aria-readonly="true" value={clinic ? `${clinic.name} (Clinic ${clinic.clinicID})` : 'Loading clinic...'} className="mt-2 block w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 p-3 text-gray-700" /></label>
        <div className="text-sm font-semibold text-gray-800"><label htmlFor="appointment-patient">Patient</label><Select inputId="appointment-patient" required isSearchable options={patientOptions} value={patientOptions.find((option) => option.value === form.patientID) || null} onChange={(option) => setForm({ ...form, patientID: option?.value || '' })} placeholder="Search clinic patients" /></div>
        <div className="text-sm font-semibold text-gray-800"><label htmlFor="appointment-doctor">Doctor</label><Select inputId="appointment-doctor" required isSearchable options={doctorOptions} value={doctorOptions.find((option) => option.value === form.doctorID) || null} onChange={(option) => { const doctor = doctors.find((item) => item.doctorID === option?.value); setForm({ ...form, doctorID: option?.value || '', specialty: doctor?.speciality || doctor?.specialty || '' }); }} placeholder="Search clinic doctors" /></div>
        <label className="text-sm font-semibold text-gray-800">Date and time<input required type="datetime-local" value={form.appointmentDateTime} onChange={(event) => setForm({ ...form, appointmentDateTime: event.target.value })} className="mt-2 block w-full rounded-lg border border-gray-300 p-3" /></label>
        <label className="text-sm font-semibold text-gray-800">Duration<select value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value ? Number(event.target.value) : '' })} className="mt-2 block w-full rounded-lg border border-gray-300 p-3"><option value="">Clinic default</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option></select></label>
        <label className="text-sm font-semibold text-gray-800">Specialty<input required readOnly aria-readonly="true" value={form.specialty} className="mt-2 block w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 p-3 text-gray-700" /></label>
        <label className="text-sm font-semibold text-gray-800 md:col-span-2">Reason<input required maxLength={255} value={form.meetingFor} onChange={(event) => setForm({ ...form, meetingFor: event.target.value })} className="mt-2 block w-full rounded-lg border border-gray-300 p-3" /></label>
        <label className="text-sm font-semibold text-gray-800 md:col-span-2">Notes (maximum 2,000 characters)<textarea maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-2 block min-h-24 w-full resize-y rounded-lg border border-gray-300 p-3" /></label>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 md:col-span-2">{error}</p>}
        <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end md:col-span-2"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-5 py-3 font-semibold">Cancel</button><button disabled={saving || !clinic || !form.patientID || !form.doctorID} className="rounded-lg bg-blue-900 px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Create appointment'}</button></div>
      </form>
    </div>
  </div>;
};

export default NewAppointmentDialog;
