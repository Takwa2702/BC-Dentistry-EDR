import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders, databaseUrl, jsonHeaders } from '../config/api.js';
import { clearSession } from '../utils/auth.js';

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    const response = await fetch(databaseUrl('/auth/sessions'), { headers: authHeaders() });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load active sessions');
    setSessions(payload.data || []);
  };

  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

  const revoke = async (sessionId, current) => {
    const response = await fetch(databaseUrl(`/auth/sessions/${encodeURIComponent(sessionId)}`), {
      method: 'DELETE', headers: authHeaders(),
    });
    if (!response.ok) return setMessage('Unable to revoke that session.');
    if (current) {
      clearSession(); navigate('/login', { replace: true }); return;
    }
    await load();
  };

  const logoutAll = async (event) => {
    event.preventDefault();
    const response = await fetch(databaseUrl('/auth/logout-all'), {
      method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ currentPassword: password }),
    });
    if (!response.ok) {
      const payload = await response.json();
      return setMessage(payload?.error?.message || 'Unable to log out all devices.');
    }
    clearSession(); navigate('/login', { replace: true });
  };

  return <section className="p-4 md:p-8">
    <h1 className="text-3xl font-semibold">Active sessions</h1>
    <p className="mt-2 text-gray-600">Review devices signed in to your account and revoke anything you do not recognize.</p>
    {message && <p role="alert" className="mt-4 text-red-700">{message}</p>}
    <div className="mt-6 grid gap-3">{sessions.map((session) => <article key={session.sessionId} className="rounded-xl bg-white p-5 shadow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">{session.deviceLabel || session.clientType}</h2>
          <p className="text-sm text-gray-600">{session.current ? 'Current session · ' : ''}Last used {new Date(session.lastSeenAt).toLocaleString()}</p></div>
        <button className="rounded border border-red-700 px-4 py-2 text-red-700" onClick={() => revoke(session.sessionId, session.current)}>Revoke</button>
      </div>
    </article>)}</div>
    <form onSubmit={logoutAll} className="mt-8 max-w-xl rounded-xl border border-red-200 bg-white p-5">
      <h2 className="text-xl font-semibold">Log out all devices</h2>
      <label className="mt-4 block">Confirm current password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded border p-3" /></label>
      <button className="mt-4 rounded bg-red-700 px-5 py-3 text-white">Log out all devices</button>
    </form>
  </section>;
}
