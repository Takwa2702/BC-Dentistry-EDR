import { useEffect, useState } from 'react';
import { databaseUrl, jsonHeaders } from '../config/api.js';

const initial = { name:'', address:'', description:'', coordinates:'', type:'Dental Clinic', admin:{ firstName:'', lastName:'', email:'', contactNumber:'', password:'' } };
const message = (payload, fallback) => payload?.error?.message || payload?.error || fallback;

export default function Clinics() {
  const [clinics,setClinics]=useState([]); const [form,setForm]=useState(initial); const [error,setError]=useState(''); const [notice,setNotice]=useState(''); const [saving,setSaving]=useState(false);
  const load=async()=>{ try { const r=await fetch(databaseUrl('/clinics'),{headers:jsonHeaders()}); const p=await r.json(); if(!r.ok) throw new Error(message(p,'Unable to load clinics')); setClinics(p.data||[]); } catch(e){setError(e.message);} };
  useEffect(()=>{load();},[]);
  const setAdmin=(field,value)=>setForm({...form,admin:{...form.admin,[field]:value}});
  const submit=async(e)=>{e.preventDefault();setSaving(true);setError('');setNotice('');try{const r=await fetch(databaseUrl('/clinics'),{method:'POST',headers:jsonHeaders(),body:JSON.stringify(form)});const p=await r.json();if(!r.ok)throw new Error(message(p,'Unable to create clinic'));setNotice('Clinic and its required Clinic Admin were created. The admin must change the temporary password on first login.');setForm(initial);await load();}catch(err){setError(err.message);}finally{setSaving(false);}};
  const toggle=async(clinic)=>{setError('');try{const r=await fetch(databaseUrl(`/clinics/${clinic.clinicID}`),{method:'PATCH',headers:jsonHeaders(),body:JSON.stringify({...clinic,isActive:!clinic.isActive})});const p=await r.json();if(!r.ok)throw new Error(message(p,'Unable to update clinic'));await load();}catch(e){setError(e.message);}};
  const input=(label,key,type='text')=><label className="block">{label}<input type={type} required={['name','address'].includes(key)} value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} className="mt-1 w-full rounded border p-2" /></label>;
  const adminInput=(label,key,type='text')=><label className="block">{label}<input type={type} required value={form.admin[key]} onChange={(e)=>setAdmin(key,e.target.value)} className="mt-1 w-full rounded border p-2" /></label>;
  return <section className="p-4 md:p-8"><h1 className="text-3xl font-semibold">Clinic management</h1><p className="mt-2 text-gray-600">Clinics share the existing blockchain network. Every clinic requires exactly one Clinic Admin.</p>
    {error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}{notice&&<p role="status" className="mt-4 text-green-700">{notice}</p>}
    <form onSubmit={submit} className="mt-6 rounded-xl bg-white p-6 shadow"><h2 className="text-xl font-semibold">Create clinic</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{input('Clinic name','name')}{input('Address','address')}{input('Description','description')}{input('Coordinates','coordinates')}{input('Type','type')}</div>
      <h3 className="mt-6 text-lg font-semibold">Required Clinic Admin</h3><div className="mt-3 grid gap-4 md:grid-cols-2">{adminInput('First name','firstName')}{adminInput('Last name','lastName')}{adminInput('Email','email','email')}{adminInput('Contact number','contactNumber','tel')}{adminInput('Temporary password','password','password')}</div><p className="mt-2 text-sm text-gray-600">At least 12 characters with uppercase, lowercase, number, and symbol.</p><button disabled={saving} className="mt-5 rounded bg-blue-700 px-5 py-3 text-white disabled:opacity-60">{saving?'Creating…':'Create clinic and admin'}</button></form>
    <div className="mt-8 overflow-x-auto rounded-xl bg-white shadow"><table className="w-full text-left"><thead><tr className="border-b"><th className="p-4">Clinic</th><th className="p-4">Address</th><th className="p-4">Admin</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{clinics.map(c=><tr className="border-b" key={c.clinicID}><td className="p-4">{c.name}</td><td className="p-4">{c.address}</td><td className="p-4">{c.adminCount}</td><td className="p-4">{c.isActive?'Active':'Inactive'}</td><td className="p-4"><button onClick={()=>toggle(c)} className="rounded border px-3 py-2">{c.isActive?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table></div>
  </section>;
}
