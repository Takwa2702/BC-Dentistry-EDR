const DataRequestBtn = ({DataStatus, FileUrl, FileSize, FileContent}) => {
    return (
        <button className="border py-2 rounded-md uppercase">
            {
                DataStatus == "CONSENT_GRANTED" ? "Ready " : DataStatus == "PENDING_PATIENT_CONSENT" ? "Waiting for consent " : DataStatus == "PENDING_ADMIN_APPROVAL" ? "Waiting for admin " : DataStatus == "CONSENT_REVOKED" ? "Revoked " : 'Request '
            }
            {/* Request {'\t'} */}
            <a href={FileUrl} target="_blank">{FileContent == "" ? ` data file` : FileContent}</a>
            <span> {FileSize}</span>
        </button>
    )
}

export default DataRequestBtn;
