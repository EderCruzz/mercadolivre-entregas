import { useEffect, useState } from "react";
import api from "./services/api";
import CompraCard from "./components/CompraCard";
import "./App.css";

function App() {
  const [compras, setCompras] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [view, setView] = useState("triagem");

  useEffect(() => {
    setPage(1);
    carregarCompras(1);
  }, [view]);

  useEffect(() => {
    carregarCompras(page);
  }, [page]);

  async function carregarCompras(pagina) {
    let url = `/entregas?page=${pagina}`;

    if (view === "triagem") url += "&centro_custo=pendente";
    if (view === "classificados") url += "&centro_custo=definido&recebido=nao";
    if (view === "entregues") url += "&recebido=sim";

    const res = await api.get(url);
    setCompras(res.data.data);
    setTotalPages(res.data.totalPages);
  }

  return (
    <div className="container">
      <h1>📦 Minhas Compras</h1>

      <div className="tabs">
        <button onClick={() => setView("triagem")}>📝 Triagem</button>
        <button onClick={() => setView("classificados")}>📦 Classificados</button>
        <button onClick={() => setView("entregues")}>✅ Entregues</button>
      </div>

      {compras.map(compra => (
        <CompraCard
          key={compra.pedido_id}
          compra={compra}
          view={view}
          onAtualizar={() => carregarCompras(page)}
        />
      ))}
    </div>
  );
}

export default App;
