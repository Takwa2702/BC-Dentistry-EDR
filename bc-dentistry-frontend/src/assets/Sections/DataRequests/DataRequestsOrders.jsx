import React, { useEffect, useState } from 'react';
import UpcomingDataRequest from './UpcomingDataRequest';
import { authHeaders, blockchainUrl, jsonHeaders } from '../../config/api.js';
import { getStoredUser } from '../../utils/auth.js';

const DataRequestsOrders = ({ onChanged }) => {
    const [onHoldRequests, setOnHoldRequests] = useState([]);
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
                alert(`Request ${requestID} approved. Patient consent is now required.`);
                setOnHoldRequests((requests) => requests.filter((request) => request.requestID !== requestID));
                onChanged?.();
            } else {
                alert(`Error: ${data?.error?.message || data.message || 'Failed to approve request.'}`);
            }
        } catch (error) {
            console.error('Failed to approve request:', error);
            alert('Error approving request. Please try again later.');
        }
    };

    const handleRejectRequest = async (requestID) => {
        const rejectionReason = window.prompt('Reason for rejection', 'Request does not meet clinic policy');
        if (!rejectionReason) return;

        try {
            const response = await fetch(blockchainUrl('/admin/rejectRequest'), {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify({ adminID, requestID, adminClinicID, rejectionReason }),
            });
            const data = await response.json();

            if (response.ok) {
                alert(`Request ${requestID} rejected.`);
                setOnHoldRequests((requests) => requests.filter((request) => request.requestID !== requestID));
                onChanged?.();
            } else {
                alert(`Error: ${data?.error?.message || data.message || 'Failed to reject request.'}`);
            }
        } catch (error) {
            console.error('Failed to reject request:', error);
            alert('Error rejecting request. Please try again later.');
        }
    };

    return (
        <div id="DataRequestsOrders" className="p-6 bg-white rounded-xl border">
            <h2 className="text-3xl font-bold mb-6">Pending Admin Review</h2>
            <div className="bg-white rounded-md">
                {onHoldRequests.length > 0 ? (
                    onHoldRequests.map((request) => (
                        <UpcomingDataRequest
                            key={request.requestID}
                            header={request.header}
                            details={request.description}
                            type={request.type}
                            onApprove={() => handleApproveRequest(request.requestID)}
                            onReject={() => handleRejectRequest(request.requestID)}
                        />
                    ))
                ) : (
                    <p className="text-gray-600 text-sm">No pending requests.</p>
                )}
            </div>
        </div>
    );
};

export default DataRequestsOrders;
