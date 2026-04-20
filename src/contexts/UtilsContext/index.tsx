import { createContext, useContext, useState, type PropsWithChildren } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PageLoading from "../../pages/components/PageLoading";

interface IUtilsContext {
    isLoading: boolean;
    setIsLoading: (value: boolean) => void;
}

export const UtilsContext = createContext({} as IUtilsContext);

export const useUtils = () => useContext(UtilsContext);

export default function UtilsContextProvider({ children }: PropsWithChildren<unknown>) {
    const [isLoading, setIsLoading] = useState(false);

    return (
        <UtilsContext.Provider
            value={{
                isLoading,
                setIsLoading,
            }}
        >
            <PageLoading open={isLoading} />
            <ToastContainer position="top-right" />
            {children}
        </UtilsContext.Provider>
    );
}
