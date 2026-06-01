// const PatientRequestInput = ({header, placeHolder, classes}) => {
//     return (
//         <div className="patient-name w-full">
//             <label htmlFor="patientName" className={`text-sm ${classes} z-50`}>{header}</label>
//             <input id="patientName" type="text" placeholder={placeHolder} className="border-b h-8 w-full italic opacity-50 p-1  text-black" />
//         </div>
//     )
// }

// export default PatientRequestInput;
const PatientRequestInput = ({header, placeHolder, value, onChange, classes}) => {
    return (
        <div className="patient-name w-full">
            <label htmlFor="patientName" className={`text-sm ${classes}`}>{header}</label>
            <input id="patientName" type="text" placeholder={placeHolder} className="border-b h-8 w-full italic opacity-50 p-1 outline-none text-black" value={value}
                onChange={onChange}/>
        </div>
    )
}

export default PatientRequestInput;