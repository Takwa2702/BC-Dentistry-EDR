import { useEffect, useState } from 'react';
import axios from 'axios';
import { authHeaders, databaseUrl, jsonHeaders } from '../../config/api.js';

const emptyMedical = { medicalHistory: '', allergies: '', labResults: '', medications: '' };
const emptyDental = { treatmentPhase: '', procedureCode: '', tooth: '', ceramicType: '', prescriptions: '', diagnostics: '' };

export default function ClinicalRecords({ patientID, role }) {
  const [medical, setMedical] = useState([]), [dental, setDental] = useState([]);
  const [type, setType] = useState('medical'), [form, setForm] = useState(emptyMedical), [message, setMessage] = useState('');
  const load = async () => {
    try {
      const [m,d] = await Promise.all(['medical','dental'].map(t => axios.get(databaseUrl(`/patients/${patientID}/clinical-records/${t}`), { headers: authHeaders(), params: { purpose: 'patient record view' } })));
      setMedical(m.data.data || []); setDental(d.data.data || []);
    } catch (e) { setMessage(e.response?.data?.error?.message || 'Unable to load clinical records.'); }
  };
  useEffect(() => { load(); }, [patientID]);
  const changeType = (value) => { setType(value); setForm(value === 'medical' ? emptyMedical : emptyDental); };
  const submit = async (e) => { e.preventDefault(); setMessage('Saving…'); try { await axios.post(databaseUrl('/clinical-records'), { patientID, recordType: type, payload: form }, { headers: jsonHeaders() }); setMessage('Clinical record saved and anchored on Fabric.'); setForm(type === 'medical' ? emptyMedical : emptyDental); await load(); } catch (err) { setMessage(err.response?.data?.error?.message || 'Unable to save clinical record.'); } };
  const render = (title, records) => <div><h3 className="font-semibold text-lg">{title}</h3>{!records.length ? <p className="text-slate-500">No records available.</p> : records.map(r => <div key={r.recordID} className="border rounded p-3 my-2"><p className="text-xs font-mono break-all">{r.recordID} · SHA-256 {r.dataHash}</p>{Object.entries(r.payload || {}).map(([k,v]) => <p key={k}><strong>{k}:</strong> {Array.isArray(v) ? v.join(', ') : String(v)}</p>)}</div>)}</div>;
  const fields = Object.keys(form);
  return <section className="bg-white rounded-md p-5"><h2 className="text-xl font-bold">Clinical Records</h2>{message && <p className="my-2">{message}</p>}{role === 'doctor' && <form onSubmit={submit} className="my-4 grid gap-3"><select value={type} onChange={e=>changeType(e.target.value)} className="border rounded p-2"><option value="medical">Medical record</option><option value="dental">Dental chart entry</option></select>{fields.map(f => <label key={f} className="grid gap-1"><span>{f}</span><input required className="border rounded p-2" value={form[f]} onChange={e=>setForm({...form,[f]:e.target.value})}/></label>)}<button className="bg-blue-600 text-white rounded p-2">Add record</button></form>}<div className="grid gap-5">{render('Medical history, allergies, labs & medications', medical)}{render('Dental chart history', dental)}</div></section>;
}
