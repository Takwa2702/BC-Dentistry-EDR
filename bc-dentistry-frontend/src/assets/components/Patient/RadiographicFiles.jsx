import { lazy, Suspense, useEffect, useState } from "react";
import axios from "axios";
import { authHeaders, databaseUrl } from "../../config/api.js";

const statusClass = {
  verified: "bg-green-100 text-green-800",
  mismatch: "bg-red-100 text-red-800",
  "missing file": "bg-amber-100 text-amber-800",
  unknown: "bg-slate-100 text-slate-700",
};
const DicomViewer = lazy(() => import('./DicomViewer.jsx'));

export default function RadiographicFiles({ patientID, canUpload }) {
  const [files, setFiles] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("status");
  const [selectedFile, setSelectedFile] = useState(null);

  const loadFiles = async () => {
    try {
      const response = await axios.get(databaseUrl(`/patients/${patientID}/radiographic-files`), { headers: authHeaders() });
      setFiles(response.data.data || []);
    } catch (error) { setMessage(error.response?.data?.error?.message || "Unable to load radiographic files."); }
  };

  useEffect(() => { loadFiles(); }, [patientID]);

  const verify = async (fileID) => {
    try {
      const response = await axios.get(databaseUrl(`/radiographic-files/${fileID}/verify-integrity`), { headers: authHeaders() });
      setStatuses((current) => ({ ...current, [fileID]: response.data.data.status }));
    } catch (error) { setStatuses((current) => ({ ...current, [fileID]: "unknown" })); }
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (![".dcm", ".jpg", ".jpeg", ".png"].includes(extension)) {
      setMessage("Only DICOM, JPEG, and PNG radiographic files are supported.");
      setMessageType("error");
      event.target.value = "";
      return;
    }
    setMessage("Uploading and anchoring SHA-256 metadata…");
    setMessageType("status");
    try {
      await axios.post(databaseUrl("/radiographic-files"), file, { headers: authHeaders({
        "Content-Type": "application/octet-stream", "x-patient-id": patientID,
        "x-file-name": file.name, "x-file-media-type": file.type || "application/octet-stream",
        "Idempotency-Key": `${patientID}:${file.name}:${file.size}:${file.lastModified}`,
      }) });
      setMessage("Upload complete.");
      setMessageType("status");
      await loadFiles();
    } catch (error) {
      setMessage(error.response?.data?.error?.message || "The file could not be uploaded. It may be corrupt or unreadable.");
      setMessageType("error");
    }
    event.target.value = "";
  };

  return <section className="bg-white rounded-md p-5">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-bold">DICOM & Radiographic Integrity</h2>
      {canUpload && <label className="cursor-pointer bg-blue-600 text-white rounded px-4 py-2">
        Upload file<input className="hidden" type="file" accept=".dcm,.jpg,.jpeg,.png,application/dicom,image/jpeg,image/png" onChange={upload} />
      </label>}
    </div>
    {message && <p role={messageType === "error" ? "alert" : "status"} className={`mt-2 text-sm ${messageType === "error" ? "text-red-700" : ""}`}>{message}</p>}
    {!files.length ? <p className="mt-4 text-slate-500">No radiographic files recorded.</p> :
      <div className="mt-4 grid gap-3">{files.map((file) => <div key={file.fileID} className="border rounded p-3">
        <div className="flex flex-wrap justify-between gap-2">
          <div><p className="font-semibold">{file.fileName}</p><p className="text-sm text-slate-600">{file.mediaType} · {Number(file.fileSize).toLocaleString()} bytes</p></div>
          <span className={`self-start rounded px-2 py-1 text-sm ${statusClass[statuses[file.fileID] || "unknown"]}`}>{statuses[file.fileID] || "unknown"}</span>
        </div>
        <p className="mt-2 break-all font-mono text-xs">SHA-256: {file.sha256}</p>
        <p className="text-xs text-slate-500">Uploaded {new Date(file.uploadedAt).toLocaleString()} by {file.uploaderID}</p>
        <div className="mt-2 flex flex-wrap gap-2"><button className="border rounded px-3 py-1" onClick={() => verify(file.fileID)}>Verify integrity</button><button className="border rounded px-3 py-1" onClick={() => setSelectedFile(file)}>View image</button></div>
      </div>)}</div>}
    {selectedFile && <Suspense fallback={<p role="status" className="mt-4">Loading secure viewer…</p>}><DicomViewer file={selectedFile} onClose={() => setSelectedFile(null)} /></Suspense>}
  </section>;
}
