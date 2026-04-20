import { createContext, useContext, useState, type PropsWithChildren } from "react";

interface IAuthContext {
    accessToken: string | undefined;
    isAuthenticated: boolean;
    setIsAuthenticated: (value: boolean) => void;
}

const AuthContext = createContext({} as IAuthContext);

export const useAuthContext = () => useContext(AuthContext);

export default function AuthContextProvider({ children }: PropsWithChildren<unknown>) {
    const [isAuthenticated, setIsAuthenticated] = useState(true);

    return (
        <AuthContext.Provider
            value={{
                accessToken: undefined,
                isAuthenticated,
                setIsAuthenticated,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
