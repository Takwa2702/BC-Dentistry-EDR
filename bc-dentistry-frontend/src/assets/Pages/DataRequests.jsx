// import {DataRequestsData, OnHoldRequests} from "../../../dataRequests.js";
// import DataRequest from "../Sections/DataRequests/DataRequest.jsx";
// import DataRequestsOrders from "../Sections/DataRequests/DataRequestsOrders.jsx";

// const DataRequests = () => {
//     return (
//         <div id="DataRequests" className="my-6 px-0">
//             <div className="sectionss grid grid-cols-2 gap-x-8" style={{gridTemplateColumns: '3fr 1fr'}}>
//                 <div className="bg-white p-6 rounded-xl border">
//                     <h2 className="text-3xl font-bold mb-7">{`Data Requests - ${DataRequestsData.length}`}</h2>
//                     <div className="data-requests-section grid grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-8">
//                     {
//                         DataRequestsData.map((request) => {
//                             return (
//                                 <DataRequest
//                                     key={request.requestId}
//                                     id={request.requestId}
//                                     type={request.type}
//                                     dataType={request?.dataType}
//                                     fileType={request?.fileType}
//                                     description={request.description}
//                                     requester={request.requester}
//                                     status={request.status}
//                                     data={request.data}
//                                 />
//                             )
//                         })
//                     }
//                     </div>

//                 </div>
                
//                 <div className="col-span-1">
//                     <DataRequestsOrders />
//                 </div>
//             </div>
//         </div>
//     )
// }

// export default DataRequests;

import React, { useEffect, useState } from "react";
import DataRequest from "../Sections/DataRequests/DataRequest.jsx";
import DataRequestsOrders from "../Sections/DataRequests/DataRequestsOrders.jsx";

const DataRequests = () => {
    const [allRequests, setAllRequests] = useState([]);
    const user = JSON.parse(localStorage.getItem("user"));
    const adminClinicID = user.organizationId;

    useEffect(() => {
        const fetchAllRequests = async () => {
            try {
                const response = await fetch(`http://localhost:8081/getRequestsForAdmin/${adminClinicID}`);
                const data = await response.json();
                console.log("Fetched All Requests:", data);

                if (Array.isArray(data)) {
                    // Organize and structure request data
                    const formattedRequests = data.map(request => ({
                        requestId: request.requestID,
                        type: 'on-chain',
                        dataType: "Medical/Dental Data",
                        fileType: "N/A",
                        description: `Status: ${request.status.replace(/_/g, " ")}`,
                        requester: request.doctorID,
                        status: request.status,
                        data: {
                            fileUrl: request.fileUrl || "", 
                            fileSize: request.fileSize || "Unknown", 
                            clinicID: request.dataOriginClinicID,
                        },
                    }));

                    setAllRequests(formattedRequests);
                } else {
                    console.error("Unexpected response format:", data);
                }
            } catch (error) {
                console.error("Failed to fetch all requests:", error);
            }
        };

        fetchAllRequests();
    }, []);

    return (
        <div id="DataRequests" className="my-6 px-0">
            <div className="sectionss grid grid-cols-2 gap-x-8" style={{gridTemplateColumns: '3fr 1fr'}}>
                <div className="bg-white p-6 rounded-xl border">
                    <h2 className="text-3xl font-bold mb-7">{`Data Requests - ${allRequests.length}`}</h2>
                    <div className="data-requests-section grid grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-8">
                        {
                            allRequests.map((request) => (
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
                            ))
                        }
                    </div>
                </div>

                <div className="col-span-1">
                    <DataRequestsOrders />
                </div>
            </div>
        </div>
    );
};

export default DataRequests;
