import { useContext } from "react"
import { TeethContext } from "../../Context/TeethContext"

import ToothFraction from "./Tooth/ToothFraction"

import T from "../../images/teeth/t_1.svg"

console.log(T);

const ToothImgLink = (site) => {
    return `/src/assets/images/teeth/t_${site}.svg`
}

const Tooth = ({category, code, site, suf, icon}) => {
    const { toothSite, setToothSite } = useContext(TeethContext);

    const changeColorOnEnter = (e) => {
        e.target.style.fill = 'lightgray'
    }
    const changeColorOnLeave = (e) => {
        e.target.style.fill = "white"
    }

    const dir = site > 16 ? 'flex-col-reverse' : 'flex-col'

    return (
        <div onClick={() => {setToothSite(site)}} className={`relative flex ${dir} w-fit tooth`}>
            {site <= 16 
            ?
            <div key={Math.random(9, 18)} className="flex flex-col items-center justify-center w-16 h-28 bg-white border my-2 rounded-md">
                <img className="disable scale-[190%] rotate-180" src={ToothImgLink(site)} alt="" /> 
            </div>
            :
            <div key={Math.random(0, 9)} className="flex flex-col items-center justify-center w-16 h-24 bg-white border my-2 rounded-md">
                <img className="scale-[190%]" src={ToothImgLink(site)} alt="" /> 
            </div>
            }
            <div key={Math.random(19, 28)} onClick={()=>{console.log('-----')}} className="Occlusal centerPart bg-[lightgray] relative h-[52px] w-[65px]">
                <svg
                    onClick={changeColorOnEnter}
                    onMouseLeave={changeColorOnLeave}
                    className="Occlusal h-full w-full" id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 311.14">
                    <rect
                        width="400" height="311.14"
                        style={{fill:"white", stroke: '#000', strokeLinecap:'round', strokeLinejoin: 'round', strokeWidth:"1px"}}
                    />
                </svg>

                {
                    Object.entries(suf).map(([side, values]) => {
                        return (
                            <div key={`side-${side}`}>
                                <ToothFraction
                                    type={"Mesial"}
                                    status={values['Status']}
                                    preAuth={values['Pre_Auth']}
                                    phase={values['Phase']}
                                    discipline={values['Discipline']}
                                    diagnosis={values['Diagnosis']}
                                    notes={values['Notes']}
                                    estimate={values['Estimate']}
                                    doctorId={values['Doctor_ID']}
                                    auditDate={values['Audit_Date']}
                                    createdDate={values['Created_Date']}
                                />
                                <ToothFraction
                                    type={"Lingual"}
                                    status={values['Status']}
                                    preAuth={values['Pre_Auth']}
                                    phase={values['Phase']}
                                    discipline={values['Discipline']}
                                    diagnosis={values['Diagnosis']}
                                    notes={values['Notes']}
                                    estimate={values['Estimate']}
                                    doctorId={values['Doctor_ID']}
                                    auditDate={values['Audit_Date']}
                                    createdDate={values['Created_Date']}
                                />
                                <ToothFraction
                                    type={"Distal"}
                                    status={values['Status']}
                                    preAuth={values['Pre_Auth']}
                                    phase={values['Phase']}
                                    discipline={values['Discipline']}
                                    diagnosis={values['Diagnosis']}
                                    notes={values['Notes']}
                                    estimate={values['Estimate']}
                                    doctorId={values['Doctor_ID']}
                                    auditDate={values['Audit_Date']}
                                    createdDate={values['Created_Date']}
                                />
                                <ToothFraction
                                    type={"Buccal"}
                                    status={values['Status']}
                                    preAuth={values['Pre_Auth']}
                                    phase={values['Phase']}
                                    discipline={values['Discipline']}
                                    diagnosis={values['Diagnosis']}
                                    notes={values['Notes']}
                                    estimate={values['Estimate']}
                                    doctorId={values['Doctor_ID']}
                                    auditDate={values['Audit_Date']}
                                    createdDate={values['Created_Date']}
                                />
                            </div>
                        );
                    })
                }

            </div>  

        </div>
    )
}

export default Tooth;
