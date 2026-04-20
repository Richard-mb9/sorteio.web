import { type PropsWithChildren } from "react";
import AuthContextProvider from "./Auth";
import UtilsContextProvider from "./UtilsContext";

export default function GlobalContext({ children }: PropsWithChildren<unknown>) {
    return (
        <UtilsContextProvider>
            <AuthContextProvider>{children}</AuthContextProvider>
        </UtilsContextProvider>
    );
}
