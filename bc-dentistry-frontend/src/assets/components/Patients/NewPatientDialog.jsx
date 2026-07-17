import { useEffect, useRef, useState } from 'react';
import { databaseUrl, jsonHeaders } from '../../config/api.js';
import { getStoredUser } from '../../utils/auth.js';

const empty = {
    firstName: '', lastName: '', dateOfBirth: '', gender: '', contactNumber: '', email: '', password: '',
    emiratesID: '', nationality: '', address: '', bloodType: '', medicalHistory: '', allergies: '', medications: '',
    insuranceProvider: '', policyNumber: '', coverageType: '', clinicID: '', doctors: ''
};

const NewPatientDialog = ({ onClose, onSaved }) => {
    const user = getStoredUser();
    const [form, setForm] = useState({ ...empty, clinicID: user?.organizationId || '' });
    const [status, setStatus] = useState({ loading: false, error: '' });
    const firstField = useRef(null);
    const dialog = useRef(null);
    const set = (name) => (event) => setForm((value) => ({ ...value, [name]: event.target.value }));

    useEffect(() => {
        firstField.current?.focus();
        const handleDialogKeys = (event) => {
            if (event.key === 'Escape' && !status.loading) onClose();
            if (event.key !== 'Tab') return;
            const controls = [...dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')];
            if (!controls.length) return;
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', handleDialogKeys);
        return () => document.removeEventListener('keydown', handleDialogKeys);
    }, [onClose, status.loading]);

    const submit = async (event) => {
        event.preventDefault(); setStatus({ loading: true, error: '' });
        const payload = {
            ...form,
            clinicID: Number(form.clinicID),
            medicalHistory: form.medicalHistory.split('\n').filter(Boolean),
            allergies: form.allergies.split('\n').filter(Boolean),
            medications: form.medications.split('\n').filter(Boolean),
            insuranceDetails: { provider: form.insuranceProvider, policyNumber: form.policyNumber, coverageType: form.coverageType },
            doctors: form.doctors.split(',').map((item) => item.trim()).filter(Boolean)
        };
        try {
            const response = await fetch(databaseUrl('/patients'), { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error?.message || 'Unable to create patient');
            setForm({ ...empty, clinicID: user?.organizationId || '' });
            onClose();
            onSaved?.(result.data);
        } catch (error) { setStatus({ loading: false, error: error.message }); return; }
        setStatus({ loading: false, error: '' });
    };

    const fields = [
        ['firstName','First name','text'], ['lastName','Last name','text'], ['dateOfBirth','Date of birth','date'],
        ['gender','Gender','text'], ['contactNumber','Contact number','tel'], ['email','Email','email'],
        ['password','Temporary password','password'], ['emiratesID','Emirates ID','text'], ['nationality','Nationality','text'],
        ['address','Address','text'], ['bloodType','Blood type (A+, O-, etc.)','text'], ['insuranceProvider','Insurance provider','text'],
        ['policyNumber','Policy number','text'], ['coverageType','Coverage type','text'], ['doctors','Doctor IDs (comma-separated)','text']
    ];
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !status.loading) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="add-patient-title" className="max-h-[90vh] w-[68em] max-w-[95vw] overflow-y-auto rounded-md bg-white p-8 drop-shadow-xl">
        <form onSubmit={submit} aria-label="Add patient">
            <div className="flex justify-between"><h1 id="add-patient-title" className="text-3xl font-bold">Add patient</h1><button type="button" onClick={onClose} disabled={status.loading} aria-label="Close add patient dialog">Close</button></div>
            <p className="my-3 text-sm text-gray-600">PII and clinical details are stored in MySQL. Fabric stores only a reference and SHA-256 hash.</p>
            <div className="grid grid-cols-3 gap-4">
                {fields.map(([name,label,type], index) => <label key={name} className="text-sm">{label}<input ref={index === 0 ? firstField : undefined} required className="block border rounded p-2 w-full" type={type} value={form[name]} onChange={set(name)} /></label>)}
                {['medicalHistory','allergies','medications'].map((name) => <label key={name} className="text-sm capitalize">{name.replace(/([A-Z])/g,' $1')} (one per line)<textarea required className="block border rounded p-2 w-full" value={form[name]} onChange={set(name)} /></label>)}
            </div>
            {status.error && <p role="alert" className="text-red-700 mt-3">{status.error}</p>}
            <button disabled={status.loading} className="bg-[#000834] text-white px-6 py-3 rounded mt-5">{status.loading ? 'Creating…' : 'Create patient'}</button>
        </form>
      </div>
    </div>;
};

export default NewPatientDialog;
