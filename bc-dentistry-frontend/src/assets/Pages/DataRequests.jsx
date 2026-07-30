import React, { useEffect, useState } from "react";
import DataRequest from "../Sections/DataRequests/DataRequest.jsx";
import DataRequestsOrders from "../Sections/DataRequests/DataRequestsOrders.jsx";
import { authHeaders, blockchainUrl } from "../config/api.js";
import { getStoredUser } from "../utils/auth.js";

const formatRequest = (request) => ({
    requestId: request.requestID,
    type: 'on-chain',
    dataType: request.dataType || 'Medical/Dental Data',
    fileType: 'N/A',
    description: `Patient ${request.patientID}\nPurpose: ${request.purpose || request.reason || 'Not supplied'}\nStatus: ${String(request.status || '').replace(/_/g, ' ')}`,
    requester: request.doctorName || request.doctorID,
    status: request.status,
    data: {
        fileUrl: request.fileUrl || '',
        fileSize: request.requestedAt ? new Date(request.requestedAt).toLocaleString() : 'Unknown',
        clinicID: request.dataOriginClinicID,
        request,
    },
});

const DataRequests = () => {
    const [allRequests, setAllRequests] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const [auditPatientID, setAuditPatientID] = useState("");
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditError, setAuditError] = useState("");
    const user = getStoredUser();
    const adminClinicID = user?.organizationId;

    useEffect(() => {
        const fetchAllRequests = async () => {
            if (!adminClinicID) return;

            try {
                const response = await fetch(blockchainUrl(`/getRequestsForAdmin/${adminClinicID}`), {
                    headers: authHeaders(),
                });
                const data = await response.json();
                const requests = data.data || data;
                if (Array.isArray(requests)) {
                    setAllRequests(requests.map(formatRequest));
                } else {
                    console.error("Unexpected response format:", data);
                }
            } catch (error) {
                console.error("Failed to fetch all requests:", error);
            }
        };

        fetchAllRequests();
    }, [adminClinicID, refreshKey]);

    const fetchAuditLogs = async () => {
        setAuditError("");
        setAuditLogs([]);
        if (!auditPatientID) {
            setAuditError("Enter a patient blockchain ID first.");
            return;
        }
        try {
            const response = await fetch(blockchainUrl(`/audit/clinical-access/${encodeURIComponent(auditPatientID)}`), {
                headers: authHeaders(),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error?.message || "Unable to load audit logs");
            }
            setAuditLogs(payload.data || payload || []);
        } catch (error) {
            setAuditError(error.message);
        }
    };

    if (!adminClinicID) {
        return <div className="w-full border rounded-xl p-4 text-center">Please log in as an admin to view data requests.</div>;
    }

    return (
        <div id="DataRequests" className="my-6 px-0">
            <div className="sectionss grid grid-cols-2 gap-x-8" style={{gridTemplateColumns: '3fr 1fr'}}>
                <div className="bg-white p-6 rounded-xl border">
                    <h2 className="text-3xl font-bold mb-7">{`Data Requests - ${allRequests.length}`}</h2>
                    <div className="data-requests-section grid grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-8">
                        {allRequests.length > 0 ? allRequests.map((request) => (
                            <DataRequest
                                key={request.requestId}
                                id={request.requestId}
                                type={request.type}
                                dataType={request.dataType}
                                fileType={request.fileType}
                                description={request.description}
                                requester={request.requester}
                                status={request.status}
                                data={request.data}
                            />
                        )) : <p className="text-gray-600 text-sm">No data sharing requests found.</p>}
                    </div>
                </div>

                <div className="col-span-1">
                    <DataRequestsOrders onChanged={() => setRefreshKey((value) => value + 1)} />
                    <div className="mt-6 p-6 bg-white rounded-xl border">
                        <h2 className="text-2xl font-bold mb-4">Access Audit</h2>
                        <div className="flex gap-2">
                            <input
                                className="border rounded-md px-3 py-2 w-full"
                                value={auditPatientID}
                                onChange={(event) => setAuditPatientID(event.target.value)}
                                placeholder="Patient blockchain ID"
                            />
                            <button className="px-4 py-2 rounded-md bg-[#1E2A47] text-white" onClick={fetchAuditLogs}>Load</button>
                        </div>
                        {auditError && <p className="text-red-600 text-sm mt-2">{auditError}</p>}
                        <div className="mt-4 flex flex-col gap-2">
                            {auditLogs.length === 0 ? (
                                <p className="text-gray-600 text-sm">No audit logs loaded.</p>
                            ) : auditLogs.map((log) => (
                                <div key={log.logID} className="border rounded-md p-3 text-sm">
                                    <div className="font-semibold">{log.actorRole} {log.actorID} read {log.recordType}</div>
                                    <div>Basis: {log.accessBasis || 'unknown'} {log.requestID ? `(${log.requestID})` : ''}</div>
                                    <div>Purpose: {log.purpose || 'Not supplied'}</div>
                                    <div>{log.timestamp}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataRequests;
