// import DataRequestBtn from "../../components/DataRequests/DataRequestBtn";
// import DataRequestDescription from "../../components/DataRequests/DataRequestDescription";
// import DataRequestHeader from "../../components/DataRequests/DataRequestHeader";
// import DataRequestType from "../../components/DataRequests/DataRequestType";

// const DataRequest = ({id, type, fileType, dataType, description, requester, status, data}) => {
//     if(type == 'on-chain'){
//         return (
//             <div className="DataRequest flex flex-col gap-y-2 justify-between bg-white py-3 px-4 rounded-md border">
//                 <DataRequestType Type={type} />
//                 <DataRequestHeader Type={type}  Id={id} FileType={fileType} Status={status} />
//                 <DataRequestDescription Description={description} />
//                 <div>
//                     <h2>Requested from: <span className="font-semibold">{requester}</span> </h2>
//                 </div>

//                 <DataRequestBtn DataStatus={status} FileContent={""} FileUrl={data.fileUrl} FileSize={data.fileSize} />

//             </div>
//         )
//     }

// // *******************************************************************
// //for off chain modify the card info

// //add smooth animtation to to set an appointment form
// // switch between roles

// // *******************************************************************


//     else if(type == 'off-chain'){
//         return (
//             <div className="DataRequest flex flex-col gap-y-2 justify-between bg-white py-3 px-4 rounded-md border">
//                 <DataRequestType Type={type} />
//                 <DataRequestHeader Type={type} Id={id} Status={status} DataType={dataType} />
//                 <DataRequestDescription Description={description} />
//                 <div>
//                     <h2>Requested from: <span className="font-semibold">{requester}</span> </h2>
//                 </div>

//                 <DataRequestBtn DataStatus={status} FileContent={'treatmentHistory'} FileUrl={''} FileSize={data.fileSize} />

//             </div>
//         )
//     }
    
// }

// export default DataRequest;

import DataRequestBtn from "../../components/DataRequests/DataRequestBtn";
import DataRequestDescription from "../../components/DataRequests/DataRequestDescription";
import DataRequestHeader from "../../components/DataRequests/DataRequestHeader";
import DataRequestType from "../../components/DataRequests/DataRequestType";

const DataRequest = ({ id, type, fileType, dataType, description, requester, status, data }) => {
    // Truncate long IDs (show first 6 and last 6 characters)
    const truncatedID = id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-6)}` : id;

    // Determine text color based on status
    const getStatusColor = () => {
        if (status === "CONSENT_GRANTED") return "text-green-600 font-bold";
        if (status === "PENDING_PATIENT_CONSENT") return "text-[#1E2A47] font-bold"; // Apply the dark blue color
        return "text-gray-600";
    };

    return (
        <div className="DataRequest flex flex-col gap-y-2 justify-between bg-white py-3 px-4 rounded-md border">
            {/* Request Type */}
            <DataRequestType Type={type} />

            {/* Request Header */}
            <DataRequestHeader Type={type} Id={truncatedID} FileType={fileType} Status={status} />

            {/* Request Description */}
            <DataRequestDescription 
                Description={
                    <span>
                        <span className="font-semibold">Status: </span> 
                        <span className={getStatusColor()}>{status.replace(/_/g, " ")}</span>
                    </span>
                }
            />

            {/* Requested By */}
            <div>
                <h2>Requested from: <span className="font-semibold">{requester}</span></h2>
            </div>

            {/* Request Button */}
            <DataRequestBtn 
                DataStatus={status} 
                FileContent={type === 'off-chain' ? 'treatmentHistory' : ""} 
                FileUrl={data?.fileUrl || ""} 
                FileSize={data?.fileSize || "Unknown"} 
            />
        </div>
    );
};

export default DataRequest;
