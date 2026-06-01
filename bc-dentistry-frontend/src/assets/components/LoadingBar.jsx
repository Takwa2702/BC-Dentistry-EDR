import { useState, useEffect, useRef } from "react";


const LoadingBar = () => {
    const [ loadingProgress, setLoadingProgress ] = useState(0);
    const [ isLoading, setIsLoading ] = useState(true);


    const bar = useRef()

    useEffect(() => {
        const assets = Array.from(document.querySelectorAll("img, script, link[rel='stylesheet']") )
        const totalAssets = assets.length;

        
        if(totalAssets == 0) {
            setIsLoading(false);
            return;
        }
        


        let loadadAssets = 0;

        const updateProgress = () => {

            setInterval(() => {}, 500)

            loadadAssets++;
            const progress = Math.round((loadadAssets / totalAssets) *100);
            setLoadingProgress(progress);

            if(loadadAssets == totalAssets){
                setTimeout(() => {
                    setIsLoading(false)
                    bar.current.parentElement.parentElement.style.height = '0px' 
                }, 3000)
            }

        }


        assets.forEach((asset) => {
                updateProgress()

        })


        return () => {
            assets.forEach((asset) => {
                asset.removeEventListener('load', updateProgress);
                asset.removeEventListener('error', updateProgress);
            })
        }

    }, [])
    

    return (
        <div ref={bar} className="loading-bar bg-[#000] w-96 h-2 rounded-full relative overflow-hidden">
            <div className={`absolute left-0 top-0 bg-[#FFF] max-w-full h-full`} style={{width: `${loadingProgress}%`}}>
                
            </div>
        </div>
    )
}


export default LoadingBar;