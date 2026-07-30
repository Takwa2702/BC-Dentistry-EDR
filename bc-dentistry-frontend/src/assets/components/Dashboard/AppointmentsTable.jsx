import { useEffect, useState } from 'react';
import AppointmentTableRow from "./AppointmentTableRow";
import { authHeaders, databaseUrl } from '../../config/api.js';

const AppointmentsTable = () => {
    
    const [appointments, setAppointments] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await fetch(databaseUrl('/appointments'), { headers: authHeaders() });
                const payload = await response.json();
                if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load appointments');
                setAppointments(payload.data || []);
            } catch (error) {
                setError(error.message);
            }
        };

        fetchAppointments();
    }, []); 

    const appointmentRows = appointments.map((appointment, index) => {
        return (
            <AppointmentTableRow
                key={index}
                meetingFor={appointment.Meeting_For}
                id={appointment.Appointment_ID}
                patientName={appointment.Patient_ID} 
                doctorName={appointment.Doctor_ID} 
                dateAndTime={appointment.Date} 
            />
        );
    });


    return (
        <div id="AppointmentsTable" className="w-full">
            <h1 className="text-2xl font-bold mb-3">Scheduled meetings</h1>
            <div style={{ gridTemplateColumns: '5fr 2fr 5fr 6fr 8fr 1fr' }} className="table-header grid px-4 py-3 rounded-xl bg-gray-200 mb-3">
                <div>Meeting for</div>
                <div>ID</div>
                <div>Doctor ID</div>
                <div>Patient ID</div>
                <div>Date & Time</div>
                <div>...</div>
            </div>
            {error && <div role="alert" className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
            <div className="flex flex-col">
                {!error && (appointmentRows.length !== 0 ? appointmentRows : <div className='w-full border rounded-xl p-3 text-center'>No upcoming appointments.</div>)}
            </div>
        </div>
    );
};

export default AppointmentsTable;
