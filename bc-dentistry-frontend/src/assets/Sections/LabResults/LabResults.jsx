import React, { useEffect, useState, useContext } from 'react';
import LabResult from '../../components/LabResults/LabResult'; // Update the path based on your file structure

import { FiltersContext } from "../../Context/FiltersContext";


const LabResults = () => {
    const [labResults, setLabResults] = useState([]);

    const {filters, setFilters} = useContext(FiltersContext);
    const {sortDate, setSortDate} = useContext(FiltersContext);


    console.log(filters);
    




    useEffect(() => {
        const fetchLabResults = async () => {
            try {
                const response = await fetch('http://localhost:8080/Lab_Results'); // Fetch from your API endpoint
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                const data = await response.json(); // Parse the JSON response
                console.log(data); // Log the fetched data
                setLabResults(data); // Update state with fetched data
            } catch (error) {
                console.error('Error fetching lab results:', error);
            }
        };

        fetchLabResults(); // Call the async function
    }, []);



    console.log(labResults);
    

    let a = labResults.length == 0 ? "border rounded-xl" : "" 


    return (
        <div className={`lab-results-list grid grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 gap-8 col-span-12 ${a}`}>
            {/* Map through the fetched lab results */}
            {labResults.length > 0 ? (
                labResults.filter((res) => filters.includes(res.Status) || filters.includes(res.Status.toLowerCase()) || filters.length == 0 ).map(result => (
                    <LabResult
                        key={result.ID} // Unique key for each result
                        labTestId={result.ID}
                        testName={result.T_Name}
                        orderId={result.Order_ID}
                        caseId={result.Case_ID}
                        discipline={result.Discipline}
                        siteId={result.Site_ID}
                        status={result.Status}
                        date={new Date(result.Created_Date).toLocaleDateString()}
                    />
                ))
            ) : (
                <div className='py-4 px-3'>No lab results found.</div>
            )}
        </div>
    );
};

export default LabResults;
