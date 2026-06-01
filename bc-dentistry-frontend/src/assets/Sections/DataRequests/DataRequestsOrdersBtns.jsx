import { useRef } from "react";

const DataRequestsOrdersBtns = () => {
    const acceptBtn = useRef();
    const rejectBtn = useRef();

    const doAction = (e) => {

        if([...e.target.classList][0] == 'accept' || [...e.target.classList][0] == 'reject'){
            acceptBtn.current.parentElement.parentElement.style.height = 'auto'
        }
        else{
            Object.assign(rejectBtn.current.parentElement.parentElement.style, {
                height: '0',
                padding: '0',
                margin: '0',
                border: 'none'
            })
            
            setTimeout(() => {rejectBtn.current.parentElement.parentElement.style.display = "none"}, 3000)

        }
        

    }


    return (
        <div className="btns w-full grid grid-cols-2 gap-x-4 mt-2">
            <button ref={acceptBtn} onClick={doAction} className="accept p-1 bg-green-500 text-white font-semibold rounded-md">Approve</button>
            <button ref={rejectBtn} onClick={doAction} className="reject p-1 text-red-500 border border-red-500 rounded-md">Reject</button>
        </div>
    )
}


export default DataRequestsOrdersBtns;