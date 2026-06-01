// import React from 'react';
// import UpcomingDataRequest from './UpcomingDataRequest'

// import { OnHoldRequests } from '../../../../dataRequests';


// const DataRequestsOrders = () => {
//     return (
//         <div id="DataRequestsOrders" className="p-6 bg-white p-3 rounded-xl border">
//             <h2 className="text-3xl font-bold mb-6">Requests</h2>
//             <div className="bg-white rounded-md">
//                 {/* Add multiple UpcomingDataRequest components as needed */}
                
//                 {
//                     OnHoldRequests.map((request) => {
//                         return <UpcomingDataRequest 
//                             key={request.header}
//                             header={request.header}
//                             details={request.description}
//                             type={request.type}
//                          />
//                     })
//                 }

//             </div>
//         </div>
//     );
// };

// export default DataRequestsOrders;
import React, { useEffect, useState } from 'react';
import UpcomingDataRequest from './UpcomingDataRequest';
import { DataRequestsData } from '../../../../dataRequests'; // Import the global data store

const DataRequestsOrders = () => {
    const [onHoldRequests, setOnHoldRequests] = useState([]);
    const user = JSON.parse(localStorage.getItem("user")); // Retrieve user details
    const adminClinicID = user.organizationId; // Admin's clinic ID
    const adminID = user.id;

    // console.log("Admin ID:", adminID); 

    useEffect(() => {
        const fetchRequests = async () => {
            try {
                const response = await fetch(`http://localhost:8081/getRequestsForAdmin/${adminClinicID}`);
                const data = await response.json();
                console.log("Fetched Admin Requests:", data);

                if (Array.isArray(data)) {
                    setOnHoldRequests(
                        data
                            .filter(request => request.status === 'PENDING_ADMIN_APPROVAL') // ✅ Only show pending requests
                            .map(request => ({
                                requestID: request.requestID,
                                doctorID: request.doctorID,
                                patientID: request.patientID,
                                header: `Request from ${request.doctorID}`,
                                description: `Patient: ${request.patientID}, Status: ${request.status}`,
                                type: 'on-chain'
                            }))
                    );
                } else {
                    console.error("Unexpected response format:", data);
                }
            } catch (error) {
                console.error("Failed to fetch admin requests:", error);
            }
        };

        fetchRequests();
    }, []);

    // Function to approve a request
    const handleApproveRequest = async (requestID, doctorID, patientID) => {
        try {
            const response = await fetch(`http://localhost:8081/approveRequest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    adminID: adminID, 
                    requestID: requestID,
                    adminClinicID: adminClinicID
                }),
            });

            const data = await response.json();
            console.log("Approval Response:", data);

            if (response.ok) {
                alert(`Request ${requestID} approved! Now waiting for patient consent.`);

                // ✅ Remove request from onHoldRequests state
                setOnHoldRequests(prevRequests =>
                    prevRequests.filter(request => request.requestID !== requestID)
                );

                // ✅ Add request to DataRequestsData with PENDING_PATIENT_CONSENT status
                DataRequestsData.push({
                    requestId: requestID,
                    type: 'on-chain',
                    dataType: 'Medical/Dental Data',
                    fileType: 'N/A',
                    description: `Request approved by Admin. Waiting for patient consent.`,
                    requester: doctorID,
                    status: 'PENDING_PATIENT_CONSENT',
                    data: {}
                });
            } else {
                alert(`Error: ${data.message || "Failed to approve request."}`);
            }
        } catch (error) {
            console.error("Failed to approve request:", error);
            alert("Error approving request. Please try again later.");
        }
    };

    return (
        <div id="DataRequestsOrders" className="p-6 bg-white p-3 rounded-xl border">
            <h2 className="text-3xl font-bold mb-6">Requests</h2>
            <div className="bg-white rounded-md">
                {onHoldRequests.length > 0 ? (
                    onHoldRequests.map((request, index) => (
                        <UpcomingDataRequest 
                            key={index}
                            header={request.header}
                            details={request.description}
                            type={request.type}
                            onApprove={() => handleApproveRequest(request.requestID, request.doctorID, request.patientID)}
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
