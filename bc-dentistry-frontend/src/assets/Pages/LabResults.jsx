import { useEffect, useMemo, useState } from 'react';
import { authHeaders, databaseUrl } from '../config/api.js';
import { getStoredUser } from '../utils/auth.js';

const apiMessage = (payload, fallback) => payload?.error?.message || fallback;
const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';

export default function LabResults() {
    const user = getStoredUser();
    const role = String(user?.role || '').toLowerCase();
    const [patients, setPatients] = useState([]);
    const [patientID, setPatientID] = useState('');
    const [results, setResults] = useState([]);
    const [access, setAccess] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (role !== 'doctor') return;
        fetch(databaseUrl('/doctor/me/assigned-patients'), { headers: authHeaders() })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(apiMessage(payload, 'Unable to load assigned patients'));
                setPatients(payload.data || []);
            }).catch((loadError) => setError(loadError.message));
    }, [role]);

    useEffect(() => {
        if (role === 'doctor' && !patientID) { setResults([]); setLoading(false); return; }
        setLoading(true); setError('');
        const query = role === 'doctor' ? `?patientID=${encodeURIComponent(patientID)}` : '';
        fetch(databaseUrl(`/lab-results${query}`), { headers: authHeaders() })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(apiMessage(payload, 'Unable to load lab results'));
                setResults(payload.data || []); setAccess(payload.access || '');
            }).catch((loadError) => setError(loadError.message))
            .finally(() => setLoading(false));
    }, [role, patientID]);

    const visible = useMemo(() => results.filter((result) => !status || result.status === status), [results, status]);
    const statuses = [...new Set(results.map((result) => result.status).filter(Boolean))];

    return <main id="LabResults" className="mb-24 min-w-0 w-full">
        <header className="rounded-xl bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-bold">Lab results</h1>
            <p className="mt-2 text-gray-600">
                {role === 'admin'
                    ? 'Operational metadata only. Clinical values, interpretations, notes, and attachments are not available to Clinic Admins.'
                    : role === 'patient' ? 'Your laboratory history.' : 'Select an assigned or consent-authorized patient.'}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {role === 'doctor' && <label className="min-w-0 text-sm font-semibold">Patient
                    <select value={patientID} onChange={(event) => setPatientID(event.target.value)} className="mt-2 block w-full rounded border bg-white p-3 font-normal">
                        <option value="">Select patient</option>
                        {patients.map((patient) => <option key={patient.patientID} value={patient.patientID}>{patient.firstName} {patient.lastName} — {patient.emiratesID || patient.email || patient.contactNumber || 'contact details unavailable'}</option>)}
                    </select>
                </label>}
                <label className="min-w-0 text-sm font-semibold">Status
                    <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-2 block w-full rounded border bg-white p-3 font-normal">
                        <option value="">All statuses</option>
                        {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                </label>
            </div>
        </header>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</p>}
        {loading && <p role="status" className="mt-5 rounded-xl bg-white p-5">Loading lab results…</p>}
        {!loading && !error && role === 'doctor' && !patientID && <p className="mt-5 rounded-xl border bg-white p-5">Select a patient to view authorized lab results.</p>}
        {!loading && !error && (role !== 'doctor' || patientID) && visible.length === 0 && <p className="mt-5 rounded-xl border bg-white p-5">No lab results have been recorded.</p>}
        {!loading && visible.length > 0 && <div className="mt-5 max-w-full overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="min-w-[52rem] w-full text-left"><thead><tr className="border-b bg-slate-50">
                <th className="p-4">Order</th><th className="p-4">Patient</th><th className="p-4">Test</th><th className="p-4">Doctor</th><th className="p-4">Status</th><th className="p-4">Dates</th>
            </tr></thead><tbody>{visible.map((result) => <tr key={result.labResultID} className="border-b align-top">
                <td className="p-4">{result.orderID}</td>
                <td className="p-4"><strong>{result.patientName}</strong></td>
                <td className="p-4">{result.testName}<span className="block text-xs text-gray-500">{result.discipline || 'Unspecified discipline'}</span></td>
                <td className="p-4">{result.orderingDoctorName || 'Not assigned'}</td>
                <td className="p-4 capitalize">{result.status}</td>
                <td className="p-4 text-sm"><span className="block">Ordered: {formatDate(result.orderedAt)}</span><span className="block">Completed: {formatDate(result.completedAt)}</span></td>
                {access === 'clinical' && <td className="hidden">{JSON.stringify(result.resultData)}</td>}
            </tr>)}</tbody></table>
        </div>}
    </main>;
}
