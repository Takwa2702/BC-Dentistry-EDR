import { useState, useEffect } from 'react';
import { MainContainer } from "../../components";
import AppointmentTicket from "../../components/Appointments/AppointmentTicket";
import { authHeaders, databaseUrl, handleUnauthorizedResponse } from '../../config/api.js';
import { useRole } from '../../Context/RoleContext.jsx';

const AppointmentsSection = ({ refreshKey = 0, filters, onDataLoaded, onLoadingChange }) => {
    const [appointmentsTickets, setAppointmentsTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { userRole } = useRole();
    const isPatient = userRole?.toLowerCase() === 'patient';

    const fetchAppointments = async () => {
            setLoading(true);
            onLoadingChange?.(true);
            setError('');
            try {
                const response = await fetch(databaseUrl('/appointments'), { headers: authHeaders() });
                handleUnauthorizedResponse(response);
                const data = await response.json();
                if (!response.ok || data?.success === false) {
                    throw new Error(data?.error?.message || 'Unable to load appointments.');
                }
                const appointments = Array.isArray(data?.data) ? data.data : [];
                setAppointmentsTickets(appointments);
                onDataLoaded?.(appointments);
            } catch (error) {
                setError(error.message || 'Unable to load appointments.');
                setAppointmentsTickets([]);
                onDataLoaded?.([]);
            } finally {
                setLoading(false);
                onLoadingChange?.(false);
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

    const startOfPeriod = new Date(); startOfPeriod.setHours(0, 0, 0, 0);
    const endOfPeriod = new Date(startOfPeriod);
    if (filters?.period === 'Day') endOfPeriod.setDate(endOfPeriod.getDate() + 1);
    if (filters?.period === 'Week') {
        const mondayOffset = (startOfPeriod.getDay() + 6) % 7;
        startOfPeriod.setDate(startOfPeriod.getDate() - mondayOffset);
        endOfPeriod.setTime(startOfPeriod.getTime()); endOfPeriod.setDate(endOfPeriod.getDate() + 7);
    }
    if (filters?.period === 'Month') {
        startOfPeriod.setDate(1);
        endOfPeriod.setTime(startOfPeriod.getTime()); endOfPeriod.setMonth(endOfPeriod.getMonth() + 1);
    }
    const query = String(filters?.search || '').trim().toLowerCase();
    const visibleAppointments = appointmentsTickets.filter((appointment) => {
        const appointmentTime = new Date(appointment.Appointment_Date_Time || appointment.Date).getTime();
        const inPeriod = !filters || filters.period === 'All' || (appointmentTime >= startOfPeriod.getTime() && appointmentTime < endOfPeriod.getTime());
        const searchable = [appointment.Patient_Name, appointment.Doctor_Name, appointment.Meeting_For, appointment.Specialty, appointment.Status].filter(Boolean).join(' ').toLowerCase();
        return inPeriod && (!query || searchable.includes(query));
    }).sort((left, right) => {
        if (filters?.sort === 'Name') return String(left.Patient_Name || '').localeCompare(String(right.Patient_Name || ''));
        if (filters?.sort === 'Doctor') return String(left.Doctor_Name || '').localeCompare(String(right.Doctor_Name || ''));
        if (filters?.sort === 'Status') return String(left.Status || '').localeCompare(String(right.Status || ''));
        return new Date(right.Appointment_Date_Time || right.Date) - new Date(left.Appointment_Date_Time || left.Date);
    });

    const allAppointments = visibleAppointments.map((appointment) => {
        return (
            <AppointmentTicket
                key={appointment.Appointment_ID}
                date={appointment.Appointment_Date_Time || appointment.Date}
                reason={appointment.Meeting_For}
                dr={appointment.Doctor_Name || appointment.Doctor_ID}
                id={appointment.Appointment_ID}
                name={appointment.Patient_Name || appointment.Patient_ID}
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
        const appointment = visibleAppointments[index];
        return appointment.Status !== 'cancelled' && new Date(appointment.Appointment_Date_Time || appointment.Date).getTime() >= now;
    });
    const pastAppointments = allAppointments.filter((_, index) => {
        const appointment = visibleAppointments[index];
        return appointment.Status === 'cancelled' || new Date(appointment.Appointment_Date_Time || appointment.Date).getTime() < now;
    });

    return (
        <MainContainer Id="AppointmentsSection" classes={'mt-6 gap-y-6'}>
            {loading && <p className="col-span-12">Loading appointments...</p>}
            {!loading && error && <p role="alert" className="col-span-12">{error}</p>}
            {!loading && !error && allAppointments.length === 0 && <p className="col-span-12 rounded-xl border bg-white p-6">No appointments match the selected filters.</p>}
            {!loading && !error && isPatient && allAppointments.length > 0 && <>
                <section aria-labelledby="upcoming-appointments" className="col-span-12 grid grid-cols-12 gap-6"><h2 id="upcoming-appointments" className="col-span-12 text-xl font-bold">Upcoming appointments</h2>{upcomingAppointments.length ? upcomingAppointments : <p className="col-span-12">No upcoming appointments.</p>}</section>
                <section aria-labelledby="past-appointments" className="col-span-12 grid grid-cols-12 gap-6"><h2 id="past-appointments" className="col-span-12 text-xl font-bold">Past and cancelled appointments</h2>{pastAppointments.length ? pastAppointments : <p className="col-span-12">No past appointments.</p>}</section>
            </>}
            {!loading && !error && !isPatient && allAppointments}
        </MainContainer>
    );
};

export default AppointmentsSection;
