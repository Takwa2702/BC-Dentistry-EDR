const InputComponent = ({header, type, placeholder, classes, options, name, value, onChange}) => {
    const fieldProps = name ? { name, value: value || '', onChange } : {};

    if(type == 'select'){
        return (
            <div className="flex flex-col">
                <label className="input-header text-lg mb-1">{header}</label>
                <select className="p-2 border rounded-md w-full h-full" {...fieldProps}>
                    <option value="">{`Select ${header}`}</option>
                    {
                        options.map((option) => {
                            return <option key={option} value={option}>{option}</option>
                        })
                    }
                </select>
            </div>
        )
    }
    else{
        return (
            <div className={`input ${classes}`}>
                <div className="input-header text-lg mb-1">{header}</div>
                <input placeholder={placeholder} type={type} className="p-2 border rounded-md w-full" {...fieldProps} />
            </div>
        )
    }


}

export default InputComponent;
