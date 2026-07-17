import { useEffect, useState } from 'react';
import { authHeaders, databaseUrl, handleUnauthorizedResponse } from '../../config/api.js';

const emptyForm = { patientID: '', doctorID: '', appointmentDateTime: '', specialty: '', meetingFor: '', notes: '' };

const NewAppointmentDialog = ({ reff, onCreated }) => {
    const [form, setForm] = useState(emptyForm);
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        Promise.all(['/patients', '/appointment-options/doctors'].map(async (path) => {
            const response = await fetch(databaseUrl(path), { headers: authHeaders() });
            handleUnauthorizedResponse(response);
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load appointment options');
            return payload.data || [];
        })).then(([patientRows, doctorRows]) => { setPatients(patientRows); setDoctors(doctorRows); }).catch((reason) => setError(reason.message));
    }, []);

    const close = () => reff.current?.classList.replace('-translate-y-1/2', 'translate-y-[30em]');
    const submit = async (event) => {
        event.preventDefault(); setSaving(true); setError('');
        try {
            const response = await fetch(databaseUrl('/appointments'), { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(form) });
            handleUnauthorizedResponse(response);
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error?.message || 'Unable to create appointment');
            setForm(emptyForm); onCreated?.(payload.data); close();
        } catch (reason) { setError(reason.message); } finally { setSaving(false); }
    };

    return (
        <div ref={reff} id="AddNewAppointmentDialog" role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title" className="fixed bg-white drop-shadow-xl w-[min(50em,90vw)] max-h-[85vh] overflow-auto inset-1/2 -translate-x-1/2 translate-y-[30em] z-50 rounded-lg p-8 transition-transform duration-500">
            <h2 id="appointment-dialog-title" className="text-2xl font-bold mb-6">Create appointment</h2>
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label>Patient<select required value={form.patientID} onChange={(e) => setForm({ ...form, patientID: e.target.value })} className="block w-full border p-2 rounded"><option value="">Select patient</option>{patients.map((p) => <option key={p.patientID} value={p.patientID}>{p.firstName} {p.lastName}</option>)}</select></label>
                <label>Doctor<select required value={form.doctorID} onChange={(e) => { const doctor = doctors.find((d) => d.doctorID === e.target.value); setForm({ ...form, doctorID: e.target.value, specialty: doctor?.specialty || form.specialty }); }} className="block w-full border p-2 rounded"><option value="">Select doctor</option>{doctors.map((d) => <option key={d.doctorID} value={d.doctorID}>{d.firstName} {d.lastName}</option>)}</select></label>
                <label>Date and time<input required type="datetime-local" value={form.appointmentDateTime} onChange={(e) => setForm({ ...form, appointmentDateTime: e.target.value })} className="block w-full border p-2 rounded" /></label>
                <label>Specialty<input required value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="block w-full border p-2 rounded" /></label>
                <label>Reason<input required value={form.meetingFor} onChange={(e) => setForm({ ...form, meetingFor: e.target.value })} className="block w-full border p-2 rounded" /></label>
                <label>Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="block w-full border p-2 rounded" /></label>
                {error && <p role="alert" className="md:col-span-2 text-red-700">{error}</p>}
                <div className="md:col-span-2 flex justify-end gap-3"><button type="button" onClick={close} className="border px-4 py-2 rounded">Cancel</button><button disabled={saving} className="bg-blue-900 text-white px-4 py-2 rounded">{saving ? 'Saving…' : 'Create appointment'}</button></div>
            </form>
        </div>
    );
};

export default NewAppointmentDialog;
