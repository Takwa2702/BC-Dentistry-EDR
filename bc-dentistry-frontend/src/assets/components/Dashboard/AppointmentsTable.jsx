import { useEffect, useState } from 'react';
import AppointmentTableRow from "./AppointmentTableRow";

const AppointmentsTable = () => {
    
    const [appointments, setAppointments] = useState([]);

    // Fetch data from the API when the component mounts
    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const response = await fetch("http://localhost:8080/Appointment"); 
                const data = await response.json();
                setAppointments(data); 
            } catch (error) {
                console.error("Error fetching appointments:", error);
            }
        };

        fetchAppointments();
    }, []); 

    // Process the fetched appointments and render rows
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


    console.log(appointmentRows.length)

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
            <div className="flex flex-col">
                {appointmentRows.length != 0 ? appointmentRows : <div className='w-full border rounded-xl p-3 text-center'>No upcomin events to view 🦷📅❌...</div>}
            </div>
        </div>
    );
};

export default AppointmentsTable;