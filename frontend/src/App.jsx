import { useEffect, useState } from "react";
import api from "./services/api";
import CompraCard from "./components/CompraCard";
import "./App.css";

function App() {
  const [compras, setCompras] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [animating, setAnimating] = useState(false);

  // 🔑 controla qual "página" estamos vendo
  const [view, setView] = useState("pendente"); 
  // pendente | definido

  useEffect(() => {
    setPage(1);
    carregarCompras(1);
  }, [view]);

  useEffect(() => {
    carregarCompras(page);
  }, [page]);

  async function carregarCompras(pagina) {
    try {
      setAnimating(true);

      setTimeout(async () => {
        const res = await api.get(
          `/entregas?page=${pagina}&centro_custo=${view}`
        );

        setCompras(res.data.data);
        setTotalPages(res.data.totalPages);

        setAnimating(false);
      }, 200);
    } catch (err) {
      console.error("Erro ao carregar compras:", err);
      setAnimating(false);
    }
  }

  return (
    <div className="container">
      <h1>📦 Minhas Compras</h1>

      {/* 🔀 ABAS */}
      <div className="tabs">
        <button
          className={view === "pendente" ? "active" : ""}
          onClick={() => setView("pendente")}
        >
          📝 Triagem
        </button>

        <button
          className={view === "definido" ? "active" : ""}
          onClick={() => setView("definido")}
        >
          📦 Classificados
        </button>
      </div>

      <div className={`cards-wrapper ${animating ? "fade-out" : "fade-in"}`}>
        {compras.map(compra => (
          <CompraCard
            key={compra.pedido_id}
            compra={compra}
            view={view}
            onAtualizar={() => carregarCompras(page)}
          />
        ))}
      </div>

      {/* PAGINAÇÃO */}
      <div className="pagination">
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page === 1}
        >
          ⬅ Anterior
        </button>

        <span>
          Página {page} de {totalPages}
        </span>

        <button
          onClick={() => setPage(p => Math.min(p + 1, totalPages))}
          disabled={page === totalPages}
        >
          Próxima ➡
        </button>
      </div>
    </div>
  );
}

export default App;
