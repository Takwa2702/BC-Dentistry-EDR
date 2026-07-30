import { getStoredUser } from '../utils/auth.js';

const Settings = () => {
    const user = getStoredUser();
    return (
        <main id="Settings" className="rounded-xl border bg-white p-6">
            <h1 className="text-2xl font-bold">Account and session</h1>
            <dl className="mt-4 grid grid-cols-[10rem_1fr] gap-2">
                <dt className="font-semibold">Role</dt><dd>{user?.role || 'Unknown'}</dd>
                <dt className="font-semibold">Account</dt><dd>{user?.email || user?.id || 'Unknown'}</dd>
            </dl>
            <p className="mt-4 text-sm text-gray-600">Use the Log out button in the top bar when leaving a shared workstation.</p>
        </main>
    )
}

export default Settings;
