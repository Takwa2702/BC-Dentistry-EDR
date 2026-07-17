import { useState, useEffect } from 'react';
import { MainContainer } from "../../components";
import AppointmentTicket from "../../components/Appointments/AppointmentTicket";
import { authHeaders, databaseUrl, handleUnauthorizedResponse } from '../../config/api.js';

const AppointmentsSection = ({ refreshKey = 0 }) => {
    const [appointmentsTickets, setAppointmentsTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchAppointments = async () => {
            try {
                const response = await fetch(databaseUrl('/appointments'), { headers: authHeaders() });
                handleUnauthorizedResponse(response);
                const data = await response.json();
                if (!response.ok || data?.success === false) {
                    throw new Error(data?.error?.message || 'Unable to load appointments.');
                }
                setAppointmentsTickets(Array.isArray(data?.data) ? data.data : []);
            } catch (error) {
                setError(error.message || 'Unable to load appointments.');
            } finally {
                setLoading(false);
            }
        };
    useEffect(() => {
        fetchAppointments();
    }, [refreshKey]);

    const mutateAppointment = async (id, action, body = {}) => {
        const path = action === 'cancel' ? `/appointments/${id}/cancel` : `/appointments/${id}`;
        const response = await fetch(databaseUrl(path), { method: action === 'cancel' ? 'PATCH' : 'PUT', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
        handleUnauthorizedResponse(response);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || `Unable to ${action} appointment`);
        await fetchAppointments();
    };

    const allAppointments = appointmentsTickets.map((appointment, index) => {
        return (
            <AppointmentTicket
                key={index}
                date={appointment.Appointment_Date_Time || appointment.Date}
                reason={appointment.Meeting_For}
                dr={appointment.Doctor_ID}
                id={appointment.Appointment_ID}
                name={appointment.Patient_ID}
                specialty={appointment.Specialty}
                status={appointment.Status}
                onUpdate={(body) => mutateAppointment(appointment.Appointment_ID, 'update', body)}
                onCancel={(reason) => mutateAppointment(appointment.Appointment_ID, 'cancel', { reason })}
            />
        );
    });

    return (
        <MainContainer Id="AppointmentsSection" classes={'mt-6 gap-y-6'}>
            {loading && <p>Loading appointments...</p>}
            {!loading && error && <p role="alert">{error}</p>}
            {!loading && !error && allAppointments.length === 0 && <p>No appointments found.</p>}
            {!loading && !error && allAppointments}
        </MainContainer>
    );
};

export default AppointmentsSection;
