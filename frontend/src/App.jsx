import { useEffect, useState } from "react";
import axios from "axios";
import "./index.css";

function App() {
  const [entregas, setEntregas] = useState([]);

  useEffect(() => {
    axios
      .get("https://mercadolivre-entregas.onrender.com/public/entregas")
      .then(res => setEntregas(res.data));
  }, []);

  return (
    <div className="container">
      <h2>📦 Minhas Compras</h2>

      {entregas.map((e, i) => (
        <div key={i} className="pedido">
          {e.imagem && (
            <img src={e.imagem} alt={e.produto} />
          )}

          <div className="info">
            <span className="status ok">
              {e.status_entrega === "delivered"
                ? "Entregue"
                : "Envio no prazo"}
            </span>

            <h3>{e.produto}</h3>

            <p>
              Compra em{" "}
              {new Date(e.data_compra).toLocaleDateString("pt-BR")}
            </p>

            {e.data_entrega && (
              <p>
                Entregue em{" "}
                {new Date(e.data_entrega).toLocaleDateString("pt-BR")}
              </p>
            )}

            {e.palavra_chave && (
              <p className="keyword">
                🔑 Palavra-chave: {e.palavra_chave}
              </p>
            )}
          </div>

          <div className="vendedor">
            <strong>{e.vendedor}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
