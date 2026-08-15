import React, { useEffect, useState } from "react";
import DataRequest from "../Sections/DataRequests/DataRequest.jsx";
import DataRequestsOrders from "../Sections/DataRequests/DataRequestsOrders.jsx";
import { apiPayloadMessage, authHeaders, databaseUrl } from "../config/api.js";
import { getStoredUser } from "../utils/auth.js";
import { useSearchParams } from "react-router-dom";
import Select from "react-select";

const formatRequest = (request) => ({
    requestId: request.requestID,
    type: 'on-chain',
    dataType: request.dataType || 'Medical/Dental Data',
    fileType: 'N/A',
    description: `Patient referral\nPurpose: ${request.purpose || request.reason || 'Not supplied'}\nStatus: ${String(request.status || '').replace(/_/g, ' ')}`,
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
    const [requestState, setRequestState] = useState({ loading: true, error: '' });
    const [auditPatientID, setAuditPatientID] = useState("");
    const [auditPatients, setAuditPatients] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditError, setAuditError] = useState("");
    const [searchParams] = useSearchParams();
    const focusedRequestID = searchParams.get("requestId");
    const user = getStoredUser();
    const adminClinicID = user?.organizationId;

    useEffect(() => {
        const fetchAllRequests = async () => {
            if (!adminClinicID) return;

            setRequestState((state) => ({ ...state, loading: true, error: '' }));
            try {
                const response = await fetch(databaseUrl(`/getRequestsForAdmin/${adminClinicID}`), {
                    headers: authHeaders(),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(apiPayloadMessage(data, 'Unable to load the clinic referral queue.'));
                const requests = data.data || data;
                if (Array.isArray(requests)) {
                    setAllRequests(requests.map(formatRequest));
                    setRequestState({ loading: false, error: '' });
                } else {
                    throw new Error('The referral service returned an invalid response.');
                }
            } catch (error) {
                console.error("Failed to fetch all requests:", error);
                setRequestState({ loading: false, error: error.message || 'Unable to load the clinic referral queue.' });
            }
        };

        fetchAllRequests();
    }, [adminClinicID, refreshKey]);

    useEffect(() => {
        if (!adminClinicID) return;
        fetch(databaseUrl('/patients'), { headers: authHeaders() })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load clinic patients');
                setAuditPatients(payload.data || []);
            })
            .catch((error) => setAuditError(error.message));
    }, [adminClinicID]);

    useEffect(() => {
        if (!focusedRequestID || allRequests.length === 0) return;
        document.getElementById(`request-${focusedRequestID}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [allRequests, focusedRequestID]);

    const fetchAuditLogs = async () => {
        setAuditError("");
        setAuditLogs([]);
        if (!auditPatientID) {
            setAuditError("Select a patient first.");
            return;
        }
        try {
            const response = await fetch(databaseUrl(`/audit/clinical-access/${encodeURIComponent(auditPatientID)}`), {
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

    const handleRequestChanged = (result) => {
        setAllRequests((requests) => requests.map((request) => request.requestId === result.requestID ? {
            ...request,
            status: result.status,
            description: request.description.replace(/Status:.*$/m, `Status: ${String(result.status).replace(/_/g, ' ')}`),
            data: { ...request.data, request: { ...request.data.request, ...result } },
        } : request));
        setRefreshKey((value) => value + 1);
    };

    if (!adminClinicID) {
        return <div className="w-full border rounded-xl p-4 text-center">Please log in as an admin to view data requests.</div>;
    }

    return (
        <div id="DataRequests" className="my-6 px-0">
            <DataRequestsOrders requests={allRequests} loading={requestState.loading} loadError={requestState.error}
                onRetry={() => setRefreshKey((value) => value + 1)} onChanged={handleRequestChanged} />
            <div className="sectionss grid gap-8 xl:grid-cols-[3fr_1fr]">
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
                                highlighted={request.requestId === focusedRequestID}
                            />
                        )) : requestState.loading ? <p className="text-gray-600 text-sm">Loading data sharing requests...</p>
                            : requestState.error ? <p className="text-red-700 text-sm">The request list is unavailable. Use Retry above; no request has been removed or updated.</p>
                                : <p className="text-gray-600 text-sm">No data sharing requests found.</p>}
                    </div>
                </div>

                <div>
                    <div className="mt-6 p-6 bg-white rounded-xl border">
                        <h2 className="text-2xl font-bold mb-4">Access Audit</h2>
                        <div className="flex gap-2">
                            <div className="min-w-0 flex-1"><Select
                                inputId="audit-patient"
                                isSearchable
                                options={auditPatients.map((patient) => ({ value: patient.patientID, label: `${patient.firstName} ${patient.lastName} — ${patient.emiratesID || patient.email || patient.contactNumber || 'contact details unavailable'}` }))}
                                value={auditPatients.map((patient) => ({ value: patient.patientID, label: `${patient.firstName} ${patient.lastName} — ${patient.emiratesID || patient.email || patient.contactNumber || 'contact details unavailable'}` })).find((option) => option.value === auditPatientID) || null}
                                onChange={(option) => setAuditPatientID(option?.value || '')}
                                placeholder="Search clinic patients"
                            /></div>
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
                                    <div className="break-all"><span className="font-medium">Log ID:</span> {log.logID || 'Unavailable'}</div>
                                    <div className="break-all"><span className="font-medium">Transaction ID:</span> {log.transactionID || 'Unavailable'}</div>
                                    <div><span className="font-medium">Timestamp:</span> {log.timestamp || 'Unavailable'}</div>
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
