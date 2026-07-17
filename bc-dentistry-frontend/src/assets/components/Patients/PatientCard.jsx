import { Link } from 'react-router-dom';
import { databaseUrl, jsonHeaders } from '../../config/api.js';
import { getStoredUser } from '../../utils/auth.js';

const PatientCard = ({ patientId, fullName, age, gender, insurance, medicalRecord, dentalRecord, patient, onChanged }) => {
    const isAdmin = getStoredUser()?.role?.toLowerCase() === 'admin';
    const assign = async () => {
        const doctorID = window.prompt('Doctor blockchain ID to assign');
        if (!doctorID) return;
        const response = await fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}/assign`), { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ doctorID }) });
        const result = await response.json();
        if (!response.ok) return window.alert(result?.error?.message || 'Assignment failed');
        onChanged?.();
    };
    const edit = async () => {
        const contactNumber = window.prompt('Contact number', patient.contactNumber);
        if (contactNumber === null) return;
        const payload = { ...patient, contactNumber };
        const response = await fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}`), { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) return window.alert(result?.error?.message || 'Update failed');
        onChanged?.();
    };
    const remove = async () => {
        if (!window.confirm(`Delete ${fullName}? This removes the MySQL identity and Fabric metadata reference.`)) return;
        const response = await fetch(databaseUrl(`/patients/${encodeURIComponent(patientId)}`), { method: 'DELETE', headers: jsonHeaders() });
        const result = await response.json();
        if (!response.ok) return window.alert(result?.error?.message || 'Delete failed');
        onChanged?.();
    };
    return <div className="patient-card bg-white border rounded-xl p-6 flex flex-col gap-y-2 min-h-64 justify-between">
        <p className="id text-gray-500 text-sm">ID: {patientId}</p>
        <Link to={`/patients/${patientId}`}><h2 className="text-xl font-bold">{fullName}</h2></Link>
        <div><span className="font-semibold">Age: </span>{age} · {gender}</div>
        <div><span className="font-semibold">Insurance: </span>{insurance}</div>
        <Link className="text-sm font-semibold text-blue-700 underline" to={`/patients/${patientId}`}>View authorized patient record</Link>
        {isAdmin && <div className="flex gap-2 text-sm"><button onClick={edit} className="border p-2 rounded">Update</button><button onClick={assign} className="border p-2 rounded">Assign</button><button onClick={remove} className="border border-red-600 text-red-700 p-2 rounded">Delete</button></div>}
    </div>;
};

export default PatientCard;
