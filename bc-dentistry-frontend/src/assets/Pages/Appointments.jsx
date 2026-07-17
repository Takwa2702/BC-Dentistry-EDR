import { useState } from 'react';
import AppointmentsBar from "../Sections/Appointments/AppointmentsBar";
import AppointmentsSection from "../Sections/Appointments/AppointmentsSection";


const Appointments = () => {
    const [refreshKey, setRefreshKey] = useState(0);
    return (
        <div id="Appointments" className="w-full flex flex-col mb-24">
            <AppointmentsBar onCreated={() => setRefreshKey((value) => value + 1)} />
            <AppointmentsSection refreshKey={refreshKey} />

        </div>
    )
}

export default Appointments;
