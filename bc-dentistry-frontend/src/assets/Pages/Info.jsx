const Info = () => {
    return (
        <main id="Info" className="rounded-xl border bg-white p-6">
            <h1 className="text-2xl font-bold">Electronic Dental Record</h1>
            <p className="mt-3 text-gray-700">Patient information shown in this application is restricted by your authenticated role, clinic, assignment, and consent context.</p>
            <p className="mt-2 text-gray-700">If information appears incorrect or access is unexpected, stop using the record and contact the system administrator.</p>
        </main>
    )
}

export default Info;
