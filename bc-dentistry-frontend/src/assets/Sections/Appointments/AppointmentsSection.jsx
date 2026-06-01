import { useState, useEffect } from 'react';
import { MainContainer } from "../../components";
import AppointmentTicket from "../../components/Appointments/AppointmentTicket";

const AppointmentsSection = () => {
    // State to store fetched appointments data
    const [appointmentsTickets, setAppointmentsTickets] = useState([]);

    // Fetch appointments from the backend API when the component mounts
    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await fetch("http://localhost:8080/Appointment"); // Adjust the endpoint if needed
                const data = await response.json();
                setAppointmentsTickets(data); // Set the fetched data to the state
            } catch (error) {
                console.error("Error fetching appointments:", error);
            }
        };

        fetchAppointments();
    }, []);

    // Map fetched appointments to AppointmentTicket components
    const allAppointments = appointmentsTickets.map((appointment, index) => {
        return (
            <AppointmentTicket
                key={index}
                date={appointment.Date}
                reason={appointment.Meeting_For}
                dr={appointment.Doctor_ID}
                id={appointment.Appointment_ID}
                name={appointment.Patient_ID}
                status={appointment.status}
            />
        );
    });

    return (
        <MainContainer Id="AppointmentsSection" classes={'mt-6 gap-y-6'}>
            {allAppointments}
        </MainContainer>
    );
};

export default AppointmentsSection;