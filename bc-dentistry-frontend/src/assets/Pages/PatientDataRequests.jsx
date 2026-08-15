import { useEffect, useMemo, useState } from 'react';
import ActionDialog from '../components/ActionDialog.jsx';
import { apiPayloadMessage, authHeaders, databaseUrl, jsonHeaders } from '../config/api.js';
import { getStoredUser } from '../utils/auth.js';

const displayStatus = (request) => request.status === 'CONSENT_GRANTED' || request.lifecycleStatus === 'ACTIVE'
  ? 'Consent granted'
  : String(request.status || 'Unknown').replaceAll('_', ' ').toLowerCase().replace(/^./, (value) => value.toUpperCase());

const RequestCard = ({ request, children }) => <article id={`request-${request.requestID}`} className="rounded-xl border bg-white p-5 shadow-sm">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h3 className="text-lg font-bold">{request.doctorName || 'Requesting doctor'}</h3><p className="text-sm text-slate-600">{request.requestingClinicName || request.doctorClinicName || 'External clinic'}</p></div>
    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{displayStatus(request)}</span>
  </div>
  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
    <div><dt className="font-semibold">Record scope</dt><dd>{request.dataType || 'Clinical records'}</dd></div>
    <div><dt className="font-semibold">Requested</dt><dd>{request.requestedAt ? new Date(request.requestedAt).toLocaleString() : 'Not recorded'}</dd></div>
    <div className="sm:col-span-2"><dt className="font-semibold">Clinical purpose</dt><dd className="whitespace-pre-wrap">{request.purpose || request.reason || 'Not supplied'}</dd></div>
    {request.rejectionReason && <div className="sm:col-span-2"><dt className="font-semibold">Decision reason</dt><dd className="whitespace-pre-wrap">{request.rejectionReason}</dd></div>}
    {(request.decisionTransactionID || request.consentTxID || request.rejectionTxID || request.revocationTxID) && <div className="sm:col-span-2 rounded border bg-slate-50 p-3"><dt className="font-semibold">Ledger decision evidence</dt><dd className="mt-1 break-all font-mono text-xs">Transaction: {request.decisionTransactionID || request.consentTxID || request.rejectionTxID || request.revocationTxID}</dd><dd className="mt-1">Actor: {request.decisionActorID || request.consentActorID || request.rejectedBy || request.patientID} ({request.decisionActorRole || request.rejectedRole || 'patient'})</dd><dd>Recorded: {request.decisionTimestamp || request.patientConsentedAt || request.rejectedAt || request.revokedAt ? new Date(request.decisionTimestamp || request.patientConsentedAt || request.rejectedAt || request.revokedAt).toLocaleString() : 'Not recorded'}</dd></div>}
    {request.completionSummary && <div className="sm:col-span-2"><dt className="font-semibold">Treatment outcome</dt><dd className="whitespace-pre-wrap">{request.completionSummary}</dd></div>}
  </dl>
  {children && <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">{children}</div>}
</article>;

export default function PatientDataRequests() {
  const patientID = getStoredUser()?.blockchainID;
  const [requests, setRequests] = useState([]);
  const [state, setState] = useState({ loading: true, error: '', notice: '' });
  const [decision, setDecision] = useState(null);

  const load = async () => {
    if (!patientID) return setState({ loading: false, error: 'Your patient account is missing its record identity.', notice: '' });
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await fetch(databaseUrl(`/getAllRequestsForPatient/${encodeURIComponent(patientID)}`), { headers: authHeaders() });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiPayloadMessage(payload, 'Unable to load data requests.'));
      setRequests(payload.data || payload || []);
      setState((current) => ({ ...current, loading: false }));
    } catch (error) { setState({ loading: false, error: error.message, notice: '' }); }
  };

  useEffect(() => { load(); }, [patientID]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [patientID]);

  const groups = useMemo(() => ({
    pending: requests.filter((request) => request.status === 'PENDING_PATIENT_CONSENT'),
    granted: requests.filter((request) => request.status === 'CONSENT_GRANTED' || request.lifecycleStatus === 'ACTIVE'),
    history: requests.filter((request) => !['PENDING_PATIENT_CONSENT', 'CONSENT_GRANTED', 'ACTIVE'].includes(request.status) && request.lifecycleStatus !== 'ACTIVE'),
  }), [requests]);

  const submitDecision = async () => {
    const isGrant = decision.action === 'grant';
    const isReject = decision.action === 'reject';
    const path = isGrant ? '/grantConsent' : isReject ? '/patient/rejectRequest' : '/patient/revokeConsent';
    const reason = String(decision.reason || '').trim();
    if (!isGrant && !reason) return setDecision((current) => ({ ...current, error: 'Enter a reason for this decision.' }));
    setDecision((current) => ({ ...current, busy: true, error: '' }));
    try {
      const body = { patientID, requestID: decision.request.requestID };
      if (isReject) body.rejectionReason = reason;
      if (!isGrant && !isReject) body.revocationReason = reason;
      const response = await fetch(databaseUrl(path), { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiPayloadMessage(payload, 'Unable to record your decision.'));
      const result = payload.data || payload;
      const expected = isGrant ? 'ACTIVE' : isReject ? 'REJECTED' : 'REVOKED';
      if (result.status && result.status !== expected) throw new Error('The ledger did not return the expected consent status.');
      setDecision(null);
      setState({ loading: false, error: '', notice: isGrant ? 'Consent granted for the approved record scope.' : isReject ? 'Request rejected. No access was granted.' : 'Consent revoked. Future cross-clinic access is closed.' });
      await load();
    } catch (error) { setDecision((current) => ({ ...current, busy: false, error: error.message })); }
  };

  return <main className="mb-24 min-w-0 w-full">
    <header className="rounded-xl border bg-white p-6"><h1 className="text-3xl font-bold">Data Requests</h1><p className="mt-2 text-slate-600">Review cross-clinic requests, control consent, and see the permanent decision history. Consent does not transfer your patient record to another clinic.</p></header>
    {state.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{state.error}</p>}
    {state.notice && <p role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">{state.notice}</p>}
    {state.loading ? <p role="status" className="mt-5 rounded-xl border bg-white p-5">Loading requests…</p> : <div className="mt-6 grid gap-8">
      <section><h2 className="text-2xl font-bold">Waiting for your consent ({groups.pending.length})</h2><div className="mt-4 grid gap-4 xl:grid-cols-2">{groups.pending.length ? groups.pending.map((request) => <RequestCard key={request.requestID} request={request}><button className="rounded bg-green-700 px-4 py-2 font-semibold text-white" onClick={() => setDecision({ action:'grant', request, reason:'', busy:false, error:'' })}>Grant scoped consent</button><button className="rounded border border-red-700 px-4 py-2 font-semibold text-red-800" onClick={() => setDecision({ action:'reject', request, reason:'', busy:false, error:'' })}>Reject request</button></RequestCard>) : <p className="rounded-xl border bg-white p-5 text-slate-600">No requests are waiting for your decision.</p>}</div></section>
      <section><h2 className="text-2xl font-bold">Granted consent ({groups.granted.length})</h2><div className="mt-4 grid gap-4 xl:grid-cols-2">{groups.granted.length ? groups.granted.map((request) => <RequestCard key={request.requestID} request={request}><button className="rounded border border-red-700 px-4 py-2 font-semibold text-red-800" onClick={() => setDecision({ action:'revoke', request, reason:'', busy:false, error:'' })}>Revoke consent</button></RequestCard>) : <p className="rounded-xl border bg-white p-5 text-slate-600">You have no active cross-clinic consent.</p>}</div></section>
      <section><h2 className="text-2xl font-bold">Decision history ({groups.history.length})</h2><div className="mt-4 grid gap-4 xl:grid-cols-2">{groups.history.length ? groups.history.map((request) => <RequestCard key={request.requestID} request={request} />) : <p className="rounded-xl border bg-white p-5 text-slate-600">No closed requests yet.</p>}</div></section>
    </div>}
    {decision && <ActionDialog title={decision.action === 'grant' ? 'Grant scoped consent?' : decision.action === 'reject' ? 'Reject this request?' : 'Revoke active consent?'} description={decision.action === 'grant' ? 'The requesting doctor will receive access only to the listed record scope until expiry, revocation, or treatment completion.' : 'This decision is recorded on the ledger and cannot be changed through the pending-request workflow.'} confirmLabel={decision.action === 'grant' ? 'Grant consent' : decision.action === 'reject' ? 'Reject request' : 'Revoke consent'} danger={decision.action !== 'grant'} busy={decision.busy} error={decision.error} onClose={() => !decision.busy && setDecision(null)} onConfirm={submitDecision}>{decision.action !== 'grant' && <label className="font-semibold">Reason<textarea required maxLength={1000} value={decision.reason} onChange={(event) => setDecision((current) => ({ ...current, reason:event.target.value }))} className="mt-2 block min-h-28 w-full rounded border p-3 font-normal" /></label>}</ActionDialog>}
  </main>;
}
