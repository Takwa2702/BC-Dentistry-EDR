// import { useContext, useState } from "react";
// import { TeethContext } from "../../Context/TeethContext";

// import Data from "../../../../data";
// import { useLocation } from "react-router-dom";
// import ToothFraction from "./Tooth/ToothFraction";

// const DentalInfo = () => {
//     const patientId = useLocation().pathname.split('/')[2];

//     const {toothSite, setToothSite} = useContext(TeethContext);
//     const {toothFraction, setToothFraction} = useContext(TeethContext);

//     let a = Data.filter((patient)=>{
//         return patient.id == patientId
//     })


//     if(toothSite){
//         // console.log(toothSite);
//         // console.log(a[0]['dental-details'].teeth);
//         // console.log(a[0]['dental-details'].teeth[toothSite]);
//         console.log(Object.entries(a[0]['dental-details'].teeth[toothSite]["Suf"]));
//         console.log('\n\n');

//     }


//     if(a[0]['dental-details'].teeth[toothSite]){
//         // console.log(a[0]['dental-details'].teeth[toothSite]['Suf']['Mesial']);
//     return (
//         <div className="info flex flex-wrap gap-x-4 w-2/12 overflow-hidden">
//             <div className="flex bg">
//                 <h4 className="font-bold">Site:</h4>
//                 <p>{toothSite}</p>
//             </div>

//             <div className="flex">
//                 <h4 className="font-bold">Category:</h4>
//                 <p>{a[0]['dental-details'].teeth[toothSite]['Category']}</p>
//             </div>

//             <div className="flex">
//                 <h4 className="font-bold">Code:</h4>
//                 <p>{a[0]['dental-details'].teeth[toothSite]['Code']}</p>
//             </div>


//             <div className="flex flex-col grow w-full h-48">
//                 <h3 className="text-2xl font-bold">Suf:</h3>
//                 <div className="grid grid-cols-3">
//                     {
//                         Object.entries(a[0]['dental-details'].teeth[toothSite]['Suf']).filter((e)=> e[0] == toothFraction).map((e)=>{
//                             console.log(e[0]);
                            
//                             return (
//                                 <div>
//                                     <h4 className="text-xl font-semibold">{e[0]}</h4>
//                                     <p className="font-semibold">Status: <span className="font-light">{a[0]['dental-details'].teeth[toothSite]['Suf']['Mesial']['Status']}</span></p>
//                                     <p className="font-semibold">Authorization: <span className="font-light">{a[0]['dental-details'].teeth[toothSite]['Suf']['Mesial']['Pre_Auth']}</span></p>
//                                 </div>
//                             )
//                         })
//                     }
//                 </div>
//             </div>

//         </div>
//     )}
// }

// export default DentalInfo;

// import { useContext, useState } from "react";
// import { TeethContext } from "../../Context/TeethContext";

// import Data from "../../../../data";
// import { useLocation } from "react-router-dom";
// import ToothFraction from "./Tooth/ToothFraction";

// const DentalInfo = ({details}) => {
//     const patientId = useLocation().pathname.split('/')[2];

//     const {toothSite, setToothSite} = useContext(TeethContext);
//     const {toothFraction, setToothFraction} = useContext(TeethContext);

//     let a = Data.filter((patient)=>{
//         return patient.id == patientId
//     })


//     if(toothSite){
//         // console.log(toothSite);
//         // console.log(a[0]['dental-details'].teeth);
//         // console.log(a[0]['dental-details'].teeth[toothSite]);
//         console.log(Object.entries(details.teeth[toothSite]["Suf"]));
//         console.log('\n\n');

//     }


//     if(a[0]['dental-details'].teeth[toothSite]){
//         // console.log(a[0]['dental-details'].teeth[toothSite]['Suf']['Mesial']);
//     return (
//         <div className="info flex flex-wrap gap-x-4 w-2/12 overflow-hidden">
//             <div className="flex bg">
//                 <h4 className="font-bold">Site:</h4>
//                 <p>{toothSite}</p>
//             </div>

//             <div className="flex">
//                 <h4 className="font-bold">Category:</h4>
//                 <p>{a[0]['dental-details'].teeth[toothSite]['Category']}</p>
//             </div>

//             <div className="flex">
//                 <h4 className="font-bold">Code:</h4>
//                 <p>{a[0]['dental-details'].teeth[toothSite]['Code']}</p>
//             </div>


//             <div className="flex flex-col grow w-full h-48">
//                 <h3 className="text-2xl font-bold">Suf:</h3>
//                 <div className="grid grid-cols-3">
//                     {
//                         Object.entries(a[0]['dental-details'].teeth[toothSite]['Suf']).filter((e)=> e[0] == toothFraction).map((e)=>{
//                             console.log(e[0]);
                            
//                             return (
//                                 <div>
//                                     <h4 className="text-xl font-semibold">{e[0]}</h4>
//                                     <p className="font-semibold">Status: <span className="font-light">{a[0]['dental-details'].teeth[toothSite]['Suf']['Mesial']['Status']}</span></p>
//                                     <p className="font-semibold">Authorization: <span className="font-light">{a[0]['dental-details'].teeth[toothSite]['Suf']['Mesial']['Pre_Auth']}</span></p>
//                                 </div>
//                             )
//                         })
//                     }
//                 </div>
//             </div>

//         </div>
//     )}
// }

// export default DentalInfo;

import { useContext } from "react";
import { TeethContext } from "../../Context/TeethContext";

const DentalInfo = ({ details }) => {
    const { toothSite, toothFraction } = useContext(TeethContext);

    if (!details || details.length === 0) {
        return <div>No dental details available</div>;
    }

    if (!toothSite) {
        return <div>Please select a tooth to see details</div>;
    }

    // Find the dental chart entry that matches the selected tooth site
    const toothDetails = details.find(entry => entry.Site === toothSite);

    if (!toothDetails) {
        return <div>No details for the selected tooth</div>;
    }

    // Mapping between surface initials and full names
    const surfaceMapping = {
        M: 'Mesial',
        O: 'Occlusal',
        D: 'Distal',
        B: 'Buccal',
        L: 'Lingual',
    };

    // Split the 'Suf' string into an array of initials
    const sufArray = toothDetails.Suf.split('');

    // Map the initials to full surface names
    const surfaces = sufArray.map(letter => surfaceMapping[letter]);

    if (toothFraction) {
        // Check if the selected tooth fraction is in the surfaces array
        if (surfaces.includes(toothFraction)) {
            return (
                <div className="info flex flex-wrap gap-x-4 w-2/12 overflow-hidden">
                    <div className="flex bg">
                        <h4 className="font-bold">Site:</h4>
                        <p>{toothSite}</p>
                    </div>

                    <div className="flex">
                        <h4 className="font-bold">Surface:</h4>
                        <p>{toothFraction}</p>
                    </div>

                    <div className="flex">
                        <h4 className="font-bold">Category:</h4>
                        <p>{toothDetails.Category}</p>
                    </div>

                    <div className="flex">
                        <h4 className="font-bold">Code:</h4>
                        <p>{toothDetails.Code}</p>
                    </div>

                    <div className="flex">
                        <h4 className="font-bold">Status:</h4>
                        <p>{toothDetails.Status}</p>
                    </div>

                    <div className="flex">
                        <h4 className="font-bold">Authorization:</h4>
                        <p>{toothDetails.Pre_Auth}</p>
                    </div>
                </div>
            );
        } else {
            return <div>No details for the selected tooth surface</div>;
        }
    } else {
        // If no tooth fraction is selected, display all surfaces
        return (
            <div className="info flex flex-wrap gap-x-4 w-2/12 overflow-hidden">
                <div className="flex bg">
                    <h4 className="font-bold">Site:</h4>
                    <p>{toothSite}</p>
                </div>

                <div className="flex">
                    <h4 className="font-bold">Category:</h4>
                    <p>{toothDetails.Category}</p>
                </div>

                <div className="flex">
                    <h4 className="font-bold">Code:</h4>
                    <p>{toothDetails.Code}</p>
                </div>

                <div className="flex flex-col grow w-full h-48">
                    <h3 className="text-2xl font-bold">Surfaces:</h3>
                    <div className="grid grid-cols-3">
                        {surfaces.map((surface, index) => (
                            <div key={index}>
                                <h4 className="text-xl font-semibold">{surface}</h4>
                                <p className="font-semibold">
                                    Status: <span className="font-light">{toothDetails.Status}</span>
                                </p>
                                <p className="font-semibold">
                                    Authorization: <span className="font-light">{toothDetails.Pre_Auth}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
};

export default DentalInfo;
