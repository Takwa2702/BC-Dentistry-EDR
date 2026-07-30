import { useState } from 'react';
import AppointmentsBar from "../Sections/Appointments/AppointmentsBar";
import AppointmentsSection from "../Sections/Appointments/AppointmentsSection";
import { useRole } from "../Context/RoleContext.jsx";


const Appointments = () => {
    const [refreshKey, setRefreshKey] = useState(0);
    const { userRole } = useRole();
    const isPatient = userRole?.toLowerCase() === 'patient';
    return (
        <div id="Appointments" className="w-full flex flex-col mb-24">
            {isPatient
                ? <header className="rounded-xl border bg-white p-6"><h1 className="text-2xl font-bold">My Appointments</h1><p className="mt-2 text-gray-600">Review your upcoming and past appointments.</p></header>
                : <AppointmentsBar onCreated={() => setRefreshKey((value) => value + 1)} />}
            <AppointmentsSection refreshKey={refreshKey} />

        </div>
    )
}

export default Appointments;
