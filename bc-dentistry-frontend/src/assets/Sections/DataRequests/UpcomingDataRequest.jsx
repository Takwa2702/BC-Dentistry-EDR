// import React from 'react';
// import DataRequestsOrdersBtns from './DataRequestsOrdersBtns';

// const UpcomingDataRequest = ({header, details, type}) => {
//     return (
//         <div className="flex flex-col justify-center py-2 px-4 mb-6 h-36 border border-gray-300 rounded-md shadow-md overflow-hidden">
//             <h3 className="text-lg font-semibold">{header}</h3>
//             <p className="text-gray-600 text-sm">{details}</p>  
//             <DataRequestsOrdersBtns />
//         </div>
//     );
// };

// export default UpcomingDataRequest;
import React from 'react';
import DataRequestsOrdersBtns from './DataRequestsOrdersBtns';

const UpcomingDataRequest = ({ header, details, type, onApprove }) => {
    return (
        <div className="flex flex-col justify-center py-2 px-4 mb-6 h-36 border border-gray-300 rounded-md shadow-md overflow-hidden">
            <h3 className="text-lg font-semibold">{header}</h3>
            <p className="text-gray-600 text-sm">{details}</p>  
            <button 
                className="p-1 bg-green-500 text-white font-semibold rounded-md mt-2"
                onClick={onApprove}
            >
                Approve
            </button>
        </div>
    );
};

export default UpcomingDataRequest;
