import DataRequestBtn from "../../components/DataRequests/DataRequestBtn";
import DataRequestDescription from "../../components/DataRequests/DataRequestDescription";
import DataRequestHeader from "../../components/DataRequests/DataRequestHeader";
import DataRequestType from "../../components/DataRequests/DataRequestType";

const DataRequest = ({ id, type, fileType, dataType, description, requester, status, data, highlighted = false }) => {
    const requestID = String(id || '');
    // Truncate long IDs (show first 6 and last 6 characters)
    const truncatedID = requestID.length > 12 ? `${requestID.slice(0, 6)}...${requestID.slice(-6)}` : requestID;

    // Determine text color based on status
    const getStatusColor = () => {
        if (status === "ACTIVE" || status === "COMPLETED") return "text-green-600 font-bold";
        if (status === "PENDING_PATIENT_CONSENT" || status === "PENDING_ADMIN_APPROVAL") return "text-[#1E2A47] font-bold"; // Apply the dark blue color
        if (status === "REJECTED" || status === "REVOKED" || status === "EXPIRED") return "text-red-600 font-bold";
        return "text-gray-600";
    };

    return (
        <div id={`request-${requestID}`} className={`DataRequest flex flex-col gap-y-2 justify-between bg-white py-3 px-4 rounded-md border ${highlighted ? "ring-2 ring-blue-600 ring-offset-2" : ""}`}>
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
                        <br />
                        <span className="whitespace-pre-line">{description}</span>
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
