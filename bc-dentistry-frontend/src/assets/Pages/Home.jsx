import Appointments from "../Sections/Dashboard/Appointments";
import { MainContainer } from "../components";
import AppointmentsTable from "../components/Dashboard/AppointmentsTable.jsx";

const Home = () => {
    return (
        <MainContainer Id={"Appointments"} classes={'gap-y-10'}>
            <Appointments />
            <div className="col-span-8 rounded-xl border bg-white p-5"><AppointmentsTable /></div>
        </MainContainer>
    )
}

export default Home;
