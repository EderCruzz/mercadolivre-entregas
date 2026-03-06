import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import PalavraChaveTV from "./pages/PalavraChaveTV";

function App() {

  return (
    <BrowserRouter>

      <Routes>

        <Route path="/" element={<Dashboard />} />

        <Route
          path="/palavra-chave"
          element={<PalavraChaveTV />}
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;