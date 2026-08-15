const sessionChannel = typeof BroadcastChannel === 'function'
    ? new BroadcastChannel('edr-session')
    : null;

export const getStoredUser = () => {
    const storedUser = sessionStorage.getItem("user");

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch (error) {
        console.warn("Ignoring invalid stored user data:", error);
        sessionStorage.removeItem("user");
        return null;
    }
};

export const getStoredUserRole = () => {
    const role = getStoredUser()?.role;
    return typeof role === "string" ? role.toLowerCase() : null;
};

export const clearSession = (broadcast = true) => {
    sessionStorage.removeItem('user');
    window.dispatchEvent(new Event('edr-session-changed'));
    if (broadcast) sessionChannel?.postMessage({ type: 'logout' });
};

export const hasValidSession = () => {
    const user = getStoredUser();
    return Boolean(user);
};

sessionChannel?.addEventListener('message', (event) => {
    if (event.data?.type === 'logout') {
        clearSession(false);
        window.dispatchEvent(new Event('edr-session-expired'));
    }
});
