import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { databaseUrl, jsonHeaders } from '../config/api.js';
import { getStoredUser } from '../utils/auth.js';

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const navigate = useNavigate();
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match.');
    setSaving(true);
    try {
      const response = await fetch(databaseUrl('/change-password'), { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to change password');
      localStorage.setItem('token', payload.token); localStorage.setItem('user', JSON.stringify(payload.user));
      navigate(payload.user.role === 'system' ? '/clinics' : payload.user.role === 'patient' ? '/my-record' : '/dashboard', { replace: true });
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  return <section className="mx-auto mt-16 max-w-xl rounded-xl bg-white p-8 shadow" aria-labelledby="change-password-title">
    <h1 id="change-password-title" className="text-2xl font-semibold">Change your password</h1>
    {getStoredUser()?.mustChangePassword && <p className="mt-2 text-amber-700">You must replace your temporary password before continuing.</p>}
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    <form className="mt-6 space-y-4" onSubmit={submit}>
      {[['currentPassword','Current password'],['newPassword','New password'],['confirmPassword','Confirm new password']].map(([name,label]) => <label key={name} className="block">{label}<input type="password" required value={form[name]} onChange={(e)=>setForm({...form,[name]:e.target.value})} className="mt-1 w-full rounded border p-3" /></label>)}
      <p className="text-sm text-gray-600">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
      <button disabled={saving} className="rounded bg-blue-700 px-5 py-3 text-white disabled:opacity-60">{saving ? 'Changing…' : 'Change password'}</button>
    </form>
  </section>;
}
