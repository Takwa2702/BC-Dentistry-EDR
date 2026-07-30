import React from 'react';

const UpcomingDataRequest = ({ header, details, type, onApprove, onReject }) => {
    return (
        <div className="flex flex-col justify-center py-2 px-4 mb-6 min-h-44 border border-gray-300 rounded-md shadow-md overflow-hidden">
            <h3 className="text-lg font-semibold">{header}</h3>
            <p className="text-gray-600 text-sm whitespace-pre-line">{details}</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <button className="p-1 bg-red-600 text-white font-semibold rounded-md" onClick={onReject}>Reject</button>
                <button className="p-1 bg-green-600 text-white font-semibold rounded-md" onClick={onApprove}>Approve</button>
            </div>
        </div>
    );
};

export default UpcomingDataRequest;
