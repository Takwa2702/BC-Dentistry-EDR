import { AppointmentsControlBar } from "../../components";
import MainContainer from "../../components/MainContainer";
import AppointmentsStatstics from "./AppointmentsStatstics";


const AppointmentsBar = ({ onCreated }) => {
    return (
        <MainContainer Id={"AppointmentControlBar"} classes={'gap-y-4'}>
            <AppointmentsControlBar onCreated={onCreated} />
            <AppointmentsStatstics />
        </MainContainer>
    )
}

export default AppointmentsBar;
