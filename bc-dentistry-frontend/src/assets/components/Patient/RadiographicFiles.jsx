import { lazy, Suspense, useEffect, useState } from "react";
import axios from "axios";
import { authHeaders, blockchainUrl } from "../../config/api.js";

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
  const [selectedFile, setSelectedFile] = useState(null);

  const loadFiles = async () => {
    try {
      const response = await axios.get(blockchainUrl(`/patients/${patientID}/radiographic-files`), { headers: authHeaders() });
      setFiles(response.data.data || []);
    } catch (error) { setMessage(error.response?.data?.error?.message || "Unable to load radiographic files."); }
  };

  useEffect(() => { loadFiles(); }, [patientID]);

  const verify = async (fileID) => {
    try {
      const response = await axios.get(blockchainUrl(`/radiographic-files/${fileID}/verify-integrity`), { headers: authHeaders() });
      setStatuses((current) => ({ ...current, [fileID]: response.data.data.status }));
    } catch (error) { setStatuses((current) => ({ ...current, [fileID]: "unknown" })); }
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("Uploading and anchoring SHA-256 metadata…");
    try {
      await axios.post(blockchainUrl("/radiographic-files"), file, { headers: authHeaders({
        "Content-Type": "application/octet-stream", "x-patient-id": patientID,
        "x-file-name": file.name, "x-file-media-type": file.type || "application/octet-stream",
      }) });
      setMessage("Upload complete.");
      await loadFiles();
    } catch (error) { setMessage(error.response?.data?.error?.message || "Upload failed."); }
    event.target.value = "";
  };

  return <section className="bg-white rounded-md p-5">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-bold">DICOM & Radiographic Integrity</h2>
      {canUpload && <label className="cursor-pointer bg-blue-600 text-white rounded px-4 py-2">
        Upload file<input className="hidden" type="file" accept=".dcm,application/dicom,image/*" onChange={upload} />
      </label>}
    </div>
    {message && <p className="mt-2 text-sm">{message}</p>}
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
