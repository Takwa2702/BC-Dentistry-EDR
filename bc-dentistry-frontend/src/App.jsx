import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import Home from './assets/Pages/Home.jsx';
import Patients from './assets/Pages/Patients.jsx';
import Doctors from './assets/Pages/Doctors.jsx';
import Appointments from './assets/Pages/Appointments.jsx';
import DataRequests from './assets/Pages/DataRequests.jsx';
import LabResults from './assets/Pages/LabResults.jsx';
import Settings from './assets/Pages/Settings.jsx';
import Info from './assets/Pages/Info.jsx';
import Login from './assets/Pages/Login.jsx';
import Navbar from "./assets/Sections/Navbar.jsx"
import Topbar from "./assets/Sections/Topbar.jsx"
import { getStoredUser, getStoredUserRole } from "./assets/utils/auth.js";
import ProtectedRoute from "./assets/components/ProtectedRoute.jsx";

const Patient = lazy(() => import('./assets/Pages/Patient.jsx'));

const PatientSelfRecord = () => {
  const patientID = getStoredUser()?.blockchainID;
  if (!patientID) return <div role="alert" className="m-8 rounded-xl border border-red-300 bg-red-50 p-6 text-red-800">Your patient account is missing its record identity. Contact the system administrator.</div>;
  return <Patient patientID={patientID} />;
};

function App() {
  const [, setSessionTick] = useState(0);
  const homePaths = ["/", "/login", "/unauthorized"]
  const location = useLocation();
  const isHomePath = homePaths.includes(location.pathname.toLowerCase());
  const role = getStoredUserRole();
  useEffect(() => {
    const refreshSession = () => setSessionTick((value) => value + 1);
    window.addEventListener('edr-session-expired', refreshSession);
    const timer = window.setInterval(refreshSession, 30000);
    return () => { window.removeEventListener('edr-session-expired', refreshSession); window.clearInterval(timer); };
  }, []);
  return (
    <div className="min-h-screen w-full p-3 md:p-5 lg:flex lg:gap-5">
      
      {!isHomePath && <Navbar />}
      <main id="main-content" tabIndex="-1" className="min-w-0 flex-1 rounded-md pt-16 lg:ml-[15.5%] lg:w-[84.5%] lg:pt-0">
      {/**!homePaths.includes(location.pathname) && <Topbar />**/}
          {!isHomePath && <Topbar />}
        <Routes>
          <Route path="/" element={<Login/>} /> 
          <Route path="/login" element={<Login/>} />
          <Route path="/dashboard" element={<ProtectedRoute roles={['admin','doctor']}><Home/></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute roles={['admin','doctor']}><Appointments/></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute roles={['admin','doctor']}><Patients/></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute roles={['admin','doctor']}><Suspense fallback={<div role="status">Loading patient record…</div>}><Patient/></Suspense></ProtectedRoute>} />
          <Route path="/my-record" element={<ProtectedRoute roles={['patient']}><Suspense fallback={<div role="status">Loading patient record…</div>}><PatientSelfRecord/></Suspense></ProtectedRoute>} />
          <Route path="/doctors" element={<ProtectedRoute roles={['admin']}><Doctors/></ProtectedRoute>} />
          <Route path="/datarequests" element={<ProtectedRoute roles={['admin']}><DataRequests/></ProtectedRoute>} />
          <Route path="/labresults" element={<ProtectedRoute roles={['admin','doctor']}><LabResults/></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute roles={['admin','doctor']}><Settings/></ProtectedRoute>} />
          <Route path="/info" element={<ProtectedRoute roles={['admin','doctor']}><Info/></ProtectedRoute>} />
          <Route path="/unauthorized" element={<div role="alert" className="m-8 rounded-xl border bg-white p-6">You are not authorized to view this page.</div>} />
          <Route path="*" element={<Navigate to={role === 'patient' ? '/my-record' : role ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App;
