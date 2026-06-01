import { useEffect, useRef, useState } from "react";
import { RenderingEngine, Enums, init as coreInit } from "@cornerstonejs/core";
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader";

coreInit();// Initialize cornerstone core
dicomImageLoaderInit();// Initialize the DICOM loader


const DicomViewer = () => {
    const content = useRef(null); // Ref to the div container
    const [initialized, setInitialized] = useState(false);

    const [ isClicked, setIsClicked ] = useState(false)


    useEffect(() => {
        const initialize = async () => {
            setInitialized(true);
        };
        initialize();
    }, []);

    useEffect(() => {
        if (initialized && content.current) {
            const renderEngineId = "myRenderingEngine";
            const renderingEngine = new RenderingEngine(renderEngineId);

            const viewportId = "CT_AXIAL_STACK";

            const viewportInput = {
                viewportId,
                element: content.current, // Pass the DOM node
                type: Enums.ViewportType.STACK,
            };

            renderingEngine.enableElement(viewportInput);

            //const imageId = `wadouri:https://github.com/dangom/sample-dicom/raw/master/MR000000.dcm`;
            const imageId = `wadouri:${window.location.origin}/0002.DCM`;
            

            const viewport = renderingEngine.getViewport(viewportId);

            (async () => {
                try {
                    await viewport.setStack([imageId], 0);
                    viewport.render();
                } catch (error) {
                    console.error("Error loading the DICOM image:", error);
                }
            })();
        }
    }, [isClicked]);



    let height = isClicked ? "h-[500px] opacity-100" : "max-h-0 h-[500px] overflow-hidden opacity-0" 



    return (
        <div>
            <h1 className="text-3xl font-bold">Dental Record</h1>
            {
                isClicked
                ?
                <button onClick={()=>{setIsClicked(prev => !prev)}} className="bg-white p-2 border rounded-md my-4">Hide the X-Ray Sample</button>
                :
                <button onClick={()=>{setIsClicked(prev => !prev)}} className="bg-white p-2 border rounded-md my-4">Show the X-Ray Sample</button>
            }


            <div 
                ref={content} // Attach the ref here
                className={`${height}`}
                style={{
                    width: "500px",
                    height: "500px",
                    backgroundColor: "black",
                }}
            ></div>
        </div>
    );
};

export default DicomViewer;