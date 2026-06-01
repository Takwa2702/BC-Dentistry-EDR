import { View, Text, ScrollView } from 'react-native'
import React, { useEffect } from 'react'

import { Appointment } from './index'


import { appointmentsData } from "../data"


const Appointments = ({status}) => {

    
    useEffect(() => {
        console.log(appointmentsData.filter((a) => String(a.status).toLowerCase() == String(status).toLowerCase()));
    }, [status])



  return (
    <ScrollView className="h-[42vh]">
        <View className="flex flex-col gap-y-4 mt-2">
            {
                appointmentsData.filter((appointment) => String(appointment.status).toLowerCase() == String(status).toLowerCase()).map((appointment) => {
                    return (
                        <Appointment
                            key={appointment.dr.name}
                            date={appointment.date}
                            time={appointment.time}
                            dr={appointment.dr}
                        />
                    )
                })
            }


        </View>
    </ScrollView>
  )
}

export default Appointments