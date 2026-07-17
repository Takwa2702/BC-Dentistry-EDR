import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Appointment } from './index';
import { useUser } from '../Context/UserContext';
import { authHeaders, databaseUrl } from '../utils/api';

const Appointments = ({ status }) => {
  const { token } = useUser();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true); setError('');
        const response = await fetch(databaseUrl(`/appointments?period=${encodeURIComponent(status)}`), { headers: authHeaders(token) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load appointments');
        if (active) setAppointments(Array.isArray(payload.data) ? payload.data : []);
      } catch (reason) { if (active) setError(reason.message); } finally { if (active) setLoading(false); }
    };
    if (token) load();
    return () => { active = false; };
  }, [status, token]);

  const grouped = appointments.reduce((result, appointment) => {
    const specialty = appointment.Specialty || 'General Dentistry';
    (result[specialty] ||= []).push(appointment);
    return result;
  }, {});

  if (loading) return <ActivityIndicator accessibilityLabel="Loading appointments" />;
  if (error) return <Text className="text-red-700">{error}</Text>;
  if (!appointments.length) return <Text className="text-gray-500 py-4">No {status} appointments.</Text>;
  return (
    <ScrollView className="h-[42vh]">
      {Object.entries(grouped).map(([specialty, rows]) => <View key={specialty} className="mb-5"><Text className="text-lg font-bold mb-2">{specialty}</Text><View className="flex flex-col gap-y-4">{rows.map((appointment) => <Appointment key={appointment.Appointment_ID} date={appointment.Appointment_Date_Time || appointment.Date} dr={{ name: appointment.Doctor_Name || appointment.Doctor_ID, specialization: specialty }} reason={appointment.Meeting_For} status={appointment.Status} />)}</View></View>)}
    </ScrollView>
  );
};

export default Appointments;
