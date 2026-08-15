import { Appointment } from "../../components";
import Alarm1 from "../../images/icons/alarm1.svg"
import Alarm2 from "../../images/icons/alarm2.svg"
import Alarm3 from "../../images/icons/alarm3.svg"
import Visitors from "../../images/icons/visitors.svg"

const AppointmentsStatstics = ({ appointments = [], loading = false }) => {
    const statusCounts = appointments.reduce((counts, appointment) => {
        const status = String(appointment.Status ?? appointment.status ?? '').toLowerCase();
        if (status === 'pending' || status === 'scheduled') counts.pending += 1;
        if (status === 'cancelled' || status === 'canceled') counts.cancelled += 1;
        if (status === 'completed' || status === 'complete' || status === 'finished' || status === 'done' || status === 'confirmed') counts.finished += 1;
        return counts;
    }, { pending: 0, cancelled: 0, finished: 0 });
    const display = (value) => loading ? '—' : value;


    return (
        <div id="AppointmentsStatstics" aria-busy={loading} className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Appointment header={display(appointments.length)} subheader={"All appointments"} icon={Alarm1}/>
            <Appointment header={display(statusCounts.pending)} subheader={"Pending appointments"} icon={Alarm2}/>
            <Appointment header={display(statusCounts.cancelled)} subheader={"Canceled appointments"} icon={Alarm3}/>
            <Appointment header={display(statusCounts.finished)} subheader={"Finished appointments"} icon={Visitors}/>
            <Appointment header={display(new Set(appointments.map((appointment) => appointment.Patient_ID ?? appointment.patientID).filter(Boolean)).size)} subheader={"Total visitors"} icon={Alarm1}/>
        </div>
    )
}


export default AppointmentsStatstics;
