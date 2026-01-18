import { useEffect, useState } from "react";
import api from "./services/api";
import CompraCard from "./components/CompraCard";
import "./App.css";
import Header from "./components/Header";

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

    try {
      const res = await api.get(url);
      setCompras(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Erro ao carregar compras:", err);
    }
  }

  return (
    <>
      <Header />

      <div className="container">
        <h1 className="page-title">Minhas Compras</h1>

        {/* 🔀 ABAS */}
        <div className="tabs">
          <button
            className={view === "triagem" ? "active" : ""}
            onClick={() => setView("triagem")}
          >
            Triagem
          </button>

          <button
            className={view === "classificados" ? "active" : ""}
            onClick={() => setView("classificados")}
          >
            Classificados
          </button>

          <button
            className={view === "entregues" ? "active" : ""}
            onClick={() => setView("entregues")}
          >
            Entregues
          </button>
        </div>

        {/* LISTA */}
        <div className="cards-wrapper">
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
        {totalPages > 1 && (
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
        )}
      </div>

    </>
  );
}

export default App;
