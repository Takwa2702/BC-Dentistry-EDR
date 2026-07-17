import { useId } from 'react';
const PatientRequestInput = ({header, placeHolder, value, onChange, classes}) => { const inputId=useId(); return <div className="patient-name w-full"><label htmlFor={inputId} className={`text-sm ${classes}`}>{header}</label><input id={inputId} type="text" placeholder={placeHolder} className="border-b h-8 w-full italic opacity-50 p-1 outline-none text-black" value={value} onChange={onChange}/></div>; };
export default PatientRequestInput;
