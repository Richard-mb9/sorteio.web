import GlobalContext from "./contexts";
import Pages from "./pages";

function App() {
    return (
        <GlobalContext>
            <Pages />
        </GlobalContext>
    );
}

export default App;
