import React from 'react';
import Select from 'react-select';
import { useRole } from '../Context/RoleContext.jsx';

const UserRole = () => {
    const { setUserRole } = useRole();

    const handleChange = (selectedOption) => {
        console.log("Setting role to:", selectedOption.value);
        setUserRole(selectedOption.value);
    };

    const options = [
        { value: 'doctor', label: 'Doctor' },
        { value: 'admin', label: 'Admin' }
    ];

    return (
        <Select
            onChange={handleChange}
            options={options}
            placeholder="Select a role"
            className="text-black -mt-[10px]"
            classNamePrefix="select"
        />
    );
};

export default UserRole; 