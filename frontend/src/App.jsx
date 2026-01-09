import { useEffect, useState } from "react";
import api from "./services/api";
import CompraCard from "./components/CompraCard";
import "./App.css";

function App() {
  const [compras, setCompras] = useState([]);

  useEffect(() => {
    api.get("/entregas")
      .then(res => setCompras(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="container">
      <h1>📦 Minhas Compras</h1>

      {compras.map(compra => (
        <CompraCard
          key={compra.pedido_id}
          compra={compra}
        />
      ))}
    </div>
  );
}

export default App;
