import { useEffect, useRef, useState } from 'react';
import { apiPayloadMessage, databaseUrl, jsonHeaders } from '../../config/api.js';

const initialForm = { patientLookupType: 'email', patientLookupValue: '', dataType: 'Medical and Dental Records', purpose: '', urgency: 'routine', expiresAt: '', notes: '' };

export default function RequestDataAccessDialog({ onClose }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ busy: false, error: '', result: null });
  const [referrals, setReferrals] = useState([]);
  const [completion, setCompletion] = useState({ requestID: '', summary: '', busy: false, error: '' });

  useEffect(() => {
    dialog.current?.querySelector('input')?.focus();
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !status.busy) onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, status.busy]);

  useEffect(() => {
    fetch(databaseUrl('/referrals'), { headers: jsonHeaders() })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(apiPayloadMessage(payload, 'Unable to load referrals.')); return payload.data || []; })
      .then(setReferrals)
      .catch(() => setReferrals([]));
  }, [status.result, completion.busy]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setStatus({ busy: true, error: '', result: null });
    try {
      const response = await fetch(databaseUrl('/requestDataAccess'), {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ workflowType: 'REFERRAL', patientLookupType: form.patientLookupType, patientLookupValue: form.patientLookupValue.trim(), dataType: form.dataType, purpose: form.purpose.trim(), reason: form.purpose.trim(), urgency: form.urgency, expiresAt: new Date(`${form.expiresAt}T23:59:59`).toISOString(), notes: form.notes.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiPayloadMessage(payload, 'Unable to submit the data-access request.'));
      setStatus({ busy: false, error: '', result: payload.data });
    } catch (error) { setStatus({ busy: false, error: error.message || 'Unable to submit the data-access request.', result: null }); }
  };

  const completeReferral = async (event) => {
    event.preventDefault();
    setCompletion((current) => ({ ...current, busy: true, error: '' }));
    try {
      const response = await fetch(databaseUrl(`/referrals/${encodeURIComponent(completion.requestID)}/complete`), {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ completionSummary: completion.summary.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiPayloadMessage(payload, 'Unable to complete the referral.'));
      setCompletion({ requestID: '', summary: '', busy: false, error: '' });
    } catch (error) { setCompletion((current) => ({ ...current, busy: false, error: error.message || 'Unable to complete the referral.' })); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && !status.busy && onClose()}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="request-access-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 id="request-access-title" className="text-2xl font-bold">Create cross-clinic referral</h2><p className="mt-1 text-sm text-slate-600">The data-origin clinic reviews the referral first, followed by the patient. Access is limited by record scope and expiry and does not transfer the patient.</p></div><button type="button" onClick={onClose} disabled={status.busy} className="rounded border px-3 py-2">Close</button></div>
      {status.result ? <section className="mt-6 rounded border border-green-300 bg-green-50 p-4" role="status"><h3 className="font-semibold text-green-900">{status.result.alreadyPending ? 'Existing referral reused' : 'Request submitted'}</h3>{status.result.alreadyPending && <p className="mt-2 text-sm text-green-900">An active referral already exists for this doctor, patient, and holding clinic. No duplicate request or notification was created.</p>}<dl className="mt-2 grid gap-1 text-sm"><div><dt className="inline font-semibold">Request ID: </dt><dd className="inline break-all">{status.result.requestID}</dd></div><div><dt className="inline font-semibold">Status: </dt><dd className="inline">{status.result.status}</dd></div><div><dt className="inline font-semibold">Holding clinic: </dt><dd className="inline">{status.result.dataOriginClinicID}</dd></div></dl><button type="button" className="mt-4 rounded bg-blue-800 px-4 py-2 text-white" onClick={() => { setForm(initialForm); setStatus({ busy: false, error: '', result: null }); }}>Create another request</button></section> :
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]"><label className="font-semibold">Find patient by<select required value={form.patientLookupType} onChange={update('patientLookupType')} className="mt-1 block w-full rounded border p-3 font-normal"><option value="email">Email</option><option value="phone">Phone number</option><option value="emiratesid">Emirates ID</option></select></label><label className="font-semibold">Patient identifier<input required maxLength={254} type={form.patientLookupType === 'email' ? 'email' : 'text'} value={form.patientLookupValue} onChange={update('patientLookupValue')} placeholder={form.patientLookupType === 'email' ? 'patient@example.com' : form.patientLookupType === 'phone' ? '0501234567' : '784-1985-1234567-1'} className="mt-1 block w-full rounded border p-3 font-normal" /><span className="mt-1 block text-xs font-normal text-slate-600">Enter an exact value. The internal patient ID and data-origin clinic are resolved securely by the server.</span></label></div>
        <label className="font-semibold">Data scope<select required value={form.dataType} onChange={update('dataType')} className="mt-1 block w-full rounded border p-3 font-normal"><option>Medical and Dental Records</option><option>Medical Records</option><option>Dental Records</option><option>DICOM and Radiographic Files</option></select></label>
        <label className="font-semibold">Clinical purpose<textarea required maxLength={500} value={form.purpose} onChange={update('purpose')} placeholder="Explain why access is required for patient care" className="mt-1 block min-h-24 w-full rounded border p-3 font-normal" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="font-semibold">Urgency<select required value={form.urgency} onChange={update('urgency')} className="mt-1 block w-full rounded border p-3 font-normal"><option value="routine">Routine</option><option value="urgent">Urgent</option></select></label><label className="font-semibold">Referral access expires<input required type="date" min={new Date().toISOString().slice(0, 10)} value={form.expiresAt} onChange={update('expiresAt')} className="mt-1 block w-full rounded border p-3 font-normal" /></label></div>
        <label className="font-semibold">Supporting notes (optional)<textarea maxLength={1000} value={form.notes} onChange={update('notes')} className="mt-1 block min-h-20 w-full rounded border p-3 font-normal" /></label>
        {status.error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{status.error}</p>}
        <button disabled={status.busy} className="rounded bg-blue-800 px-5 py-3 font-semibold text-white disabled:opacity-60">{status.busy ? 'Submitting…' : 'Submit referral request'}</button>
      </form>}
      <section className="mt-8 border-t pt-6"><h3 className="text-xl font-bold">My referral lifecycle</h3><p className="mt-1 text-sm text-slate-600">Completing a referral closes future cross-clinic access. The completion summary remains part of the referral history.</p>
        <div className="mt-4 grid gap-3">{referrals.length === 0 ? <p className="text-sm text-slate-600">No referrals found.</p> : referrals.map((referral) => <article key={referral.requestID} className="rounded border p-3 text-sm"><div className="font-semibold">Patient referral · {referral.dataType}</div><div>Status: {String(referral.status).replaceAll('_', ' ')}</div><div>Purpose: {referral.purpose}</div><div>Expires: {referral.expiresAt ? new Date(referral.expiresAt).toLocaleDateString() : 'Not set'}</div>{referral.status === 'ACTIVE' && <button type="button" onClick={() => setCompletion({ requestID: referral.requestID, summary: '', busy: false, error: '' })} className="mt-2 rounded border border-blue-800 px-3 py-2 text-blue-900">Complete treatment</button>}</article>)}</div>
        {completion.requestID && <form onSubmit={completeReferral} className="mt-4 rounded border border-blue-200 bg-blue-50 p-4"><label className="font-semibold">Completion summary<textarea required maxLength={2000} value={completion.summary} onChange={(event) => setCompletion((current) => ({ ...current, summary: event.target.value }))} className="mt-1 block min-h-24 w-full rounded border bg-white p-3 font-normal" placeholder="Summarize treatment delivered, results, and follow-up instructions" /></label>{completion.error && <p role="alert" className="mt-2 text-red-700">{completion.error}</p>}<div className="mt-3 flex gap-2"><button disabled={completion.busy} className="rounded bg-blue-900 px-4 py-2 text-white">{completion.busy ? 'Closing…' : 'Close referral'}</button><button type="button" disabled={completion.busy} onClick={() => setCompletion({ requestID: '', summary: '', busy: false, error: '' })} className="rounded border px-4 py-2">Cancel</button></div></form>}
      </section>
    </div>
  </div>;
}
