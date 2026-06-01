const MainContainer = ({Id, children, classes, stlyes}) => {
    return (
        <div id={Id} className={`grid grid-cols-12 gap-x-8 overflow-hidden ${classes}`} style={stlyes} >
            {children}
        </div>
    )
}

export default MainContainer;