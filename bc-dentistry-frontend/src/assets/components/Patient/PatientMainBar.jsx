const PatientMainBar = ({id, fullName, dob, gender}) => {
    const initials = String(fullName || 'Patient')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
    return (
        <div id="PatientMainBar" className="flex flex-col items-start gap-6 rounded-xl border bg-white px-6 py-6 sm:flex-row sm:items-center lg:px-14">
            <div className="patient-pfp flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-blue-100 text-4xl font-bold text-blue-950" role="img" aria-label={`${fullName || 'Patient'} avatar`}>
                {initials}
            </div>
            <div className="patient-info flex min-w-0 w-full flex-col sm:p-3">
                <div className="patient-id text-gray-300 text-sm">Emirates Id: {id}</div>
                <div className="patient-full-name mb-2 w-full break-words text-3xl font-bold sm:text-5xl">{fullName}</div>
                <div className="flex w-fit flex-col gap-2 sm:flex-row sm:gap-x-6">
                    <p className="patient-dob text-lg sm:text-xl">Date of Birth: {dob}</p>
                    <p className="patient-gender text-lg">Gender: {gender}</p>
                    
                </div>
            </div>
        </div>
    )
}

export default PatientMainBar;
