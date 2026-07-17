export const getStoredUser = () => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
        return null;
    }

    try {
        return JSON.parse(storedUser);
    } catch (error) {
        console.warn("Ignoring invalid stored user data:", error);
        localStorage.removeItem("user");
        return null;
    }
};

export const getStoredUserRole = () => {
    const role = getStoredUser()?.role;
    return typeof role === "string" ? role.toLowerCase() : null;
};

const decodeJwtPayload = (token) => {
    try {
        const encoded = token.split('.')[1];
        if (!encoded) return null;
        const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch {
        return null;
    }
};

export const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const hasValidSession = () => {
    const token = localStorage.getItem('token');
    const user = getStoredUser();
    const payload = token ? decodeJwtPayload(token) : null;
    if (!token || !user || !payload?.exp || payload.exp * 1000 <= Date.now()) {
        clearSession();
        return false;
    }
    return true;
};
