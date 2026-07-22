import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import NewAppointmentDialog from './NewAppointmentDialog';
import SetNewAppointment from './SetNewAppointment';
import { useRole } from '../../Context/RoleContext.jsx';

const AppointmentsControlBar = ({ onCreated }) => {
  const { userRole } = useRole();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('Day');
  const [filterOption, setFilterOption] = useState('Recent');

  return <div id="AppointmentsControlBar" className="col-span-12 flex w-full flex-col gap-3 rounded-xl border bg-white p-4 lg:flex-row lg:items-center lg:justify-end">
    <h4 className="font-semibold lg:mr-2">Appointments:</h4>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <TextField select value={filterPeriod} sx={{ minWidth: { xs: '100%', sm: 150 } }} size="small" onChange={(event) => setFilterPeriod(event.target.value)}><MenuItem value="Day">This day</MenuItem><MenuItem value="Week">This week</MenuItem><MenuItem value="Month">This month</MenuItem></TextField>
      <TextField select value={filterOption} sx={{ minWidth: { xs: '100%', sm: 150 } }} size="small" onChange={(event) => setFilterOption(event.target.value)}><MenuItem value="Name">Name</MenuItem><MenuItem value="Recent">Recent</MenuItem><MenuItem value="Doctor">Doctor</MenuItem><MenuItem value="Status">Status</MenuItem></TextField>
    </div>
    {userRole === 'admin' && <><SetNewAppointment clickFunc={() => setDialogOpen(true)} />{isDialogOpen && <NewAppointmentDialog onClose={() => setDialogOpen(false)} onCreated={onCreated} />}</>}
  </div>;
};

export default AppointmentsControlBar;
