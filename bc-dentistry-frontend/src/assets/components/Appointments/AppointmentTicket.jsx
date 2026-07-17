import { useState } from 'react';

const AppointmentTicket = ({ date, reason, dr, id, name, specialty, status, onUpdate, onCancel }) => {
    const [error, setError] = useState('');
    const update = async () => {
        const appointmentDateTime = window.prompt('New appointment date/time (YYYY-MM-DDTHH:mm)', String(date || '').slice(0, 16));
        if (!appointmentDateTime) return;
        try { setError(''); await onUpdate?.({ appointmentDateTime }); } catch (reasonValue) { setError(reasonValue.message); }
    };
    const cancel = async () => {
        const cancelReason = window.prompt('Cancellation reason');
        if (cancelReason === null) return;
        try { setError(''); await onCancel?.(cancelReason); } catch (reasonValue) { setError(reasonValue.message); }
    };
    const formattedDate = date ? new Date(date).toLocaleString() : 'Date not set';
    return (
        <article className="appointment-ticket col-span-5 xl:col-span-4 2xl:col-span-3 bg-white p-5 flex flex-col gap-y-3 rounded-xl border">
            <div className="date-time bg-blue-900 px-3 py-2 text-white rounded-md">{formattedDate}</div>
            <h3 className="text-2xl font-bold">{reason}</h3>
            <p className="font-semibold">{specialty} · Dr. {dr}</p>
            <p>Patient: {name}</p><p>ID: {id}</p><p className="capitalize">Status: {status}</p>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            {status !== 'cancelled' && <div className="flex gap-2"><button onClick={update} className="border border-blue-800 px-3 py-2 rounded">Update</button><button onClick={cancel} className="border border-red-700 text-red-700 px-3 py-2 rounded">Cancel</button></div>}
        </article>
    );
};

export default AppointmentTicket;
