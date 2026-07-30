import { useEffect, useRef, useState } from 'react';
import { databaseUrl, jsonHeaders } from '../../config/api.js';
import { getStoredUser } from '../../utils/auth.js';

const empty = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '', contactNumber: '', email: '', password: '',
  emiratesID: '', nationality: '', address: '', bloodType: '', medicalHistory: '', allergies: '', medications: '',
  insuranceProvider: '', policyNumber: '', coverageType: '', clinicID: '', doctors: []
};

const toForm = (patient, clinicID) => patient ? {
  ...empty, ...patient,
  dateOfBirth: String(patient.dateOfBirth || '').slice(0, 10),
  password: '',
  medicalHistory: (patient.medicalHistory || []).join('\n'),
  allergies: (patient.allergies || []).join('\n'),
  medications: (patient.medications || []).join('\n'),
  insuranceProvider: patient.insuranceDetails?.provider || '',
  policyNumber: patient.insuranceDetails?.policyNumber || '',
  coverageType: patient.insuranceDetails?.coverageType || '',
  doctors: patient.doctors || [],
  clinicID: patient.clinicID || clinicID || ''
} : { ...empty, clinicID: clinicID || '' };

const NewPatientDialog = ({ onClose, onSaved, patient = null }) => {
  const user = getStoredUser();
  const isEditing = Boolean(patient);
  const [form, setForm] = useState(() => toForm(patient, user?.organizationId));
  const [status, setStatus] = useState({ loading: false, error: '' });
  const [clinicDoctors, setClinicDoctors] = useState([]);
  const [doctorQuery, setDoctorQuery] = useState('');
  const [doctorOptionsError, setDoctorOptionsError] = useState('');
  const firstField = useRef(null);
  const dialog = useRef(null);
  const set = (name) => (event) => setForm((value) => ({ ...value, [name]: event.target.value }));

  useEffect(() => {
    firstField.current?.focus();
    const handleKeys = (event) => {
      if (event.key === 'Escape' && !status.loading) onClose();
      if (event.key !== 'Tab' || !dialog.current) return;
      const controls = [...dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')];
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeys);
    return () => document.removeEventListener('keydown', handleKeys);
  }, [onClose, status.loading]);

  useEffect(() => {
    fetch(databaseUrl('/appointment-options/doctors'), { headers: jsonHeaders() }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to load clinic doctors');
      setClinicDoctors(result.data || []);
    }).catch((error) => setDoctorOptionsError(error.message));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: '' });
    const payload = {
      ...form,
      clinicID: Number(form.clinicID),
      medicalHistory: form.medicalHistory.split('\n').map((value) => value.trim()).filter(Boolean),
      allergies: form.allergies.split('\n').map((value) => value.trim()).filter(Boolean),
      medications: form.medications.split('\n').map((value) => value.trim()).filter(Boolean),
      insuranceDetails: { provider: form.insuranceProvider, policyNumber: form.policyNumber, coverageType: form.coverageType },
      doctors: form.doctors
    };
    delete payload.insuranceProvider; delete payload.policyNumber; delete payload.coverageType;
    if (isEditing) delete payload.password;
    try {
      const response = await fetch(databaseUrl(isEditing ? `/patients/${encodeURIComponent(patient.patientID)}` : '/patients'), {
        method: isEditing ? 'PUT' : 'POST', headers: jsonHeaders(), body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || `Unable to ${isEditing ? 'update' : 'create'} patient`);
      onSaved?.(result.data);
      onClose();
    } catch (error) { setStatus({ loading: false, error: error.message }); }
  };

  const fields = [
    ['firstName','First name','text'], ['lastName','Last name','text'], ['dateOfBirth','Date of birth','date'],
    ['gender','Gender','text'], ['contactNumber','Contact number','tel'], ['email','Email','email'],
    ...(!isEditing ? [['password','Temporary password','password']] : []),
    ['emiratesID','Emirates ID','text'], ['nationality','Nationality','text'], ['address','Address','text'],
    ['bloodType','Blood type','text'], ['insuranceProvider','Insurance provider','text'], ['policyNumber','Policy number','text'],
    ['coverageType','Coverage type','text']
  ];
  const filteredDoctors = clinicDoctors.filter((doctor) => `${doctor.firstName} ${doctor.lastName} ${doctor.doctorID} ${doctor.speciality || doctor.specialty || ''}`.toLowerCase().includes(doctorQuery.toLowerCase()));
  const toggleDoctor = (doctorID) => setForm((value) => ({ ...value, doctors: value.doctors.includes(doctorID) ? value.doctors.filter((id) => id !== doctorID) : [...value.doctors, doctorID] }));

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && !status.loading && onClose()}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="patient-dialog-title" className="max-h-[90vh] w-[68em] max-w-[95vw] overflow-y-auto rounded-xl bg-white p-8 shadow-2xl">
      <form onSubmit={submit} aria-label={isEditing ? 'Edit patient' : 'Add patient'}>
        <div className="flex justify-between gap-4"><h1 id="patient-dialog-title" className="text-3xl font-bold">{isEditing ? 'Edit patient' : 'Add patient'}</h1><button type="button" onClick={onClose} disabled={status.loading} className="rounded-md px-3 py-2 font-semibold hover:bg-gray-100">Close</button></div>
        <p className="my-3 text-sm text-gray-600">Complete profile details are stored securely in the clinical database.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {fields.map(([name,label,type], index) => <label key={name} className="text-sm font-medium">{label}<input ref={index === 0 ? firstField : undefined} required className="mt-1 block w-full rounded-md border p-2" type={type} value={form[name]} onChange={set(name)} /></label>)}
          <fieldset className="rounded-lg border p-3 md:col-span-2 xl:col-span-3">
            <legend className="px-1 text-sm font-semibold">Clinic doctors</legend>
            <label className="text-sm font-medium">Search doctors<input type="search" role="combobox" aria-expanded="true" aria-controls="clinic-doctor-options" placeholder="Search by name, specialty, or doctor ID" value={doctorQuery} onChange={(event) => setDoctorQuery(event.target.value)} className="mt-1 block w-full rounded-md border p-3" /></label>
            {form.doctors.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Selected doctors">{form.doctors.map((doctorID) => { const doctor = clinicDoctors.find((item) => item.doctorID === doctorID); return <button key={doctorID} type="button" onClick={() => toggleDoctor(doctorID)} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900" aria-label={`Remove ${doctor?.firstName || doctorID}`}>{doctor ? `${doctor.firstName} ${doctor.lastName}` : doctorID} ×</button>; })}</div>}
            <div id="clinic-doctor-options" role="listbox" aria-multiselectable="true" className="mt-3 max-h-44 overflow-y-auto rounded-md border bg-white">
              {filteredDoctors.length ? filteredDoctors.map((doctor) => <label key={doctor.doctorID} className="flex cursor-pointer items-start gap-3 border-b p-3 last:border-b-0 hover:bg-gray-50"><input type="checkbox" checked={form.doctors.includes(doctor.doctorID)} onChange={() => toggleDoctor(doctor.doctorID)} className="mt-1" /><span><strong>{doctor.firstName} {doctor.lastName}</strong><span className="block text-xs text-gray-600">{doctor.speciality || doctor.specialty || 'Specialty not recorded'} · {doctor.doctorID}</span></span></label>) : <p className="p-3 text-sm text-gray-600">No clinic doctors match your search.</p>}
            </div>
            {doctorOptionsError && <p role="alert" className="mt-2 text-sm text-red-700">{doctorOptionsError}</p>}
          </fieldset>
          {['medicalHistory','allergies','medications'].map((name) => <label key={name} className="text-sm font-medium capitalize">{name.replace(/([A-Z])/g,' $1')} (one per line)<textarea required className="mt-1 block min-h-24 w-full rounded-md border p-2" value={form[name]} onChange={set(name)} /></label>)}
        </div>
        {status.error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-800">{status.error}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} disabled={status.loading} className="rounded-md border px-6 py-3 font-semibold">Cancel</button><button disabled={status.loading} className="rounded-md bg-[#000834] px-6 py-3 font-semibold text-white">{status.loading ? 'Saving…' : isEditing ? 'Save changes' : 'Create patient'}</button></div>
      </form>
    </div>
  </div>;
};

export default NewPatientDialog;
