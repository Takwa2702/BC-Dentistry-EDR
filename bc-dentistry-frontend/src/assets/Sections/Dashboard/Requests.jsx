import Data from "../../../../data"
import AppointmentRequest from "../../components/Dashboard/AppointmentRequest"

const Requests = () => {
    let a = []
    let appointmentComponent;

    Data.forEach((data) => {
        const allPendings = data.appointments.filter((app) =>  app.status == "pending" )
        const pendingAppointmentName = data.name;
        const ap = {};
        ap[pendingAppointmentName] =  allPendings
        a.push(ap)
        
    })

    const pendingRequests = a.map((req) => {
        if(Object.values(req)[0].length != 0){
                appointmentComponent = Object.values(req)[0].map((reqD, index) => {
                    return <AppointmentRequest key={index} patientName={Object.keys(req)[0]} date={reqD.date} time={reqD.time} type={reqD.type} status={"p"} />
                })
                return appointmentComponent;
        }
    })

    console.log(pendingRequests.filter(req=>req != undefined).length );
    

    return (
        <div id="Requests" className="bg-white rounded-xl border p-4 col-span-4 w-full h-fit">
            <h1 className="text-2xl font-bold mb-6">Appointments requests</h1>
            <div className="flex flex-col">
                {pendingRequests.length == 0 || pendingRequests.filter(req=>req != undefined).length == 0  ?  <div className="text-center w-full border rounded-xl p-3">No requests 📋</div> : pendingRequests}
            </div>
        </div>
    )
}




export default Requests;