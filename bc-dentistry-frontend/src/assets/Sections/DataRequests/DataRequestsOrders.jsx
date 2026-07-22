import React, { useEffect, useState } from 'react';
import UpcomingDataRequest from './UpcomingDataRequest';
import { authHeaders, blockchainUrl, jsonHeaders } from '../../config/api.js';
import { getStoredUser } from '../../utils/auth.js';
import ActionDialog from '../../components/ActionDialog.jsx';

const DataRequestsOrders = ({ onChanged }) => {
    const [onHoldRequests, setOnHoldRequests] = useState([]);
    const [feedback, setFeedback] = useState({ error: '', notice: '' });
    const [rejecting, setRejecting] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('Request does not meet clinic policy');
    const [busy, setBusy] = useState(false);
    const user = getStoredUser();
    const adminClinicID = user?.organizationId;
    const adminID = user?.id;

    useEffect(() => {
        const fetchRequests = async () => {
            if (!adminClinicID) return;

            try {
                const response = await fetch(blockchainUrl(`/getRequestsForAdmin/${adminClinicID}`), {
                    headers: authHeaders(),
                });
                const data = await response.json();
                const requests = data.data || data;

                if (Array.isArray(requests)) {
                    setOnHoldRequests(
                        requests
                            .filter((request) => request.status === 'PENDING_ADMIN_APPROVAL')
                            .map((request) => ({
                                requestID: request.requestID,
                                header: `Request from ${request.doctorName || request.doctorID}`,
                                description: `Patient: ${request.patientID}\nData: ${request.dataType || 'Medical/Dental Data'}\nPurpose: ${request.purpose || request.reason || 'Not supplied'}`,
                                type: 'on-chain',
                            })),
                    );
                } else {
                    console.error('Unexpected response format:', data);
                }
            } catch (error) {
                console.error('Failed to fetch admin requests:', error);
            }
        };

        fetchRequests();
    }, [adminClinicID]);

    const handleApproveRequest = async (requestID) => {
        try {
            const response = await fetch(blockchainUrl('/approveRequest'), {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify({ adminID, requestID, adminClinicID }),
            });
            const data = await response.json();

            if (response.ok) {
                setFeedback({ error: '', notice: `Request ${requestID} approved. Patient consent is now required.` });
                setOnHoldRequests((requests) => requests.filter((request) => request.requestID !== requestID));
                onChanged?.();
            } else {
                setFeedback({ error: data?.error?.message || data.message || 'Failed to approve request.', notice: '' });
            }
        } catch (error) {
            console.error('Failed to approve request:', error);
            setFeedback({ error: 'Error approving request. Please try again later.', notice: '' });
        }
    };

    const handleRejectRequest = async () => {
        const requestID = rejecting;
        if (!rejectionReason.trim()) return setFeedback({ error: 'Enter a rejection reason.', notice: '' });
        setBusy(true); setFeedback({ error: '', notice: '' });
        try {
            const response = await fetch(blockchainUrl('/admin/rejectRequest'), {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify({ adminID, requestID, adminClinicID, rejectionReason }),
            });
            const data = await response.json();

            if (response.ok) {
                setFeedback({ error: '', notice: `Request ${requestID} rejected.` });
                setRejecting(null);
                setOnHoldRequests((requests) => requests.filter((request) => request.requestID !== requestID));
                onChanged?.();
            } else {
                setFeedback({ error: data?.error?.message || data.message || 'Failed to reject request.', notice: '' });
            }
        } catch (error) {
            console.error('Failed to reject request:', error);
            setFeedback({ error: 'Error rejecting request. Please try again later.', notice: '' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div id="DataRequestsOrders" className="p-6 bg-white rounded-xl border">
            <h2 className="text-3xl font-bold mb-6">Pending Admin Review</h2>
            {feedback.error && <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">{feedback.error}</p>}
            {feedback.notice && <p role="status" className="mb-4 rounded bg-green-50 p-3 text-green-800">{feedback.notice}</p>}
            <div className="bg-white rounded-md">
                {onHoldRequests.length > 0 ? (
                    onHoldRequests.map((request) => (
                        <UpcomingDataRequest
                            key={request.requestID}
                            header={request.header}
                            details={request.description}
                            type={request.type}
                            onApprove={() => handleApproveRequest(request.requestID)}
                            onReject={() => { setRejectionReason('Request does not meet clinic policy'); setFeedback({error:'',notice:''}); setRejecting(request.requestID); }}
                        />
                    ))
                ) : (
                    <p className="text-gray-600 text-sm">No pending requests.</p>
                )}
            </div>
            {rejecting && <ActionDialog title={`Reject request ${rejecting}`} description="Provide the reason that will be recorded for this decision." confirmLabel="Reject request" danger busy={busy} error={feedback.error} onClose={() => setRejecting(null)} onConfirm={handleRejectRequest}><label className="text-sm font-semibold">Rejection reason<textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="mt-2 block min-h-28 w-full rounded-md border p-3" /></label></ActionDialog>}
        </div>
    );
};

export default DataRequestsOrders;
