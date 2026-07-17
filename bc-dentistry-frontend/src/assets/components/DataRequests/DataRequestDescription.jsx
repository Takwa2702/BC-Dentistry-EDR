const DataRequestDescription = ({Description}) => {
    return (
        <div className="description min-h-32">
            <h2 className="text-xl font-semibold">Description:-</h2>
            <p className="text-justify">{Description}</p>
        </div>
    )
}

export default DataRequestDescription;
