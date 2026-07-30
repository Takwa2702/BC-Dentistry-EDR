import { useEffect, useState } from "react";
import { Appointment } from "../../components";
import Alarm1 from "../../images/icons/alarm1.svg";
import Alarm2 from "../../images/icons/alarm2.svg";
import { authHeaders, databaseUrl } from "../../config/api.js";

const Appointments = () => {
    const [appointments, setAppointments] = useState([]);

    useEffect(() => {
        let active = true;
        fetch(databaseUrl('/appointments'), { headers: authHeaders() })
            .then((response) => response.ok ? response.json() : Promise.reject())
            .then((payload) => { if (active) setAppointments(payload.data || []); })
            .catch(() => { if (active) setAppointments([]); });
        return () => { active = false; };
    }, []);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = appointments.filter((item) => !item.Date || new Date(item.Date) >= today).length;

    return (
        <div id="AppointmentsSection" className="grid grid-cols-2 gap-4 justify-start col-span-4">
            <Appointment header={appointments.length} subheader="Scoped appointments" icon={Alarm1}/>
            <Appointment header={upcoming} subheader="Upcoming appointments" icon={Alarm2}/>
        </div>
    );
};

export default Appointments;
