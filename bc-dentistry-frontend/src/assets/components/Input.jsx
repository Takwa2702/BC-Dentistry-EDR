const Input = ({Type, Id, Classes, isRequired, onChange }) => {
    return isRequired
    ?
        <input
            required
            type = {Type}
            id = {Id}
            className= {`mt-1 block p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${Classes}`}
            onChange={onChange} // Pass the onChange prop to handle changes
        />
    :
        <input
            type = {Type}
            id = {Id}
            className= {Classes}
            onChange={onChange} // Pass the onChange prop to handle changes
        />

}



export default Input;