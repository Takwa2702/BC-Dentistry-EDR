import DentalChart from "./DentalChart";
import DentalInfo from "./DentalInfo";

import DicomViewer from "./DicomViewer"

import { useContext } from "react";
import { TeethContextContainer } from "../../Context/TeethContext";

const DentalRecord = ({dentalDetails}) => {

    // console.log(dentalDetails);
    
    return (
        <div className="DentalRecord mb-8 bg-white border rounded-xl flex items-left flex flex-col gap-6 w-full px-16 py-6 h-auto">
            <h1 className="text-3xl font-bold">Dental Record <span className="text-xl italic text-gray-300 font-light uppercase">id {dentalDetails['id']}</span></h1>
            <div className="flex justify-between gap-x-8 w-full">

                <TeethContextContainer>
                    <DentalChart dentalTeethDetails={dentalDetails}  />
                    <DentalInfo  details={dentalDetails}/> 
                </TeethContextContainer>


            </div>


            <DicomViewer />




        </div>
    )
}

export default DentalRecord;