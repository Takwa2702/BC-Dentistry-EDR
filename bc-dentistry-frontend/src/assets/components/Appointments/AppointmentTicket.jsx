import { useState } from 'react';
import ActionDialog from '../ActionDialog.jsx';

const AppointmentTicket = ({ date, reason, dr, id, name, specialty, status, canManage = false, onUpdate, onCancel }) => {
  const [dialog, setDialog] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const execute = async () => {
    if (!value) return setError(dialog === 'update' ? 'Choose a new appointment date and time.' : 'Enter a cancellation reason.');
    setBusy(true); setError('');
    try { if (dialog === 'update') await onUpdate?.({ appointmentDateTime: value }); else await onCancel?.(value); setDialog(''); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const formattedDate = date ? new Date(date).toLocaleString() : 'Date not set';
  return <article className="appointment-ticket col-span-12 bg-white p-5 flex flex-col gap-y-3 rounded-xl border md:col-span-6 xl:col-span-4 2xl:col-span-3">
    <div className="date-time bg-blue-900 px-3 py-2 text-white rounded-md">{formattedDate}</div><h3 className="break-words text-2xl font-bold">{reason}</h3><p className="break-words font-semibold">{specialty || 'General dentistry'} · Dr. {dr}</p><p className="break-words">Patient: {name}</p><p>ID: {id}</p><p className="capitalize">Status: {status}</p>
    {canManage && status !== 'cancelled' && <div className="flex gap-2"><button type="button" onClick={() => { setValue(String(date || '').slice(0,16)); setError(''); setDialog('update'); }} className="border border-blue-800 px-3 py-2 rounded">Update</button><button type="button" onClick={() => { setValue(''); setError(''); setDialog('cancel'); }} className="border border-red-700 text-red-700 px-3 py-2 rounded">Cancel</button></div>}
    {dialog && <ActionDialog title={dialog === 'update' ? 'Update appointment' : 'Cancel appointment'} description={dialog === 'update' ? 'Choose the new scheduled date and time.' : 'Provide a reason for the patient record (maximum 1,000 characters).'} confirmLabel={dialog === 'update' ? 'Save appointment' : 'Cancel appointment'} danger={dialog === 'cancel'} busy={busy} error={error} onClose={() => setDialog('')} onConfirm={execute}><label className="text-sm font-semibold">{dialog === 'update' ? 'Date and time' : 'Cancellation reason'}{dialog === 'update' ? <input type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 block w-full rounded-md border p-3" /> : <textarea maxLength={1000} value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 block min-h-28 w-full rounded-md border p-3" />}</label></ActionDialog>}
  </article>;
};
export default AppointmentTicket;
