import { useState, useEffect } from 'react';
import { MainContainer } from "../../components";
import AppointmentTicket from "../../components/Appointments/AppointmentTicket";
import { authHeaders, databaseUrl, handleUnauthorizedResponse } from '../../config/api.js';
import { useRole } from '../../Context/RoleContext.jsx';

const AppointmentsSection = ({ refreshKey = 0 }) => {
    const [appointmentsTickets, setAppointmentsTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { userRole } = useRole();
    const isPatient = userRole?.toLowerCase() === 'patient';

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
                canManage={!isPatient && userRole?.toLowerCase() === 'admin'}
                onUpdate={(body) => mutateAppointment(appointment.Appointment_ID, 'update', body)}
                onCancel={(reason) => mutateAppointment(appointment.Appointment_ID, 'cancel', { reason })}
            />
        );
    });

    const now = Date.now();
    const upcomingAppointments = allAppointments.filter((_, index) => {
        const appointment = appointmentsTickets[index];
        return appointment.Status !== 'cancelled' && new Date(appointment.Appointment_Date_Time || appointment.Date).getTime() >= now;
    });
    const pastAppointments = allAppointments.filter((_, index) => {
        const appointment = appointmentsTickets[index];
        return appointment.Status === 'cancelled' || new Date(appointment.Appointment_Date_Time || appointment.Date).getTime() < now;
    });

    return (
        <MainContainer Id="AppointmentsSection" classes={'mt-6 gap-y-6'}>
            {loading && <p>Loading appointments...</p>}
            {!loading && error && <p role="alert">{error}</p>}
            {!loading && !error && allAppointments.length === 0 && <p>No appointments found.</p>}
            {!loading && !error && isPatient && allAppointments.length > 0 && <>
                <section aria-labelledby="upcoming-appointments" className="col-span-12 grid grid-cols-12 gap-6"><h2 id="upcoming-appointments" className="col-span-12 text-xl font-bold">Upcoming appointments</h2>{upcomingAppointments.length ? upcomingAppointments : <p className="col-span-12">No upcoming appointments.</p>}</section>
                <section aria-labelledby="past-appointments" className="col-span-12 grid grid-cols-12 gap-6"><h2 id="past-appointments" className="col-span-12 text-xl font-bold">Past and cancelled appointments</h2>{pastAppointments.length ? pastAppointments : <p className="col-span-12">No past appointments.</p>}</section>
            </>}
            {!loading && !error && !isPatient && allAppointments}
        </MainContainer>
    );
};

export default AppointmentsSection;
