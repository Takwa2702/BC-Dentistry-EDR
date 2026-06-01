import DetailInfo from "./DetailInfo";

const Medications = ({index, medicationDetails}) => {
    return (
        <div className="Medications flex flex-col gap-y-2">
            <h1 className="text-xl font-semibold">Medication #{index}</h1>
            <div className="info grid grid-cols-3 gap-y-3">
                <DetailInfo header={'Medication id'} info={medicationDetails.medicationId} />
                <DetailInfo header={'Drug Name'} info={medicationDetails.drugName} />
                <DetailInfo header={'Type'} info={medicationDetails.type} />
                <DetailInfo header={'Doses'} info={medicationDetails.doses} />
                <DetailInfo header={'Strength'} info={medicationDetails.strength} />
                <DetailInfo header={'Intake time'} info={medicationDetails.intakeTime} />
                <DetailInfo header={'Frequency'} info={medicationDetails.frequency} />

            </div>
        </div>
    )
}

export default Medications;