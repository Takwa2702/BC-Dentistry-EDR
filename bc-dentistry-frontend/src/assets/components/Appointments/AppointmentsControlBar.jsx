import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import NewAppointmentDialog from './NewAppointmentDialog';
import SetNewAppointment from './SetNewAppointment';
import { useRole } from '../../Context/RoleContext.jsx';

const AppointmentsControlBar = ({ filters, onFiltersChange, onCreated }) => {
  const { userRole } = useRole();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const updateFilter = (key, value) => onFiltersChange?.({ ...filters, [key]: value });

  return <div id="AppointmentsControlBar" className="col-span-12 flex w-full flex-col gap-3 rounded-xl border bg-white p-4 lg:flex-row lg:items-center lg:justify-end">
    <h4 className="font-semibold lg:mr-2">Appointments:</h4>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <input aria-label="Search appointments" value={filters?.search || ''} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search patient, doctor, or reason" className="min-w-56 rounded border border-gray-300 px-3 py-2 text-sm" />
      <TextField select value={filters?.period || 'Day'} sx={{ minWidth: { xs: '100%', sm: 150 } }} size="small" onChange={(event) => updateFilter('period', event.target.value)}><MenuItem value="Day">This day</MenuItem><MenuItem value="Week">This week</MenuItem><MenuItem value="Month">This month</MenuItem><MenuItem value="All">All dates</MenuItem></TextField>
      <TextField select value={filters?.sort || 'Recent'} sx={{ minWidth: { xs: '100%', sm: 150 } }} size="small" onChange={(event) => updateFilter('sort', event.target.value)}><MenuItem value="Name">Patient name</MenuItem><MenuItem value="Recent">Most recent</MenuItem><MenuItem value="Doctor">Doctor name</MenuItem><MenuItem value="Status">Status</MenuItem></TextField>
    </div>
    {userRole === 'admin' && <><SetNewAppointment clickFunc={() => setDialogOpen(true)} />{isDialogOpen && <NewAppointmentDialog onClose={() => setDialogOpen(false)} onCreated={onCreated} />}</>}
  </div>;
};

export default AppointmentsControlBar;
