import { MainContainer } from "../components";


const LabResults = () => {


    return (
        <MainContainer Id={'LabResults'} classes={'w-full flex flex-col mb-24 gap-y-4'}>
            <div role="status" className="col-span-12 rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
                <h1 className="text-2xl font-bold">Lab results unavailable</h1>
                <p className="mt-2">This screen is disabled until a patient- and clinic-scoped laboratory data source is configured. No demonstration results are shown as clinical data.</p>
            </div>
        </MainContainer>
    )
}






export default LabResults;
