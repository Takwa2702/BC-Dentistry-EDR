import { createContext, useContext, useEffect, useState } from "react";
import { sessionService } from "../services/sessionService";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [sessionState, setSessionState] = useState(sessionService.getState());

    useEffect(() => {
        const unsubscribe = sessionService.subscribe(setSessionState);
        sessionService.initSession();
        return unsubscribe;
    }, []);

    const value = {
        user: sessionState.user,
        token: sessionState.accessToken,
        refreshToken: sessionState.refreshToken,
        isLoading: sessionState.isLoading,
        isAuthenticated: sessionState.isAuthenticated,
        setUser: (user) => sessionService.setSession({ user }),
        setToken: (token) => sessionService.setSession({ accessToken: token }),
        setSession: (sessionData) => sessionService.setSession(sessionData),
        signOut: () => sessionService.clearSession(),
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
