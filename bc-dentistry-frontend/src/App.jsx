import { Routes, Route, useLocation } from "react-router-dom";
import { Home, Patients, Appointments, DataRequests, LabResults, Settings, Info, Patient, Login, Signup } from "./assets/Pages"
import Navbar from "./assets/Sections/Navbar.jsx"
import Topbar from "./assets/Sections/Topbar.jsx"
import { useRole } from './assets/Context/RoleContext.jsx';
import PagesCover from "./assets/Pages/PagesCover.jsx";

function App() {
  const homePaths = ["/", "/login"]
  const location = useLocation();
  const { userRole } = useRole();
  const user = JSON.parse(localStorage.getItem("user")); // Retrieve user details
  const role = user.role.toLowerCase(); // Convert role to lowercase for comparison
  return (
    <div className="flex w-full p-5 h-[100vh]" style={{gridTemplateColumns: '1fr 5fr'}} >
      
      {!homePaths.includes(location.pathname) && <PagesCover />}
      {!homePaths.includes(location.pathname) && <Navbar />}
      <div className="rounded-md w-[86%] ml-[15.5%]">
      {/**!homePaths.includes(location.pathname) && <Topbar />**/}
          <Topbar />
        <Routes>
          <Route path="/" element={<Login/>} /> 
          <Route path="/login" element={<Login/>} />
          <Route path="/signup" element={<Signup/>} />
          <Route path="/dashboard" element={<Home/>} />
          <Route path="/Appointments" element={<Appointments/>} />
          <Route path="/Patients" element={<Patients/>} />
          <Route path="/Patients/:id" element={<Patient/>} />
          {role == 'admin' && 
          <Route path="/DataRequests" element={<DataRequests/>} />
           } 
          <Route path="/LabResults" element={<LabResults/>} />
          <Route path="/Settings" element={<Settings/>} />
          <Route path="/Info" element={<Info/>} />
        </Routes>
      </div>
    </div>
  )
}

export default App;
