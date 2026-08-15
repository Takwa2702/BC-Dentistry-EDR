import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Appointment } from './index';
import apiClient, { databaseUrl } from '../services/apiClient';

const Appointments = ({ status }) => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                setLoading(true);
                const periodParam = String(status).toLowerCase() === 'past' ? 'past' : 'upcoming';
                const response = await apiClient.get(databaseUrl(`/appointments?period=${periodParam}`));

                const list = Array.isArray(response.data?.data)
                    ? response.data.data
                    : Array.isArray(response.data)
                        ? response.data
                        : response.data?.appointments || [];

                // Sort chronologically
                list.sort((a, b) => {
                    const dateA = new Date(a.Appointment_Date_Time || a.Date || a.appointmentDateTime || 0);
                    const dateB = new Date(b.Appointment_Date_Time || b.Date || b.appointmentDateTime || 0);
                    return periodParam === 'past' ? dateB - dateA : dateA - dateB;
                });

                setAppointments(list);
            } catch (error) {
                console.error('[Appointments] API error:', error.response?.data || error.message);
                setAppointments([]);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
    }, [status]);

    return (
        <ScrollView className="h-[42vh]" showsVerticalScrollIndicator={false}>
            <View className="flex flex-col gap-y-4 mt-2 pb-6">
                {loading ? (
                    <ActivityIndicator size="small" color="#1E3A8A" className="my-6" />
                ) : appointments.length === 0 ? (
                    <Text className="text-center text-gray-500 italic my-6">
                        {status === 'past' ? 'No past appointments found.' : 'No upcoming appointments scheduled.'}
                    </Text>
                ) : (
                    appointments.map((appointment, index) => {
                        const rawDateStr = appointment.Appointment_Date_Time || appointment.Date || appointment.appointmentDateTime || appointment.date;
                        const dateTime = rawDateStr ? new Date(rawDateStr) : null;
                        const formattedDate = dateTime && !isNaN(dateTime) ? dateTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                        const formattedTime = dateTime && !isNaN(dateTime) ? dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

                        const docName = appointment.Doctor_Name || appointment.doctorName || appointment.doctorID || 'Staff Doctor';
                        const spec = (appointment.Specialty && appointment.Specialty.toLowerCase() !== 'none')
                            ? appointment.Specialty
                            : appointment.Meeting_For || appointment.meetingFor || 'General Dentistry';

                        const drObj = appointment.dr || {
                            name: docName,
                            specialization: spec,
                        };

                        return (
                            <Appointment
                                key={appointment.Appointment_ID || appointment.id || appointment.appointmentID || index}
                                date={formattedDate}
                                time={formattedTime}
                                dr={drObj}
                            />
                        );
                    })
                )}
            </View>
        </ScrollView>
    );
};

export default Appointments;
