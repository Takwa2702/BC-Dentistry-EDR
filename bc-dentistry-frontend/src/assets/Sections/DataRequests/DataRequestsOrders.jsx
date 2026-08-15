import React, { useMemo, useState } from 'react';
import UpcomingDataRequest from './UpcomingDataRequest';
import { apiPayloadMessage, databaseUrl, jsonHeaders } from '../../config/api.js';
import { getStoredUser } from '../../utils/auth.js';
import ActionDialog from '../../components/ActionDialog.jsx';

const DataRequestsOrders = ({ requests = [], loading = false, loadError = '', onRetry, onChanged }) => {
    const [feedback, setFeedback] = useState({ error: '', notice: '' });
    const [rejecting, setRejecting] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('Request does not meet clinic policy');
    const [busy, setBusy] = useState(false);
    const user = getStoredUser();
    const adminClinicID = user?.organizationId;
    const adminID = user?.id;
    const pendingRequests = useMemo(() => requests
        .map((item) => item?.data?.request || item)
        .filter((request) => request?.status === 'PENDING_ADMIN_APPROVAL')
        .map((request) => ({
            requestID: request.requestID,
            header: `Request from ${request.doctorName || request.doctorID}`,
            description: `Requested data: ${request.dataType || 'Complete patient record'}\nPurpose: ${request.purpose || request.reason || 'Not supplied'}\nApproval sends the request to the patient for consent; it does not transfer patient ownership.`,
            type: 'on-chain',
        })), [requests]);

    const handleApproveRequest = async (requestID) => {
        if (busy) return;
        setBusy(true);
        setFeedback({ error: '', notice: '' });
        try {
            const response = await fetch(databaseUrl('/approveRequest'), {
                method: 'POST', headers: jsonHeaders(),
                body: JSON.stringify({ adminID, requestID, adminClinicID }),
            });
            const data = await response.json().catch(() => ({}));
            const result = data.data || data;
            if (response.ok && result.status === 'PENDING_PATIENT_CONSENT') {
                setFeedback({ error: '', notice: `Data-access request ${requestID} approved. Patient consent is now required before access is granted.` });
                onChanged?.(result);
            } else {
                setFeedback({ error: `Request ${requestID} remains pending. ${apiPayloadMessage(data, 'Approval failed; retry or contact support.')}`, notice: '' });
            }
        } catch (error) {
            console.error('Failed to approve request:', error);
            setFeedback({ error: `Request ${requestID} remains pending. Approval failed; please retry or contact support.`, notice: '' });
        } finally {
            setBusy(false);
        }
    };

    const handleRejectRequest = async () => {
        const requestID = rejecting;
        if (!rejectionReason.trim()) return setFeedback({ error: 'Enter a rejection reason.', notice: '' });
        setBusy(true);
        setFeedback({ error: '', notice: '' });
        try {
            const response = await fetch(databaseUrl('/admin/rejectRequest'), {
                method: 'POST', headers: jsonHeaders(),
                body: JSON.stringify({ adminID, requestID, adminClinicID, rejectionReason }),
            });
            const data = await response.json().catch(() => ({}));
            const result = data.data || data;
            if (response.ok && result.status === 'REJECTED' && result.accessGranted === false) {
                setFeedback({ error: '', notice: `Request ${requestID} rejected.` });
                setRejecting(null);
                onChanged?.(result);
            } else {
                setFeedback({ error: `Request ${requestID} remains pending. ${apiPayloadMessage(data, 'Rejection failed; retry or contact support.')}`, notice: '' });
            }
        } catch (error) {
            console.error('Failed to reject request:', error);
            setFeedback({ error: `Request ${requestID} remains pending. Rejection failed; please retry or contact support.`, notice: '' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div id="DataRequestsOrders" className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="mb-6 text-3xl font-bold">Pending Admin Review</h2>
            {loadError && <div role="alert" className="mb-4 rounded border border-red-300 bg-red-50 p-4 text-red-900"><p className="font-semibold">The referral queue could not be refreshed.</p><p className="mt-1 text-sm">{loadError} Previously loaded requests remain visible and unchanged.</p><button type="button" onClick={onRetry} className="mt-3 rounded border border-red-700 px-3 py-2 font-semibold">Retry</button></div>}
            {feedback.error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">{feedback.error}</p>}
            {feedback.notice && <p role="status" className="mb-4 rounded bg-green-50 p-3 text-green-800">{feedback.notice}</p>}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pendingRequests.length > 0 ? pendingRequests.map((request) => (
                    <UpcomingDataRequest key={request.requestID} header={request.header} details={request.description} type={request.type} busy={busy}
                        onApprove={() => handleApproveRequest(request.requestID)}
                        onReject={() => { setRejectionReason('Request does not meet clinic policy'); setFeedback({ error: '', notice: '' }); setRejecting(request.requestID); }} />
                )) : loading ? <p className="text-sm text-gray-600">Loading pending requests...</p>
                    : loadError ? <p className="text-sm text-gray-700">No additional decision can be made until the queue refresh succeeds.</p>
                        : <p className="text-sm text-gray-600">No pending requests.</p>}
            </div>
            {rejecting && <ActionDialog title={`Reject request ${rejecting}`} description="Provide the reason that will be recorded for this decision." confirmLabel="Reject request" danger busy={busy} error={feedback.error} onClose={() => setRejecting(null)} onConfirm={handleRejectRequest}><label className="text-sm font-semibold">Rejection reason<textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="mt-2 block min-h-28 w-full rounded-md border p-3" /></label></ActionDialog>}
        </div>
    );
};

export default DataRequestsOrders;
