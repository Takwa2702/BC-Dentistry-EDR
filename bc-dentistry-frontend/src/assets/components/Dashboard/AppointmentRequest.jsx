import { useRef } from "react";

const AppointmentRequest = ({ patientName, time, date, type, status }) => {
    const acceptBtn = useRef();
    const rejectBtn = useRef();

    const doAction = (e) => {
        const targetButton = e.target;

        // Collapse and hide the request regardless of whether it's accepted or rejected
        const appointmentContainer = targetButton.closest(".appointment-request");
        
        // Apply the styles to collapse the request container
        Object.assign(appointmentContainer.style, {
            height: '0',
            padding: '0',
            margin: '0',
            border: 'none'
        });

        // After 3 seconds, set display to "none" to fully hide the container
        setTimeout(() => {
            appointmentContainer.style.display = "none";
        }, 3000);
    };

    return (
        <div className="appointment-request flex flex-col gap-y-2 border rounded-md px-6 py-4 h-36 mb-6 overflow-hidden">
            <h2 className="text-xl font-bold">{patientName}</h2>
            <div>
                <div className="details flex justify-between">
                    <div className="date-time flex justify-between gap-x-2">
                        <div className="date">{date}</div>
                        <div className="time">{time}</div>
                    </div>
                    <div className="type font-semibold">{type}</div>
                </div>
                <div className="action-buttons flex gap-x-4 mt-3">
                    <button
                        ref={rejectBtn}
                        onClick={doAction}
                        className="reject w-1/2 p-1 font-bold text-red-600 border border-red-600 rounded-md text-center"
                    >
                        Reject
                    </button>
                    <button
                        ref={acceptBtn}
                        onClick={doAction}
                        className="accept w-1/2 p-1 font-bold text-white bg-green-600 rounded-md text-center"
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppointmentRequest;
