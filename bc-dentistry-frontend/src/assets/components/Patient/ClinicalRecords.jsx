import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { authHeaders, databaseUrl, jsonHeaders } from '../../config/api.js';

const emptyMedical = { medicalHistory: '', allergies: '', labResults: '', medications: '' };
const emptyDental = { treatmentPhase: '', procedureCode: '', teeth: [], surfaces: [], ceramicType: '', prescriptions: '', diagnostics: '' };
const toothOptions = [
  ...[1,2,3,4].flatMap(quadrant => Array.from({length:8},(_,index)=>`${quadrant}${index+1}`)),
  ...[5,6,7,8].flatMap(quadrant => Array.from({length:5},(_,index)=>`${quadrant}${index+1}`)),
].map(value => ({ value, label:`Tooth ${value}` }));
const surfaceOptions = [
  ['W','Whole tooth'],['M','Mesial'],['D','Distal'],['O','Occlusal'],['I','Incisal'],
  ['B','Buccal'],['L','Lingual'],['P','Palatal'],['F','Facial'],
].map(([value,label]) => ({ value, label:`${label} (${value})` }));

export default function ClinicalRecords({ patientID, role }) {
  const [medical, setMedical] = useState([]), [dental, setDental] = useState([]);
  const [type, setType] = useState('medical'), [form, setForm] = useState(emptyMedical), [message, setMessage] = useState('');
  const [verification, setVerification] = useState({});
  const idempotencyKey = useRef(crypto.randomUUID());
  const load = async () => {
    // Protected records must not remain visible while access is being revalidated.
    // This is especially important when consent is revoked in another session.
    setMedical([]); setDental([]); setMessage('');
    try {
      const [m,d] = await Promise.all(['medical','dental'].map(t => axios.get(databaseUrl(`/patients/${patientID}/clinical-records/${t}`), { headers: authHeaders(), params: { purpose: 'patient record view' } })));
      setMedical(m.data.data || []); setDental(d.data.data || []);
    } catch (e) { setMessage(e.response?.data?.error?.message || 'Unable to load clinical records.'); }
  };
  useEffect(() => { load(); }, [patientID]);
  useEffect(() => {
    const revalidate = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => { window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate); };
  }, [patientID]);
  const changeType = (value) => { setType(value); setForm(value === 'medical' ? emptyMedical : emptyDental); setMessage(value === 'dental' ? dentalCodingRules : ''); };
  const submit = async (e) => { e.preventDefault(); if (type === 'dental' && (!form.teeth.length || !form.surfaces.length)) { setMessage('Select at least one tooth and one surface, or Whole tooth.'); return; } setMessage('Saving…'); try { await axios.post(databaseUrl('/clinical-records'), { patientID, recordType: type, payload: form }, { headers: jsonHeaders({ 'Idempotency-Key':idempotencyKey.current }) }); idempotencyKey.current=crypto.randomUUID(); setMessage('Clinical record saved and anchored on Fabric.'); setForm(type === 'medical' ? emptyMedical : emptyDental); await load(); } catch (err) { setMessage(err.response?.data?.error?.message || 'Unable to save clinical record.'); } };
  const verify = async (recordID) => {
    setVerification(current => ({ ...current, [recordID]: { status:'checking', message:'Verifying current content against Fabric…' } }));
    try {
      const response = await axios.get(databaseUrl(`/clinical-records/${encodeURIComponent(recordID)}/verify-integrity`), { headers: authHeaders() });
      const result = response.data.data;
      setVerification(current => ({ ...current, [recordID]: { status:result.status, message:response.data.message, result } }));
    } catch (err) {
      setVerification(current => ({ ...current, [recordID]: { status:'error', message:err.response?.data?.error?.message || 'Integrity verification could not be completed. The record remains visible.' } }));
    }
  };
  const render = (title, records) => <div><h3 className="font-semibold text-lg">{title}</h3>{!records.length ? <p className="text-slate-500">No records available.</p> : records.map(r => <div key={r.recordID} className="border rounded p-3 my-2"><p className="text-xs font-mono break-all">{r.recordID} · SHA-256 {r.dataHash}</p>{Object.entries(r.payload || {}).map(([k,v]) => <p key={k}><strong>{k}:</strong> {Array.isArray(v) ? v.join(', ') : String(v)}</p>)}<button type="button" className="mt-2 border rounded px-3 py-1" onClick={() => verify(r.recordID)} disabled={verification[r.recordID]?.status === 'checking'}>Verify integrity</button>{verification[r.recordID] && <p className={`mt-2 text-sm ${verification[r.recordID].status === 'verified' ? 'text-green-700' : verification[r.recordID].status === 'checking' ? 'text-slate-600' : 'text-red-700'}`} role="status">{verification[r.recordID].message}</p>}</div>)}</div>;
  const fields = Object.keys(form);
  const dentalCodingRules = 'Teeth accept only two-digit FDI codes: 11-18, 21-28, 31-38, 41-48 and primary 51-55, 61-65, 71-75, 81-85. Surfaces accept only W, M, D, O, I, B, L, P or F. Tooth/site codes are exactly 2 characters and surface codes are exactly 1 character.';
  return <section className="bg-white rounded-md p-5"><h2 className="text-xl font-bold">Clinical Records</h2>{message && <p className="my-2">{message}</p>}{role === 'doctor' && <form onSubmit={submit} className="my-4 grid gap-3"><select value={type} onChange={e=>changeType(e.target.value)} className="border rounded p-2"><option value="medical">Medical record</option><option value="dental">Dental chart entry</option></select>{fields.map(f => f === 'teeth' || f === 'surfaces' ? <label key={f} className="grid gap-1"><span>{f === 'teeth' ? 'Teeth (FDI notation)' : 'Surfaces'}</span><Select isMulti isSearchable required options={f === 'teeth' ? toothOptions : surfaceOptions} value={(f === 'teeth' ? toothOptions : surfaceOptions).filter(option => form[f].includes(option.value))} onChange={(options,action)=>{ let values=options.map(option=>option.value); if (f === 'surfaces' && action.option?.value === 'W') values=['W']; else if (f === 'surfaces') values=values.filter(value=>value !== 'W'); setForm({...form,[f]:values}); }} placeholder={f === 'teeth' ? 'Select one or more teeth' : 'Select one or more surfaces'} /></label> : <label key={f} className="grid gap-1"><span>{f}</span><input required maxLength={4000} className="border rounded p-2" value={form[f]} onChange={e=>setForm({...form,[f]:e.target.value})}/></label>)}<p className="text-sm text-gray-600">Teeth use FDI notation. Surfaces are restricted to the displayed clinical codes; other fields are limited to 4,000 characters.</p><button className="bg-blue-600 text-white rounded p-2">Add record</button></form>}<div className="grid gap-5">{render('Medical history, allergies, labs & medications', medical)}{render('Dental chart history', dental)}</div></section>;
}
