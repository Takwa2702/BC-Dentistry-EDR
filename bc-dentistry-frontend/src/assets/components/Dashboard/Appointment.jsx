const Appointment = ({icon, header, subheader}) => {
    return (
        <div className="appointment flex bg-white p-3 h-16 items-center rounded-xl grow border">
            <div className="icon p-1 mr-4 w-10 h-10 flex items-center justify-center rounded-md">
                <img className="w-6" src={icon} alt="" />
            </div>
            <div className="text">
                <p className="font-regular text-[.75em]">{subheader}</p>
                <h5 className="font-extrabold text-lg h-4 leading-none">{header}</h5>
            </div>
        </div>
    )
}
export default Appointment;