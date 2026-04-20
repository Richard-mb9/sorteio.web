import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./Dashboard";

export default function Pages() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<Dashboard />} path="/*" />
            </Routes>
        </BrowserRouter>
    );
}
