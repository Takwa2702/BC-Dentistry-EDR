import { useEffect, useState } from 'react';
import { apiPayloadMessage, databaseUrl, jsonHeaders } from '../config/api.js';
import ActionDialog from '../components/ActionDialog.jsx';

const blankAdmin = { firstName:'', lastName:'', email:'', contactNumber:'', password:'' };
const initial = { name:'', address:'', description:'', coordinates:'', type:'Dental Clinic', admin:{ ...blankAdmin } };
const clinicLimits = { name:255, address:1000, description:2000, coordinates:255, type:100 };
const adminLimits = { firstName:100, lastName:100, email:254, contactNumber:25, password:72 };

export default function Clinics() {
  const [clinics,setClinics]=useState([]);
  const [form,setForm]=useState(initial);
  const [selected,setSelected]=useState(null);
  const [admin,setAdmin]=useState(null);
  const [history,setHistory]=useState([]);
  const [transfer,setTransfer]=useState({ ...blankAdmin });
  const [transferConfirmed,setTransferConfirmed]=useState(false);
  const [resetPassword,setResetPassword]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [saving,setSaving]=useState(false);
  const [deactivatingClinic,setDeactivatingClinic]=useState(null); const [deactivationImpact,setDeactivationImpact]=useState(null);

  const request=async(path,options={})=>{
    const response=await fetch(databaseUrl(path),{headers:jsonHeaders(),...options});
    const payload=await response.json();
    if(!response.ok) throw new Error(apiPayloadMessage(payload,'Request failed.'));
    return payload;
  };
  const load=async()=>{ try { const payload=await request('/clinics'); setClinics(payload.data||[]); } catch(e){setError(e.message);} };
  useEffect(()=>{load();},[]);
  const setInitialAdmin=(field,value)=>setForm({...form,admin:{...form.admin,[field]:value}});
  const submit=async(e)=>{
    e.preventDefault();setSaving(true);setError('');setNotice('');
    try{await request('/clinics',{method:'POST',body:JSON.stringify(form)});setNotice('Clinic and its required Clinic Admin were created. The admin must change the temporary password on first login.');setForm(initial);await load();}
    catch(err){setError(err.message);}finally{setSaving(false);}
  };
  const toggle=async(clinic)=>{
    setError('');
    if(clinic.isActive){setDeactivatingClinic(clinic);setDeactivationImpact(null);setSaving(true);try{const payload=await request(`/clinics/${clinic.clinicID}/deactivation-impact`);setDeactivationImpact(payload.data);}catch(e){setError(e.message);setDeactivatingClinic(null);}finally{setSaving(false);}return;}
    try{await request(`/clinics/${clinic.clinicID}`,{method:'PATCH',body:JSON.stringify({...clinic,isActive:true})});await load();}
    catch(e){setError(e.message);}
  };
  const confirmClinicDeactivation=async()=>{if(!deactivatingClinic||!deactivationImpact)return;setSaving(true);setError('');try{const payload=await request(`/clinics/${deactivatingClinic.clinicID}`,{method:'PATCH',body:JSON.stringify({...deactivatingClinic,isActive:false})});setNotice(payload.message);setDeactivatingClinic(null);setDeactivationImpact(null);await load();}catch(e){setError(e.message);}finally{setSaving(false);}};
  const manage=async(clinic)=>{
    setSelected(clinic);setError('');setNotice('');setResetPassword('');setTransfer({ ...blankAdmin });setTransferConfirmed(false);
    try{
      const [admins,events]=await Promise.all([
        request(`/clinic-admins?clinicID=${clinic.clinicID}`),
        request(`/clinics/${clinic.clinicID}/admin-history`)
      ]);
      setAdmin(admins.data?.[0]||null);setHistory(events.data||[]);
    }catch(e){setError(e.message);}
  };
  const updateAdmin=async(e)=>{
    e.preventDefault();setSaving(true);setError('');
    try{await request(`/clinics/${selected.clinicID}/admin`,{method:'PATCH',body:JSON.stringify(admin)});setNotice('Clinic administrator profile updated.');await manage(selected);}
    catch(e){setError(e.message);}finally{setSaving(false);}
  };
  const resetAdminPassword=async(e)=>{
    e.preventDefault();setSaving(true);setError('');
    try{await request(`/clinics/${selected.clinicID}/admin/reset-password`,{method:'POST',body:JSON.stringify({password:resetPassword})});setNotice('Temporary password issued. Existing sessions were revoked and a password change is required.');setResetPassword('');await manage(selected);}
    catch(e){setError(e.message);}finally{setSaving(false);}
  };
  const transferOwnership=async(e)=>{
    e.preventDefault();
    if(!transferConfirmed){setError('Confirm that the current administrator will be deactivated and signed out.');return;}
    setSaving(true);setError('');
    try{await request(`/clinics/${selected.clinicID}/admin/transfer`,{method:'POST',body:JSON.stringify(transfer)});setNotice('Clinic ownership transferred. The replacement administrator must change the temporary password.');await manage(selected);await load();}
    catch(e){setError(e.message);}finally{setSaving(false);}
  };
  const input=(label,key,type='text')=><label className="block">{label}<input type={type} maxLength={clinicLimits[key]} required={['name','address'].includes(key)} value={form[key]} onChange={(e)=>setForm({...form,[key]:e.target.value})} className="mt-1 w-full rounded border p-2" /></label>;
  const adminInput=(label,key,type='text')=><label className="block">{label}<input type={type} minLength={key==='password'?12:undefined} maxLength={adminLimits[key]} pattern={key==='contactNumber'?'\\+?[0-9][0-9 ()-]{6,24}':undefined} required value={form.admin[key]} onChange={(e)=>setInitialAdmin(key,e.target.value)} className="mt-1 w-full rounded border p-2" /></label>;
  const managedInput=(label,key,type='text')=><label className="block">{label}<input type={type} maxLength={adminLimits[key]} pattern={key==='contactNumber'?'\\+?[0-9][0-9 ()-]{6,24}':undefined} required value={admin?.[key]||''} onChange={(e)=>setAdmin({...admin,[key]:e.target.value})} className="mt-1 w-full rounded border p-2" /></label>;
  const transferInput=(label,key,type='text')=><label className="block">{label}<input type={type} minLength={key==='password'?12:undefined} maxLength={adminLimits[key]} pattern={key==='contactNumber'?'\\+?[0-9][0-9 ()-]{6,24}':undefined} required value={transfer[key]} onChange={(e)=>setTransfer({...transfer,[key]:e.target.value})} className="mt-1 w-full rounded border p-2" /></label>;

  return <section className="p-4 md:p-8">
    <h1 className="text-3xl font-semibold">Clinic management</h1>
    <p className="mt-2 text-gray-600">Clinics share the existing blockchain network. Every clinic has exactly one current Clinic Admin.</p>
    {error&&<p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {notice&&<p role="status" className="mt-4 rounded bg-green-50 p-3 text-green-700">{notice}</p>}
    {deactivatingClinic&&<ActionDialog title={`Deactivate ${deactivatingClinic.name}?`} description={deactivationImpact?`This will deactivate ${deactivationImpact.actors.admins} admin(s), ${deactivationImpact.actors.doctors} doctor(s), and ${deactivationImpact.actors.patients} patient(s); cancel ${deactivationImpact.activeAppointmentsToCancel} active appointment(s) and ${deactivationImpact.activeRequestsToCancel} request(s); revoke sessions, push access, consent and Fabric identities; and preserve ${deactivationImpact.clinicalRecordsToPreserve} clinical record(s), ${deactivationImpact.labResultsToPreserve} lab result(s), and ledger history.`:'Calculating all clinic dependencies…'} confirmLabel="Deactivate clinic and cancel active items" danger busy={saving} error={error} onClose={()=>{setDeactivatingClinic(null);setDeactivationImpact(null);}} onConfirm={confirmClinicDeactivation}/>}
    <form onSubmit={submit} className="mt-6 rounded-xl bg-white p-6 shadow">
      <h2 className="text-xl font-semibold">Create clinic</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{input('Clinic name','name')}{input('Address','address')}{input('Description','description')}{input('Coordinates','coordinates')}{input('Type','type')}</div>
      <h3 className="mt-6 text-lg font-semibold">Required Clinic Admin</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-2">{adminInput('First name','firstName')}{adminInput('Last name','lastName')}{adminInput('Email','email','email')}{adminInput('Contact number','contactNumber','tel')}{adminInput('Temporary password','password','password')}</div>
      <p className="mt-2 text-sm text-gray-600">At least 12 characters with uppercase, lowercase, number, and symbol.</p>
      <button disabled={saving} className="mt-5 rounded bg-blue-700 px-5 py-3 text-white disabled:opacity-60">{saving?'Creating…':'Create clinic and admin'}</button>
    </form>
    <div className="mt-8 overflow-x-auto rounded-xl bg-white shadow">
      <table className="w-full text-left"><thead><tr className="border-b"><th className="p-4">Clinic</th><th className="p-4">Address</th><th className="p-4">Admin</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead>
        <tbody>{clinics.map(c=><tr className="border-b" key={c.clinicID}><td className="p-4">{c.name}</td><td className="p-4">{c.address}</td><td className="p-4">{c.adminCount}</td><td className="p-4">{c.isActive?'Active':'Inactive'}</td><td className="flex gap-2 p-4"><button type="button" onClick={()=>manage(c)} className="rounded border border-blue-300 px-3 py-2 text-blue-800">Manage admin</button><button type="button" onClick={()=>toggle(c)} className="rounded border px-3 py-2">{c.isActive?'Deactivate':'Activate'}</button></td></tr>)}</tbody>
      </table>
    </div>
    {selected&&admin&&<section className="mt-8 rounded-xl bg-white p-6 shadow" aria-labelledby="manage-admin-title">
      <div className="flex items-start justify-between gap-4"><div><h2 id="manage-admin-title" className="text-2xl font-semibold">Manage {selected.name} administrator</h2><p className="text-sm text-gray-600">Current owner: {admin.email} · {admin.isActive?'Active':'Inactive'}{admin.mustChangePassword?' · Password change required':''}</p></div><button type="button" onClick={()=>setSelected(null)} className="rounded border px-3 py-2">Close</button></div>
      <form onSubmit={updateAdmin} className="mt-5"><h3 className="text-lg font-semibold">Profile</h3><div className="mt-3 grid gap-4 md:grid-cols-2">{managedInput('First name','firstName')}{managedInput('Last name','lastName')}{managedInput('Email','email','email')}{managedInput('Contact number','contactNumber','tel')}</div><button disabled={saving} className="mt-4 rounded bg-blue-700 px-4 py-2 text-white">Save administrator</button></form>
      <form onSubmit={resetAdminPassword} className="mt-8 border-t pt-6"><h3 className="text-lg font-semibold">Issue temporary password</h3><p className="mt-1 text-sm text-gray-600">This revokes all active sessions and requires a password change at next login.</p><label className="mt-3 block max-w-xl">Temporary password<input type="password" required minLength={12} maxLength={72} value={resetPassword} onChange={(e)=>setResetPassword(e.target.value)} className="mt-1 w-full rounded border p-2" /></label><button disabled={saving} className="mt-3 rounded border border-blue-700 px-4 py-2 text-blue-800">Reset password and revoke sessions</button></form>
      <form onSubmit={transferOwnership} className="mt-8 border-t pt-6"><h3 className="text-lg font-semibold">Transfer ownership</h3><p className="mt-1 text-sm text-gray-600">Creates the replacement owner, deactivates the current owner, revokes their sessions, and keeps the change in history.</p><div className="mt-3 grid gap-4 md:grid-cols-2">{transferInput('First name','firstName')}{transferInput('Last name','lastName')}{transferInput('Email','email','email')}{transferInput('Contact number','contactNumber','tel')}{transferInput('Temporary password','password','password')}</div><label className="mt-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"><input type="checkbox" checked={transferConfirmed} onChange={(e)=>setTransferConfirmed(e.target.checked)} className="mt-1" />I understand the current administrator will be deactivated and immediately signed out.</label><button disabled={saving||!transferConfirmed} className="mt-4 rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50">Transfer ownership</button></form>
      <div className="mt-8 border-t pt-6"><h3 className="text-lg font-semibold">Administrator history</h3>{history.length===0?<p className="mt-2 text-sm text-gray-600">No administrator changes recorded yet.</p>:<ul className="mt-3 space-y-2">{history.map(event=><li key={event.eventID} className="rounded border p-3 text-sm"><strong>{event.eventType.replaceAll('_',' ')}</strong><span className="ml-2 text-gray-600">{new Date(event.occurredAt).toLocaleString()}</span>{event.details?.previousEmail&&<span className="block text-gray-600">{event.details.previousEmail} → {event.details.newEmail||event.details.email}</span>}</li>)}</ul>}</div>
    </section>}
  </section>;
}
