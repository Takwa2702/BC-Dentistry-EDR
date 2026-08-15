const DataRequestBtn = ({DataStatus, FileUrl, FileSize, FileContent}) => {
    return (
        <button className="border py-2 rounded-md uppercase">
            {
                DataStatus == "ACTIVE" ? "Referral active " : DataStatus == "COMPLETED" ? "Referral completed " : DataStatus == "PENDING_PATIENT_CONSENT" ? "Waiting for patient " : DataStatus == "PENDING_ADMIN_APPROVAL" ? "Waiting for admin " : DataStatus == "REVOKED" ? "Access revoked " : 'Request '
            }
            {/* Request {'\t'} */}
            <a href={FileUrl} target="_blank">{FileContent == "" ? ` data file` : FileContent}</a>
            <span> {FileSize}</span>
        </button>
    )
}

export default DataRequestBtn;
